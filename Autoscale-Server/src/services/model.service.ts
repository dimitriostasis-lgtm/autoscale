import { randomUUID } from "node:crypto";

import { readStore, updateStore } from "../lib/store.js";
import {
  SUPPORTED_WORKER_ASPECT_RATIOS,
  SUPPORTED_WORKER_GENERATION_MODELS,
  SUPPORTED_WORKER_RESOLUTIONS,
  getAllowedAspectRatiosForGenerationModel,
  getAllowedResolutionsForGenerationModel,
  getMaxBoardQuantityForGenerationModel,
} from "../types/domain.js";
import type { AuthUser, InfluencerModel, InfluencerDefaults, WorkerAspectRatio, WorkerGenerationModel, WorkerResolution } from "../types/domain.js";

import {
  assertInfluencerAccess,
  canManageAccounts,
  filterAssetsForUser,
  getUserAgencyIds,
  isAgencyAdmin,
  requireAuthenticatedUser,
} from "./permissions.service.js";
import { presentInfluencerModel } from "./presenters.js";

const allowedGenerationModels: WorkerGenerationModel[] = [...SUPPORTED_WORKER_GENERATION_MODELS];
const agencyInfluencerCapacity = 2;
const allowedResolutions: WorkerResolution[] = [...SUPPORTED_WORKER_RESOLUTIONS];
const allowedAspectRatios: WorkerAspectRatio[] = [...SUPPORTED_WORKER_ASPECT_RATIOS];
const accentPairs = [
  { accentFrom: "from-lime-300", accentTo: "to-emerald-400" },
  { accentFrom: "from-sky-300", accentTo: "to-cyan-400" },
  { accentFrom: "from-amber-300", accentTo: "to-orange-400" },
  { accentFrom: "from-fuchsia-300", accentTo: "to-rose-400" },
  { accentFrom: "from-violet-300", accentTo: "to-indigo-400" },
  { accentFrom: "from-teal-300", accentTo: "to-cyan-400" },
] as const;

function assertAdmin(viewer: AuthUser): void {
  if (!canManageAccounts(viewer)) {
    throw new Error("Platform admin access required");
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function ensureUniqueSlug(existingModels: InfluencerModel[], baseSlug: string): string {
  let candidate = baseSlug || `model-${existingModels.length + 1}`;
  let suffix = 2;
  while (existingModels.some((model) => model.slug === candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeHandle(handle: string): string {
  const trimmed = handle.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

function buildAvatarLabel(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "AI";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 2) || "AI";
}

function pickAccentPair(existingModels: InfluencerModel[]) {
  return accentPairs[existingModels.length % accentPairs.length];
}

function validateDefaults(defaults: InfluencerDefaults, allowedModels: WorkerGenerationModel[]): void {
  if (!allowedModels.includes(defaults.generationModel)) {
    throw new Error("Default generation model must be included in the allowed model list");
  }

  if (!allowedGenerationModels.includes(defaults.generationModel)) {
    throw new Error("Unsupported generation model");
  }

  if (!allowedResolutions.includes(defaults.resolution)) {
    throw new Error("Unsupported resolution");
  }

  if (!getAllowedResolutionsForGenerationModel(defaults.generationModel).includes(defaults.resolution)) {
    throw new Error("Resolution is not supported for the selected generation model");
  }

  if (!allowedAspectRatios.includes(defaults.aspectRatio)) {
    throw new Error("Unsupported aspect ratio");
  }

  if (!getAllowedAspectRatiosForGenerationModel(defaults.generationModel).includes(defaults.aspectRatio)) {
    throw new Error("Aspect ratio is not supported for the selected generation model");
  }

  const maxQuantity = getMaxBoardQuantityForGenerationModel(defaults.generationModel);
  if (defaults.quantity < 1 || defaults.quantity > maxQuantity) {
    throw new Error(`Quantity must be between 1 and ${maxQuantity}`);
  }
}

export async function listInfluencerModels(
  currentUser: AuthUser | null,
  options?: { includeInactive?: boolean },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await readStore();
  return store.influencerModels
    .filter((model) => (options?.includeInactive && canManageAccounts(viewer)) || model.isActive)
    .map((model) => presentInfluencerModel(model.id, store, viewer))
    .filter((model): model is NonNullable<ReturnType<typeof presentInfluencerModel>> => Boolean(model))
    .filter((model) => model.canAccess);
}

export async function getInfluencerModel(currentUser: AuthUser | null, slug: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await readStore();
  const model = store.influencerModels.find((entry) => entry.slug === slug);
  if (!model) {
    return null;
  }
  assertInfluencerAccess(store, viewer, model.id);
  return presentInfluencerModel(model.id, store, viewer);
}

export async function listModelAssets(currentUser: AuthUser | null, influencerModelId: string, limit = 80) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await readStore();
  assertInfluencerAccess(store, viewer, influencerModelId);
  return filterAssetsForUser(
    store,
    viewer,
    store.assets.filter((asset) => asset.influencerModelId === influencerModelId),
  )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function createInfluencerModel(
  currentUser: AuthUser | null,
  input: {
    name: string;
    handle: string;
    description?: string | null;
    avatarImageUrl?: string | null;
    allowedGenerationModels: string[];
    defaults: {
      generationModel: string;
      resolution: string;
      aspectRatio: string;
      quantity: number;
      promptPrefix: string;
    };
  },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  const platformCreator = canManageAccounts(viewer);
  const agencyCreator = isAgencyAdmin(viewer);

  if (!platformCreator && !agencyCreator) {
    throw new Error("Platform admin or agency admin access required");
  }

  if (agencyCreator && !viewer.agencyId) {
    throw new Error("Agency admin must belong to an agency");
  }

  const normalizedName = input.name.trim();
  const normalizedHandle = normalizeHandle(input.handle);
  const normalizedDescription = input.description?.trim() || "";
  const normalizedAllowedModels = [...allowedGenerationModels];

  if (!normalizedName) {
    throw new Error("Model name is required");
  }
  if (!normalizedHandle) {
    throw new Error("Model handle is required");
  }
  const normalizedDefaults: InfluencerDefaults = {
    generationModel: input.defaults.generationModel as WorkerGenerationModel,
    resolution: input.defaults.resolution as WorkerResolution,
    aspectRatio: input.defaults.aspectRatio as WorkerAspectRatio,
    quantity: Number(input.defaults.quantity),
    promptPrefix: input.defaults.promptPrefix.trim(),
  };

  validateDefaults(normalizedDefaults, normalizedAllowedModels);

  const store = await updateStore((current) => {
    const ownerAgencyIds = agencyCreator ? [viewer.agencyId as string] : [];

    if (agencyCreator) {
      const agencyModelCount = current.influencerModels.filter(
        (model) => model.isActive && model.agencyIds.includes(viewer.agencyId as string),
      ).length;

      if (agencyModelCount >= agencyInfluencerCapacity) {
        throw new Error("Your agency influencer allowance is already fully used");
      }
    }

    if (current.influencerModels.some((model) => model.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error("A model with this name already exists");
    }
    if (current.influencerModels.some((model) => model.handle.toLowerCase() === normalizedHandle.toLowerCase())) {
      throw new Error("A model with this handle already exists");
    }

    const accentPair = pickAccentPair(current.influencerModels);
    const baseSlug = slugify(normalizedName || normalizedHandle);
    const createdAt = new Date().toISOString();

    current.influencerModels.push({
      id: randomUUID(),
      slug: ensureUniqueSlug(current.influencerModels, baseSlug),
      name: normalizedName,
      handle: normalizedHandle,
      archetype: "",
      description: normalizedDescription,
      avatarImageUrl: input.avatarImageUrl?.trim() || null,
      accentFrom: accentPair.accentFrom,
      accentTo: accentPair.accentTo,
      avatarLabel: buildAvatarLabel(normalizedName),
      isActive: true,
      agencyIds: ownerAgencyIds,
      defaultPlatformWorkflowName: "Default platform workflow",
      platformWorkflowCount: 3,
      customWorkflowCount: 0,
      defaults: normalizedDefaults,
      allowedGenerationModels: normalizedAllowedModels,
      createdAt,
    });

    return current;
  });

  const created = store.influencerModels.find((model) => model.handle.toLowerCase() === normalizedHandle.toLowerCase());
  if (!created) {
    throw new Error("Failed to create influencer model");
  }

  return presentInfluencerModel(created.id, store, viewer);
}

export async function updateInfluencerModelProfile(
  currentUser: AuthUser | null,
  influencerModelId: string,
  input: {
    name: string;
    handle: string;
    description?: string | null;
    avatarImageUrl?: string | null;
  },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertAdmin(viewer);

  const normalizedName = input.name.trim();
  const normalizedHandle = normalizeHandle(input.handle);
  const normalizedDescription = input.description?.trim();

  if (!normalizedName) {
    throw new Error("Model name is required");
  }
  if (!normalizedHandle) {
    throw new Error("Model handle is required");
  }
  const store = await updateStore((current) => {
    const model = current.influencerModels.find((entry) => entry.id === influencerModelId);
    if (!model) {
      throw new Error("Influencer model not found");
    }

    if (current.influencerModels.some((entry) => entry.id !== influencerModelId && entry.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error("A model with this name already exists");
    }
    if (current.influencerModels.some((entry) => entry.id !== influencerModelId && entry.handle.toLowerCase() === normalizedHandle.toLowerCase())) {
      throw new Error("A model with this handle already exists");
    }

    model.name = normalizedName;
    model.handle = normalizedHandle;
    if (normalizedDescription !== undefined) {
      model.description = normalizedDescription;
    }
    model.avatarImageUrl = input.avatarImageUrl?.trim() || null;
    model.avatarLabel = buildAvatarLabel(normalizedName);

    return current;
  });

  return presentInfluencerModel(influencerModelId, store, viewer);
}

export async function deleteInfluencerModel(currentUser: AuthUser | null, influencerModelId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertAdmin(viewer);

  await updateStore((current) => {
    const model = current.influencerModels.find((entry) => entry.id === influencerModelId);
    if (!model) {
      throw new Error("Influencer model not found");
    }

    const deletedBoardIds = new Set(
      current.boards.filter((board) => board.influencerModelId === influencerModelId).map((board) => board.id),
    );

    current.influencerModels = current.influencerModels.filter((entry) => entry.id !== influencerModelId);
    current.modelAccess = current.modelAccess.filter((assignment) => assignment.influencerModelId !== influencerModelId);
    current.boards = current.boards.filter((board) => board.influencerModelId !== influencerModelId);
    current.assets = current.assets.filter(
      (asset) => asset.influencerModelId !== influencerModelId && !deletedBoardIds.has(asset.boardId),
    );

    return current;
  });

  return true;
}

export async function setInfluencerModelAgencyAccess(
  currentUser: AuthUser | null,
  influencerModelId: string,
  agencyIds: string[],
) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertAdmin(viewer);

  const store = await updateStore((current) => {
    const model = current.influencerModels.find((entry) => entry.id === influencerModelId);
    if (!model) {
      throw new Error("Influencer model not found");
    }

    const validAgencyIds = new Set(current.agencies.map((agency) => agency.id));
    const nextAgencyIds = Array.from(new Set(agencyIds)).filter((agencyId) => validAgencyIds.has(agencyId));
    if (nextAgencyIds.length > 1) {
      throw new Error("An influencer model can only belong to one agency");
    }

    const removedAgencyIds = model.agencyIds.filter((agencyId) => !nextAgencyIds.includes(agencyId));

    model.agencyIds = nextAgencyIds;

    if (removedAgencyIds.length) {
      current.modelAccess = current.modelAccess.filter((assignment) => {
        if (assignment.influencerModelId !== influencerModelId) {
          return true;
        }

        const assignedUser = current.users.find((user) => user.id === assignment.userId);
        return assignedUser ? getUserAgencyIds(assignedUser).some((agencyId) => model.agencyIds.includes(agencyId)) : false;
      });
    }

    return current;
  });

  return presentInfluencerModel(influencerModelId, store, viewer);
}
