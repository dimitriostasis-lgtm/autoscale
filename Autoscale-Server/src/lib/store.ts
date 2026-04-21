import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import { DEFAULT_MANAGER_PERMISSIONS } from "../types/domain.js";
import { hashPassword } from "./auth.js";
import type {
  Agency,
  BoardSettings,
  InfluencerModel,
  ModelAccessAssignment,
  ManagerPermissions,
  StoreData,
  StoredUser,
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
    return [...defaultAgencyIds];
  }

  const validAgencyIds = new Set(agencies.map((agency) => agency.id));
  return Array.from(new Set(value.filter((agencyId): agencyId is string => typeof agencyId === "string" && validAgencyIds.has(agencyId))));
}

function normalizeManagedAgencyIds(
  value: unknown,
  agencies: Agency[],
  primaryAgencyId: string | null,
  role: string,
): string[] {
  if (role !== "AGENCY_MANAGER") {
    return [];
  }

  const validAgencyIds = new Set(agencies.map((agency) => agency.id));
  const normalized = Array.isArray(value)
    ? value.filter((agencyId): agencyId is string => typeof agencyId === "string" && validAgencyIds.has(agencyId))
    : [];

  if (primaryAgencyId && validAgencyIds.has(primaryAgencyId)) {
    normalized.unshift(primaryAgencyId);
  }

  return Array.from(new Set(normalized));
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
        (user as { managedAgencyIds?: unknown }).managedAgencyIds,
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
    influencerModels: (rawStore.influencerModels || []).map((model) => ({
      ...model,
      avatarImageUrl: model.avatarImageUrl || null,
      isActive: model.isActive ?? true,
      agencyIds: normalizeInfluencerAgencyIds(
        (model as { agencyIds?: unknown }).agencyIds,
        agencies,
        agencies.map((agency) => agency.id),
      ),
      createdAt: model.createdAt || timestamp,
    })),
    modelAccess: rawStore.modelAccess || [],
    boards: rawStore.boards || [],
    assets: rawStore.assets || [],
  };
}

function defaultBoardSettings(model: InfluencerModel): BoardSettings {
  return {
    generationModel: model.defaults.generationModel,
    resolution: model.defaults.resolution,
    aspectRatio: model.defaults.aspectRatio,
    quantity: model.defaults.quantity,
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

export function createDefaultRows(count = 4): WorkspaceRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: randomUUID(),
    orderIndex: index,
    label: `${index + 1}`,
    prompt: "",
    reference: null,
    status: "IDLE",
    errorMessage: null,
    outputAssetIds: [],
    lastRunAt: null,
  }));
}

export function createBoardSeed(model: InfluencerModel, ownerId: string, name = "Table 1"): WorkspaceBoard {
  const timestamp = nowIso();
  return {
    id: randomUUID(),
    influencerModelId: model.id,
    ownerId,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: defaultBoardSettings(model),
    rows: createDefaultRows(4),
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
      agencyIds: [northstarAgency.id, latticeAgency.id],
      defaults: {
        generationModel: "nb_pro",
        resolution: "2k",
        aspectRatio: "3:4",
        quantity: 4,
        promptPrefix: "Luxury editorial framing, grounded realism, premium wardrobe direction.",
      },
      allowedGenerationModels: ["nb_pro", "nb2", "sd_4_5"],
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
      defaults: {
        generationModel: "nb2",
        resolution: "1k",
        aspectRatio: "4:5",
        quantity: 4,
        promptPrefix: "Modern movement, social-first crop, tactile city atmosphere.",
      },
      allowedGenerationModels: ["nb2", "nb_pro", "kling_o1"],
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
      agencyIds: [northstarAgency.id, latticeAgency.id],
      defaults: {
        generationModel: "sd_4_5",
        resolution: "2k",
        aspectRatio: "1:1",
        quantity: 4,
        promptPrefix: "Precision beauty styling, clean skin detail, premium campaign finish.",
      },
      allowedGenerationModels: ["sd_4_5", "nb_pro"],
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
      defaults: {
        generationModel: "kling_o1",
        resolution: "1k",
        aspectRatio: "9:16",
        quantity: 4,
        promptPrefix: "Night-time premium mood, cinematic highlights, tactile depth.",
      },
      allowedGenerationModels: ["kling_o1", "nb2"],
      createdAt: timestamp,
    },
  ];

  const modelAccess: ModelAccessAssignment[] = [
    ...influencerModels.slice(0, 3).map((model) => ({
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
      influencerModelId: influencerModels[0].id,
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