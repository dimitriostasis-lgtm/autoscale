export type Role = "PLATFORM_ADMIN" | "AGENCY_ADMIN" | "AGENCY_MANAGER" | "USER";

export type UserAccessScope = "PLATFORM_ADMIN_ACCESS" | "AGENCY_ADMIN_ACCESS" | "AGENCY_MANAGER_ACCESS" | "DIRECT_ASSIGNMENT";

export interface ManagerPermissions {
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
  canResetPasswords: boolean;
  canManageAssignments: boolean;
}

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canSuspendUsers: true,
  canDeleteUsers: false,
  canResetPasswords: false,
  canManageAssignments: false,
};

export type GenerationStatus =
  | "IDLE"
  | "QUEUED"
  | "GENERATING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED";

export type ReferenceSourceType = "UPLOAD" | "ASSET";

export type WorkerGenerationModel = "nb_pro" | "nb2" | "sd_4_5" | "kling_o1";

export type WorkerResolution = "1k" | "2k" | "4k";

export type WorkerAspectRatio =
  | "auto"
  | "1:1"
  | "16:9"
  | "9:16"
  | "3:4"
  | "4:3"
  | "2:3"
  | "3:2"
  | "5:4"
  | "4:5"
  | "21:9";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  agencyId: string | null;
  managedAgencyIds: string[];
  managerPermissions: ManagerPermissions | null;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  lastPasswordResetAt: string | null;
}

export interface Agency {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface InfluencerDefaults {
  generationModel: WorkerGenerationModel;
  resolution: WorkerResolution;
  aspectRatio: WorkerAspectRatio;
  quantity: number;
  promptPrefix: string;
}

export interface InfluencerModel {
  id: string;
  slug: string;
  name: string;
  handle: string;
  archetype: string;
  description: string;
  avatarImageUrl: string | null;
  accentFrom: string;
  accentTo: string;
  avatarLabel: string;
  isActive: boolean;
  agencyIds: string[];
  defaults: InfluencerDefaults;
  allowedGenerationModels: WorkerGenerationModel[];
  createdAt: string;
}

export interface ModelAccessAssignment {
  id: string;
  userId: string;
  influencerModelId: string;
  grantedById: string;
  createdAt: string;
}

export interface ReferenceSelection {
  id: string;
  slotIndex: number;
  label: string;
  sourceType: ReferenceSourceType;
  assetId?: string | null;
  assetUrl?: string | null;
  uploadPath?: string | null;
  uploadUrl?: string | null;
}

export interface BoardSettings {
  generationModel: WorkerGenerationModel;
  resolution: WorkerResolution;
  aspectRatio: WorkerAspectRatio;
  quantity: number;
  poseMultiplierEnabled: boolean;
  poseMultiplier: number;
  faceSwap: boolean;
  autoPromptGen: boolean;
  autoPromptImage: boolean;
  posePromptMode: "AUTO" | "CUSTOM";
  posePromptTemplate: string;
  globalReferences: ReferenceSelection[];
}

export interface WorkspaceRow {
  id: string;
  orderIndex: number;
  label: string;
  prompt: string;
  poseMultiplier: number;
  faceSwap: boolean;
  reference: ReferenceSelection | null;
  status: GenerationStatus;
  errorMessage: string | null;
  outputAssetIds: string[];
  lastRunAt: string | null;
}

export interface WorkspaceBoard {
  id: string;
  influencerModelId: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: BoardSettings;
  rows: WorkspaceRow[];
}

export interface GeneratedAsset {
  id: string;
  influencerModelId: string;
  boardId: string;
  rowId: string;
  createdById: string;
  fileName: string;
  filePath: string;
  url: string;
  promptSnapshot: string;
  generationModel: WorkerGenerationModel;
  resolution: WorkerResolution;
  aspectRatio: WorkerAspectRatio;
  quantity: number;
  width: number | null;
  height: number | null;
  isSyntheticFailure: boolean;
  failureLabel: string | null;
  createdAt: string;
}

export interface StoreData {
  agencies: Agency[];
  users: StoredUser[];
  influencerModels: InfluencerModel[];
  modelAccess: ModelAccessAssignment[];
  boards: WorkspaceBoard[];
  assets: GeneratedAsset[];
}

export interface UploadRecord {
  fileName: string;
  filePath: string;
  url: string;
}