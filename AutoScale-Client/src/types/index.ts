export type Role = "PLATFORM_ADMIN" | "AGENCY_ADMIN" | "AGENCY_MANAGER" | "USER";

export type UserAccessScope = "PLATFORM_ADMIN_ACCESS" | "AGENCY_ADMIN_ACCESS" | "AGENCY_MANAGER_ACCESS" | "DIRECT_ASSIGNMENT";

export interface ManagerPermissions {
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
  canResetPasswords: boolean;
  canManageAssignments: boolean;
  canManageCredits: boolean;
}

export interface AgencyBillingSettings {
  monthlySubscriptionPrice: number;
  includedMonthlyCredits: number;
  aiInfluencerAllowance: number;
  workspaceTabAllowance: number;
  parallelRowGenerations: number;
  teamSeatAllowance: number;
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
  billingSettings: AgencyBillingSettings;
  memberCount: number;
  adminCount: number;
  managerCount: number;
  userCount: number;
  activeCount: number;
}

export interface PlatformNotification {
  id: string;
  type: string;
  agencyId: string | null;
  agencyName: string | null;
  requesterId: string;
  requesterName: string;
  requesterEmail: string | null;
  message: string;
  createdAt: string;
  draftInfluencerName?: string | null;
  draftInfluencerHandle?: string | null;
  draftPrompt?: string | null;
  draftPortraitUrls?: string[] | null;
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
  poseMultiplierResolution: string;
  videoDurationSeconds: number | null;
  quality: string;
  aspectRatio: string;
  quantity: number;
  sdxlWorkspaceMode: "DEFAULT" | "POSE_MULTIPLIER" | "FACE_SWAP";
  poseMultiplierEnabled: boolean;
  poseMultiplier: number;
  poseMultiplierGenerationModel: string;
  upscale: boolean;
  upscaleFactor: number;
  upscaleDenoise: number;
  faceSwap: boolean;
  faceSwapModelStrength: number;
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
  upscale: boolean;
  faceSwap: boolean;
  reference: ReferenceSelection | null;
  audioReference: ReferenceSelection | null;
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

export interface HiggsfieldModelCost {
  generationModel: string;
  higgsfieldModelId: string;
  label: string;
  unit: string;
  credits: number | null;
  resolution?: string | null;
  quality?: string | null;
  notes: string;
}

export interface HiggsfieldAccountConnection {
  influencerModelId: string;
  influencerModelName: string;
  influencerModelHandle: string;
  connected: boolean;
  status: string;
  email: string | null;
  credits: number | null;
  subscriptionPlanType: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  costTable: HiggsfieldModelCost[];
}

export interface AuthPayload {
  user: UserRecord;
  csrfToken: string;
}
