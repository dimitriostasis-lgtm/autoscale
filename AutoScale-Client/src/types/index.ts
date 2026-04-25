export type Role = "PLATFORM_ADMIN" | "AGENCY_ADMIN" | "AGENCY_MANAGER" | "USER";

export type UserAccessScope = "PLATFORM_ADMIN_ACCESS" | "AGENCY_ADMIN_ACCESS" | "AGENCY_MANAGER_ACCESS" | "DIRECT_ASSIGNMENT";

export interface ManagerPermissions {
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
  canResetPasswords: boolean;
  canManageAssignments: boolean;
  canManageCredits: boolean;
}

export type GenerationStatus = "IDLE" | "QUEUED" | "GENERATING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED";

export type ReferenceSourceType = "UPLOAD" | "ASSET";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  agencyId: string | null;
  agencyName: string | null;
  managedAgencyIds: string[];
  managedAgencyNames: string[];
  managerPermissions: ManagerPermissions | null;
  accessScope: UserAccessScope;
  assignedModelIds: string[];
  effectiveModelIds: string[];
  lastPasswordResetAt: string | null;
}

export interface AgencyRecord {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  memberCount: number;
  adminCount: number;
  managerCount: number;
  userCount: number;
  activeCount: number;
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
  generationModel: string;
  resolution: string;
  aspectRatio: string;
  quantity: number;
  width: number | null;
  height: number | null;
  isSyntheticFailure: boolean;
  failureLabel: string | null;
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
  asset?: GeneratedAsset | null;
}

export interface BoardSettings {
  generationModel: string;
  resolution: string;
  quality: string;
  aspectRatio: string;
  quantity: number;
  poseMultiplierEnabled: boolean;
  poseMultiplier: number;
  faceSwap: boolean;
  autoPromptGen: boolean;
  autoPromptImage: boolean;
  posePromptMode: "AUTO" | "CUSTOM";
  posePromptTemplate: string;
  posePromptTemplates: string[];
  globalReferences: ReferenceSelection[];
}

export interface WorkspaceRow {
  id: string;
  orderIndex: number;
  label: string;
  prompt: string;
  poseMultiplier: number;
  posePromptTemplates: string[] | null;
  faceSwap: boolean;
  reference: ReferenceSelection | null;
  status: GenerationStatus;
  errorMessage: string | null;
  outputAssets: GeneratedAsset[];
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
  owner: UserRecord | null;
}

export interface InfluencerDefaults {
  generationModel: string;
  resolution: string;
  aspectRatio: string;
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
  assignedAgencyIds: string[];
  assignedAgencyNames: string[];
  agencyAccessCount: number;
  defaultPlatformWorkflowName: string;
  platformWorkflowCount: number;
  customWorkflowCount: number;
  defaults: InfluencerDefaults;
  allowedGenerationModels: string[];
  canAccess: boolean;
  boardCount: number;
  galleryCount: number;
  outputCount: number;
  boards: WorkspaceBoard[];
}

export interface AuthPayload {
  user: UserRecord;
  csrfToken: string;
}