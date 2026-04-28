import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import {
  DEFAULT_POSE_PROMPT_TEMPLATE,
  DEFAULT_MANAGER_PERMISSIONS,
  SUPPORTED_WORKER_GENERATION_MODELS,
  getMaxBoardQuantityForGenerationModel,
  isPoseMultiplierWorkspace,
  normalizeBoardAspectRatio,
  normalizeOptionalPosePromptTemplates,
  normalizePoseMultiplierResolution,
  normalizePoseMultiplierGenerationModel,
  normalizePosePromptTemplates,
  normalizeQualityForGenerationModel,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
} from "../types/domain.js";
import { hashPassword } from "./auth.js";
import type {
  Agency,
  BoardSettings,
  InfluencerModel,
  ModelAccessAssignment,
  ManagerPermissions,
  StoreData,
  StoredUser,
  WorkerGenerationModel,
  WorkspaceBoard,
  WorkspaceRow,
} from "../types/domain.js";

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeManagerPermissions(value: Partial<ManagerPermissions> | null | undefined): ManagerPermissions {
  return {
    canSuspendUsers: value?.canSuspendUsers ?? DEFAULT_MANAGER_PERMISSIONS.canSuspendUsers,
    canDeleteUsers: value?.canDeleteUsers ?? DEFAULT_MANAGER_PERMISSIONS.canDeleteUsers,
    canResetPasswords: value?.canResetPasswords ?? DEFAULT_MANAGER_PERMISSIONS.canResetPasswords,
    canManageAssignments: value?.canManageAssignments ?? DEFAULT_MANAGER_PERMISSIONS.canManageAssignments,
    canManageCredits: value?.canManageCredits ?? DEFAULT_MANAGER_PERMISSIONS.canManageCredits,
  };
}

function createDefaultAgencies(timestamp: string): Agency[] {
  return [
    {
      id: randomUUID(),
      slug: "northstar-creative",
      name: "Northstar Creative",
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      slug: "lattice-social",
      name: "Lattice Social",
      createdAt: timestamp,
    },
  ];
}

function normalizeInfluencerAgencyIds(
  value: unknown,
  agencies: Agency[],
  defaultAgencyIds: string[],
): string[] {
  if (!Array.isArray(value)) {
    return defaultAgencyIds.slice(0, 1);
  }

  const validAgencyIds = new Set(agencies.map((agency) => agency.id));
  return Array.from(new Set(value.filter((agencyId): agencyId is string => typeof agencyId === "string" && validAgencyIds.has(agencyId)))).slice(0, 1);
}

function normalizeWorkflowCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function normalizeManagedAgencyIds(
  agencies: Agency[],
  primaryAgencyId: string | null,
  role: string,
): string[] {
  if (role !== "AGENCY_MANAGER") {
    return [];
  }

  const validAgencyIds = new Set(agencies.map((agency) => agency.id));
  return primaryAgencyId && validAgencyIds.has(primaryAgencyId) ? [primaryAgencyId] : [];
}

function isSupportedWorkerGenerationModel(value: unknown): value is WorkerGenerationModel {
  return typeof value === "string" && SUPPORTED_WORKER_GENERATION_MODELS.includes(value as WorkerGenerationModel);
}

function normalizeWorkerGenerationModel(value: unknown): WorkerGenerationModel {
  return isSupportedWorkerGenerationModel(value) ? value : SUPPORTED_WORKER_GENERATION_MODELS[0];
}

function normalizeAllowedGenerationModels(value: unknown): WorkerGenerationModel[] {
  const normalized = Array.isArray(value) ? Array.from(new Set(value.filter(isSupportedWorkerGenerationModel))) : [];

  for (const generationModel of SUPPORTED_WORKER_GENERATION_MODELS) {
    if (!normalized.includes(generationModel)) {
      normalized.push(generationModel);
    }
  }

  return normalized;
}

function normalizeBoardQuantity(generationModel: WorkerGenerationModel | string, value: unknown): number {
  const quantity = typeof value === "number" ? value : 1;
  return Math.max(1, Math.min(getMaxBoardQuantityForGenerationModel(generationModel), quantity));
}

function normalizeStoreData(rawStore: Partial<StoreData>): StoreData {
  const timestamp = nowIso();
  const normalizedAgencies = (rawStore.agencies || [])
    .filter((agency) => agency.slug !== "platform-admin")
    .map((agency) => ({
      ...agency,
      createdAt: agency.createdAt || timestamp,
    }));
  const agencies = normalizedAgencies.length ? normalizedAgencies : createDefaultAgencies(timestamp);
  const defaultDeliveryAgencyId = agencies[0]?.id || null;

  const users = (rawStore.users || []).map((user) => {
    const rawRole = typeof (user as { role?: unknown }).role === "string" ? ((user as { role: string }).role as string) : "USER";
    const normalizedRole = rawRole === "ADMIN" ? "PLATFORM_ADMIN" : rawRole === "MANAGER" ? "AGENCY_MANAGER" : rawRole;
    const fallbackAgencyId = normalizedRole === "PLATFORM_ADMIN" ? null : defaultDeliveryAgencyId;
    const hasValidAgency = Boolean(user.agencyId && agencies.some((agency) => agency.id === user.agencyId));
    const normalizedAgencyId = normalizedRole === "PLATFORM_ADMIN" ? null : hasValidAgency ? user.agencyId : fallbackAgencyId;

    return {
      ...user,
      role: normalizedRole,
      agencyId: normalizedAgencyId,
      managedAgencyIds: normalizeManagedAgencyIds(
        agencies,
        normalizedAgencyId,
        normalizedRole,
      ),
      managerPermissions: normalizedRole === "AGENCY_MANAGER" ? normalizeManagerPermissions(user.managerPermissions) : null,
      isActive: user.isActive ?? true,
      createdAt: user.createdAt || timestamp,
      lastPasswordResetAt: user.lastPasswordResetAt || null,
    } as StoredUser;
  });

  return {
    agencies,
    users,
    influencerModels: (rawStore.influencerModels || []).map((model) => {
      const generationModel = normalizeWorkerGenerationModel(model.defaults.generationModel);

      return {
        ...model,
        avatarImageUrl: model.avatarImageUrl || null,
        isActive: model.isActive ?? true,
        defaults: {
          ...model.defaults,
          generationModel,
          resolution: normalizeResolutionForGenerationModel(generationModel, model.defaults.resolution),
          aspectRatio: normalizeBoardAspectRatio(generationModel, model.defaults.aspectRatio),
        },
        allowedGenerationModels: normalizeAllowedGenerationModels((model as { allowedGenerationModels?: unknown }).allowedGenerationModels),
        agencyIds: normalizeInfluencerAgencyIds(
          (model as { agencyIds?: unknown }).agencyIds,
          agencies,
          defaultDeliveryAgencyId ? [defaultDeliveryAgencyId] : [],
        ),
        defaultPlatformWorkflowName:
          typeof (model as { defaultPlatformWorkflowName?: unknown }).defaultPlatformWorkflowName === "string" &&
          (model as { defaultPlatformWorkflowName: string }).defaultPlatformWorkflowName.trim()
            ? (model as { defaultPlatformWorkflowName: string }).defaultPlatformWorkflowName.trim()
            : "Default platform workflow",
        platformWorkflowCount: normalizeWorkflowCount((model as { platformWorkflowCount?: unknown }).platformWorkflowCount, 3),
        customWorkflowCount: normalizeWorkflowCount((model as { customWorkflowCount?: unknown }).customWorkflowCount, 0),
        createdAt: model.createdAt || timestamp,
      };
    }),
    modelAccess: rawStore.modelAccess || [],
    boards: (rawStore.boards || []).map((board) => {
      const generationModel = normalizeWorkerGenerationModel(board.settings.generationModel);
      const quantity = normalizeBoardQuantity(generationModel, board.settings.quantity);
      const requestedSdxlWorkspaceMode = (board.settings as { sdxlWorkspaceMode?: unknown }).sdxlWorkspaceMode === "POSE_MULTIPLIER" ? "POSE_MULTIPLIER" : "DEFAULT";
      const sdxlWorkspaceMode = isPoseMultiplierWorkspace(generationModel, requestedSdxlWorkspaceMode) ? "POSE_MULTIPLIER" : "DEFAULT";
      const isPoseMultiplierWorkspaceLayout = isPoseMultiplierWorkspace(generationModel, sdxlWorkspaceMode);
      const isSdxlPoseMultiplierLayout = sdxlWorkspaceMode === "POSE_MULTIPLIER" && generationModel === "sdxl";
      const poseMultiplierGenerationModel = isSdxlPoseMultiplierLayout
        ? "sdxl"
        : normalizePoseMultiplierGenerationModel(
            (board.settings as { poseMultiplierGenerationModel?: unknown }).poseMultiplierGenerationModel,
            generationModel,
          );
      const posePromptTemplates = normalizePosePromptTemplates(
        (board.settings as { posePromptTemplates?: unknown }).posePromptTemplates,
        (board.settings as { posePromptTemplate?: unknown }).posePromptTemplate,
      );

      return {
        ...board,
        settings: {
          ...board.settings,
          generationModel,
          resolution: normalizeResolutionForGenerationModel(generationModel, board.settings.resolution),
          poseMultiplierResolution: normalizePoseMultiplierResolution(
            ((board.settings as { poseMultiplierResolution?: unknown }).poseMultiplierResolution as string | undefined) ?? board.settings.resolution,
            poseMultiplierGenerationModel,
            isSdxlPoseMultiplierLayout,
          ),
          videoDurationSeconds: normalizeVideoDurationForGenerationModel(
            generationModel,
            (board.settings as { videoDurationSeconds?: unknown }).videoDurationSeconds as number | null | undefined,
          ),
          quality: normalizeQualityForGenerationModel(generationModel, (board.settings as { quality?: unknown }).quality as string),
          aspectRatio: normalizeBoardAspectRatio(
            generationModel,
            board.settings.aspectRatio,
            sdxlWorkspaceMode,
          ),
            quantity: isPoseMultiplierWorkspaceLayout ? 1 : quantity,
          sdxlWorkspaceMode,
            poseMultiplierEnabled: isPoseMultiplierWorkspaceLayout
              ? true
              : quantity === 1 && typeof (board.settings as { poseMultiplierEnabled?: unknown }).poseMultiplierEnabled === "boolean"
                ? board.settings.poseMultiplierEnabled
              : false,
          poseMultiplier: typeof (board.settings as { poseMultiplier?: unknown }).poseMultiplier === "number" ? board.settings.poseMultiplier : 1,
          poseMultiplierGenerationModel,
          faceSwap: typeof (board.settings as { faceSwap?: unknown }).faceSwap === "boolean" ? board.settings.faceSwap : false,
          autoPromptGen: typeof (board.settings as { autoPromptGen?: unknown }).autoPromptGen === "boolean" ? board.settings.autoPromptGen : false,
          autoPromptImage: typeof (board.settings as { autoPromptImage?: unknown }).autoPromptImage === "boolean" ? board.settings.autoPromptImage : false,
          posePromptMode: (board.settings as { posePromptMode?: unknown }).posePromptMode === "CUSTOM" ? "CUSTOM" : "AUTO",
          posePromptTemplate: posePromptTemplates[0] || DEFAULT_POSE_PROMPT_TEMPLATE,
          posePromptTemplates,
        },
        rows: (board.rows || []).map((row, index) => ({
          ...row,
          orderIndex: typeof row.orderIndex === "number" ? row.orderIndex : index,
          label: row.label || `${index + 1}`,
          poseMultiplier: typeof (row as { poseMultiplier?: unknown }).poseMultiplier === "number" ? row.poseMultiplier : 1,
          posePromptTemplates: normalizeOptionalPosePromptTemplates(
            (row as { posePromptTemplates?: unknown }).posePromptTemplates,
            posePromptTemplates[0] || DEFAULT_POSE_PROMPT_TEMPLATE,
          ),
          faceSwap: typeof (row as { faceSwap?: unknown }).faceSwap === "boolean" ? row.faceSwap : false,
        })),
      };
    }),
    assets: rawStore.assets || [],
  };
}

function defaultBoardSettings(model: InfluencerModel): BoardSettings {
  const posePromptTemplates = normalizePosePromptTemplates(undefined, DEFAULT_POSE_PROMPT_TEMPLATE);
  const poseMultiplierGenerationModel = normalizePoseMultiplierGenerationModel(model.defaults.generationModel);

  return {
    generationModel: model.defaults.generationModel,
    resolution: model.defaults.resolution,
    poseMultiplierResolution: normalizePoseMultiplierResolution(model.defaults.resolution, poseMultiplierGenerationModel),
    videoDurationSeconds: normalizeVideoDurationForGenerationModel(model.defaults.generationModel, null),
    quality: normalizeQualityForGenerationModel(model.defaults.generationModel, "medium"),
    aspectRatio: normalizeBoardAspectRatio(model.defaults.generationModel, model.defaults.aspectRatio),
    quantity: normalizeBoardQuantity(model.defaults.generationModel, model.defaults.quantity),
    sdxlWorkspaceMode: "DEFAULT",
    poseMultiplierEnabled: false,
    poseMultiplier: 1,
    poseMultiplierGenerationModel,
    faceSwap: false,
    autoPromptGen: false,
    autoPromptImage: false,
    posePromptMode: "AUTO",
    posePromptTemplate: posePromptTemplates[0] || DEFAULT_POSE_PROMPT_TEMPLATE,
    posePromptTemplates,
    globalReferences: Array.from({ length: 4 }, (_, index) => ({
      id: randomUUID(),
      slotIndex: index,
      label: `Global ${index + 1}`,
      sourceType: "UPLOAD",
      assetId: null,
      assetUrl: null,
      uploadPath: null,
      uploadUrl: null,
    })),
  };
}

export function createDefaultRows(count = 4, defaults?: Pick<BoardSettings, "poseMultiplier" | "faceSwap">): WorkspaceRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    orderIndex: index,
    label: `${index + 1}`,
    prompt: "",
    poseMultiplier: defaults?.poseMultiplier ?? 1,
    posePromptTemplates: null,
    faceSwap: defaults?.faceSwap ?? false,
    reference: null,
    audioReference: null,
    status: "IDLE",
    errorMessage: null,
    outputAssetIds: [],
    lastRunAt: null,
  }));
}

export function createBoardSeed(model: InfluencerModel, ownerId: string, name = "Table 1"): WorkspaceBoard {
  const timestamp = nowIso();
  const settings = defaultBoardSettings(model);
  return {
    id: randomUUID(),
    influencerModelId: model.id,
    ownerId,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings,
    rows: createDefaultRows(4, settings),
  };
}

async function createSeedData(): Promise<StoreData> {
  const timestamp = nowIso();
  const agencies = createDefaultAgencies(timestamp);
  const [northstarAgency, latticeAgency] = agencies;

  const [adminHash, agencyAdminHash, managerHash, userHash, secondAgencyAdminHash, secondManagerHash, secondUserHash, thirdUserHash] = await Promise.all([
    hashPassword("Admin!123"),
    hashPassword("AgencyAdmin!123"),
    hashPassword("Manager!123"),
    hashPassword("User!123"),
    hashPassword("AgencyAdmin2!123"),
    hashPassword("Manager2!123"),
    hashPassword("User2!123"),
    hashPassword("User3!123"),
  ]);

  const users: StoredUser[] = [
    {
      id: randomUUID(),
      email: "admin@autoscale.internal",
      name: "Daria Sloan",
      role: "PLATFORM_ADMIN",
      agencyId: null,
      managedAgencyIds: [],
      managerPermissions: null,
      passwordHash: adminHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "agencyadmin@autoscale.internal",
      name: "Milo Chen",
      role: "AGENCY_ADMIN",
      agencyId: northstarAgency.id,
      managedAgencyIds: [],
      managerPermissions: null,
      passwordHash: agencyAdminHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "manager@autoscale.internal",
      name: "Noah Rhys",
      role: "AGENCY_MANAGER",
      agencyId: northstarAgency.id,
      managedAgencyIds: [northstarAgency.id],
      managerPermissions: normalizeManagerPermissions({ canSuspendUsers: true }),
      passwordHash: managerHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "user@autoscale.internal",
      name: "Kira Wells",
      role: "USER",
      agencyId: northstarAgency.id,
      managedAgencyIds: [],
      managerPermissions: null,
      passwordHash: userHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "agencyadmin2@autoscale.internal",
      name: "Eleni Park",
      role: "AGENCY_ADMIN",
      agencyId: latticeAgency.id,
      managedAgencyIds: [],
      managerPermissions: null,
      passwordHash: secondAgencyAdminHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "manager2@autoscale.internal",
      name: "Rae Mercer",
      role: "AGENCY_MANAGER",
      agencyId: latticeAgency.id,
      managedAgencyIds: [latticeAgency.id],
      managerPermissions: normalizeManagerPermissions({ canSuspendUsers: true }),
      passwordHash: secondManagerHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "user2@autoscale.internal",
      name: "Jordan Vale",
      role: "USER",
      agencyId: latticeAgency.id,
      managedAgencyIds: [],
      managerPermissions: null,
      passwordHash: secondUserHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
    {
      id: randomUUID(),
      email: "user3@autoscale.internal",
      name: "Sam Torres",
      role: "USER",
      agencyId: latticeAgency.id,
      managedAgencyIds: [],
      managerPermissions: null,
      passwordHash: thirdUserHash,
      isActive: true,
      createdAt: timestamp,
      lastPasswordResetAt: null,
    },
  ];

  const northstarManager = users.find((entry) => entry.email === "manager@autoscale.internal");
  const latticeManager = users.find((entry) => entry.email === "manager2@autoscale.internal");
  const northstarAgencyAdmin = users.find((entry) => entry.email === "agencyadmin@autoscale.internal");
  const latticeAgencyAdmin = users.find((entry) => entry.email === "agencyadmin2@autoscale.internal");
  const primaryEmployee = users.find((entry) => entry.email === "user@autoscale.internal");
  const secondEmployee = users.find((entry) => entry.email === "user2@autoscale.internal");
  const thirdEmployee = users.find((entry) => entry.email === "user3@autoscale.internal");

  const influencerModels: InfluencerModel[] = [
    {
      id: randomUUID(),
      slug: "ava-sterling",
      name: "Ava Sterling",
      handle: "@ava.sterling",
      archetype: "Luxury editorial",
      description: "Polished fashion-led outputs tuned for premium lifestyle sets and controlled campaign styling.",
      avatarImageUrl: null,
      accentFrom: "from-lime-300",
      accentTo: "to-emerald-400",
      avatarLabel: "AS",
      isActive: true,
      agencyIds: [northstarAgency.id],
      defaultPlatformWorkflowName: "Default platform workflow",
      platformWorkflowCount: 3,
      customWorkflowCount: 0,
      defaults: {
        generationModel: "nb_pro",
        resolution: "2k",
        aspectRatio: "3:4",
        quantity: 4,
        promptPrefix: "Luxury editorial framing, grounded realism, premium wardrobe direction.",
      },
      allowedGenerationModels: [...SUPPORTED_WORKER_GENERATION_MODELS],
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      slug: "sora-vale",
      name: "Sora Vale",
      handle: "@sora.vale",
      archetype: "Street kinetic",
      description: "Sharper motion, urban energy, and modern campaign poses designed for high-frequency social output.",
      avatarImageUrl: null,
      accentFrom: "from-sky-300",
      accentTo: "to-cyan-400",
      avatarLabel: "SV",
      isActive: true,
      agencyIds: [northstarAgency.id],
      defaultPlatformWorkflowName: "Default platform workflow",
      platformWorkflowCount: 3,
      customWorkflowCount: 0,
      defaults: {
        generationModel: "nb2",
        resolution: "1k",
        aspectRatio: "4:5",
        quantity: 4,
        promptPrefix: "Modern movement, social-first crop, tactile city atmosphere.",
      },
      allowedGenerationModels: [...SUPPORTED_WORKER_GENERATION_MODELS],
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      slug: "lena-north",
      name: "Lena North",
      handle: "@lena.north",
      archetype: "Beauty close-up",
      description: "Closer portrait-led coverage with clean lighting and consistent facial framing across reference reuse.",
      avatarImageUrl: null,
      accentFrom: "from-amber-300",
      accentTo: "to-orange-400",
      avatarLabel: "LN",
      isActive: true,
      agencyIds: [latticeAgency.id],
      defaultPlatformWorkflowName: "Default platform workflow",
      platformWorkflowCount: 3,
      customWorkflowCount: 0,
      defaults: {
        generationModel: "sd_4_5",
        resolution: "2k",
        aspectRatio: "1:1",
        quantity: 4,
        promptPrefix: "Precision beauty styling, clean skin detail, premium campaign finish.",
      },
      allowedGenerationModels: [...SUPPORTED_WORKER_GENERATION_MODELS],
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      slug: "mara-quinn",
      name: "Mara Quinn",
      handle: "@mara.quinn",
      archetype: "Nightlife cinematic",
      description: "High-contrast evening scenes, social glamour, and cinematic lounge compositions.",
      avatarImageUrl: null,
      accentFrom: "from-fuchsia-300",
      accentTo: "to-rose-400",
      avatarLabel: "MQ",
      isActive: true,
      agencyIds: [latticeAgency.id],
      defaultPlatformWorkflowName: "Default platform workflow",
      platformWorkflowCount: 3,
      customWorkflowCount: 0,
      defaults: {
        generationModel: "kling_o1",
        resolution: "1k",
        aspectRatio: "9:16",
        quantity: 4,
        promptPrefix: "Night-time premium mood, cinematic highlights, tactile depth.",
      },
      allowedGenerationModels: [...SUPPORTED_WORKER_GENERATION_MODELS],
      createdAt: timestamp,
    },
  ];

  const modelAccess: ModelAccessAssignment[] = [
    ...influencerModels.slice(0, 2).map((model) => ({
      id: randomUUID(),
      userId: northstarManager?.id || users[2].id,
      influencerModelId: model.id,
      grantedById: northstarAgencyAdmin?.id || users[1].id,
      createdAt: timestamp,
    })),
    ...influencerModels.slice(0, 2).map((model) => ({
      id: randomUUID(),
      userId: primaryEmployee?.id || users[3].id,
      influencerModelId: model.id,
      grantedById: northstarAgencyAdmin?.id || users[1].id,
      createdAt: timestamp,
    })),
    {
      id: randomUUID(),
      userId: latticeManager?.id || users[5].id,
      influencerModelId: influencerModels[2].id,
      grantedById: latticeAgencyAdmin?.id || users[4].id,
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      userId: latticeManager?.id || users[5].id,
      influencerModelId: influencerModels[3].id,
      grantedById: latticeAgencyAdmin?.id || users[4].id,
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      userId: secondEmployee?.id || users[6].id,
      influencerModelId: influencerModels[2].id,
      grantedById: latticeAgencyAdmin?.id || users[4].id,
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      userId: secondEmployee?.id || users[6].id,
      influencerModelId: influencerModels[3].id,
      grantedById: latticeAgencyAdmin?.id || users[4].id,
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      userId: thirdEmployee?.id || users[7].id,
      influencerModelId: influencerModels[3].id,
      grantedById: latticeAgencyAdmin?.id || users[4].id,
      createdAt: timestamp,
    },
    {
      id: randomUUID(),
      userId: thirdEmployee?.id || users[7].id,
      influencerModelId: influencerModels[2].id,
      grantedById: latticeAgencyAdmin?.id || users[4].id,
      createdAt: timestamp,
    },
  ];

  return {
    agencies,
    users,
    influencerModels,
    modelAccess,
    boards: [],
    assets: [],
  };
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(path.dirname(env.dataStorePath), { recursive: true });
  try {
    await fs.access(env.dataStorePath);
  } catch {
    const seed = await createSeedData();
    await fs.writeFile(env.dataStorePath, JSON.stringify(seed, null, 2), "utf8");
  }
}

let writeChain = Promise.resolve();

export async function readStore(): Promise<StoreData> {
  await ensureStoreFile();
  const raw = await fs.readFile(env.dataStorePath, "utf8");
  return cloneData(normalizeStoreData(JSON.parse(raw) as Partial<StoreData>));
}

export async function writeStore(nextData: StoreData): Promise<void> {
  await ensureStoreFile();
  writeChain = writeChain.then(() => fs.writeFile(env.dataStorePath, JSON.stringify(nextData, null, 2), "utf8"));
  await writeChain;
}

export async function updateStore(mutator: (store: StoreData) => Promise<StoreData> | StoreData): Promise<StoreData> {
  const current = await readStore();
  const updated = await mutator(current);
  await writeStore(updated);
  return cloneData(updated);
}

export async function resetStoreWithSeed(): Promise<StoreData> {
  const seed = await createSeedData();
  await writeStore(seed);
  return cloneData(seed);
}
