export type Role = "PLATFORM_ADMIN" | "AGENCY_ADMIN" | "AGENCY_MANAGER" | "USER";

export type UserAccessScope = "PLATFORM_ADMIN_ACCESS" | "AGENCY_ADMIN_ACCESS" | "AGENCY_MANAGER_ACCESS" | "DIRECT_ASSIGNMENT";

export interface ManagerPermissions {
  canSuspendUsers: boolean;
  canDeleteUsers: boolean;
  canResetPasswords: boolean;
  canManageAssignments: boolean;
  canManageCredits: boolean;
}

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canSuspendUsers: true,
  canDeleteUsers: false,
  canResetPasswords: false,
  canManageAssignments: false,
  canManageCredits: false,
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

export const IMAGE_WORKER_GENERATION_MODELS = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2", "sdxl"] as const;
export const VIDEO_WORKER_GENERATION_MODELS = ["sd_2_0", "sd_2_0_fast", "kling_3_0", "kling_motion_control", "grok_imagine"] as const;
export const VIDEO_NSFW_WORKER_GENERATION_MODELS = ["sd_2_0", "sd_2_0_fast", "grok_imagine"] as const;
export const SUPPORTED_WORKER_GENERATION_MODELS = [...IMAGE_WORKER_GENERATION_MODELS, ...VIDEO_WORKER_GENERATION_MODELS] as const;

export type WorkerGenerationModel = (typeof SUPPORTED_WORKER_GENERATION_MODELS)[number];

export const SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS = IMAGE_WORKER_GENERATION_MODELS.filter(
  (generationModel): generationModel is Exclude<(typeof IMAGE_WORKER_GENERATION_MODELS)[number], "sdxl"> => generationModel !== "sdxl",
);

export type PoseMultiplierGenerationModel = (typeof SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS)[number];

export function normalizePoseMultiplierGenerationModel(value: unknown, fallbackValue?: unknown): PoseMultiplierGenerationModel {
  if (SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS.includes(value as PoseMultiplierGenerationModel)) {
    return value as PoseMultiplierGenerationModel;
  }

  if (SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS.includes(fallbackValue as PoseMultiplierGenerationModel)) {
    return fallbackValue as PoseMultiplierGenerationModel;
  }

  return SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS[0];
}

export function getMaxBoardQuantityForGenerationModel(generationModel: WorkerGenerationModel | string): number {
  if (VIDEO_WORKER_GENERATION_MODELS.includes(generationModel as (typeof VIDEO_WORKER_GENERATION_MODELS)[number])) {
    return 1;
  }

  return generationModel === "sdxl" ? 20 : 4;
}

export const SUPPORTED_WORKER_RESOLUTIONS = ["480p", "720p", "1080p", "1k", "2k", "4k"] as const;

export type WorkerResolution = (typeof SUPPORTED_WORKER_RESOLUTIONS)[number];

export function getAllowedResolutionsForGenerationModel(generationModel: WorkerGenerationModel | string): WorkerResolution[] {
  if (generationModel === "sdxl") {
    return ["1k", "2k"];
  }

  if (generationModel === "sd_4_5") {
    return ["2k", "4k"];
  }

  if (generationModel === "kling_o1") {
    return ["1k", "2k"];
  }

  if (generationModel === "sd_2_0" || generationModel === "sd_2_0_fast") {
    return ["480p", "720p", "1080p"];
  }

  if (generationModel === "kling_3_0") {
    return ["720p", "1080p", "4k"];
  }

  if (generationModel === "kling_motion_control") {
    return ["720p", "1080p"];
  }

  if (generationModel === "grok_imagine") {
    return ["480p", "720p"];
  }

  return ["1k", "2k", "4k"];
}

export function normalizeResolutionForGenerationModel(
  generationModel: WorkerGenerationModel | string,
  resolution: WorkerResolution | string,
): WorkerResolution {
  const allowedResolutions = getAllowedResolutionsForGenerationModel(generationModel);

  if (allowedResolutions.includes(resolution as WorkerResolution)) {
    return resolution as WorkerResolution;
  }

  const requestedIndex = SUPPORTED_WORKER_RESOLUTIONS.indexOf(resolution as WorkerResolution);
  if (requestedIndex !== -1) {
    const upgradedResolution = allowedResolutions.find((option) => SUPPORTED_WORKER_RESOLUTIONS.indexOf(option) >= requestedIndex);
    if (upgradedResolution) {
      return upgradedResolution;
    }
  }

  return allowedResolutions[allowedResolutions.length - 1] || SUPPORTED_WORKER_RESOLUTIONS[0];
}

export const SUPPORTED_WORKER_QUALITIES = ["low", "medium", "high"] as const;

export type WorkerQuality = (typeof SUPPORTED_WORKER_QUALITIES)[number];

export function getAllowedQualitiesForGenerationModel(generationModel: WorkerGenerationModel | string): WorkerQuality[] {
  return generationModel === "gpt_2" ? [...SUPPORTED_WORKER_QUALITIES] : ["medium"];
}

export function normalizeQualityForGenerationModel(
  generationModel: WorkerGenerationModel | string,
  quality: WorkerQuality | string,
): WorkerQuality {
  const allowedQualities = getAllowedQualitiesForGenerationModel(generationModel);

  if (allowedQualities.includes(quality as WorkerQuality)) {
    return quality as WorkerQuality;
  }

  return allowedQualities[0] || "medium";
}

export function getAllowedVideoDurationsForGenerationModel(generationModel: WorkerGenerationModel | string): number[] {
  if (generationModel === "kling_motion_control") {
    return [];
  }

  if (generationModel === "sd_2_0" || generationModel === "sd_2_0_fast") {
    return Array.from({ length: 12 }, (_, index) => index + 4);
  }

  if (generationModel === "kling_3_0" || generationModel === "grok_imagine") {
    return Array.from({ length: 13 }, (_, index) => index + 3);
  }

  return [];
}

export function normalizeVideoDurationForGenerationModel(
  generationModel: WorkerGenerationModel | string,
  duration: number | null | undefined,
): number | null {
  const allowedDurations = getAllowedVideoDurationsForGenerationModel(generationModel);

  if (!allowedDurations.length) {
    return null;
  }

  if (typeof duration === "number" && allowedDurations.includes(duration)) {
    return duration;
  }

  return allowedDurations[0] ?? null;
}

export const DEFAULT_POSE_PROMPT_TEMPLATE = "Keep the same framing and styling while varying the body pose for each multiplied shot.";

export function normalizePosePromptTemplates(templates: unknown, fallbackTemplate?: unknown): string[] {
  const fallbackPrompt =
    typeof fallbackTemplate === "string" && fallbackTemplate.trim() ? fallbackTemplate.trim() : DEFAULT_POSE_PROMPT_TEMPLATE;

  const normalizedTemplates = Array.isArray(templates)
    ? templates
        .filter((template): template is string => typeof template === "string")
        .slice(0, 4)
        .map((template) => template.trim())
    : [];

  const basePrompt = normalizedTemplates.find(Boolean) || fallbackPrompt;

  return Array.from({ length: 4 }, (_, index) => normalizedTemplates[index] || basePrompt);
}

export function normalizeOptionalPosePromptTemplates(templates: unknown, fallbackTemplate?: unknown): string[] | null {
  if (!Array.isArray(templates)) {
    return null;
  }

  return normalizePosePromptTemplates(templates, fallbackTemplate);
}

export const SUPPORTED_WORKER_ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:4", "4:3", "2:3", "3:2", "5:4", "4:5", "21:9"] as const;

export type WorkerAspectRatio = (typeof SUPPORTED_WORKER_ASPECT_RATIOS)[number];

export function getAllowedAspectRatiosForGenerationModel(generationModel: WorkerGenerationModel | string): WorkerAspectRatio[] {
  return generationModel === "sdxl" ? SUPPORTED_WORKER_ASPECT_RATIOS.filter((option) => option !== "auto") : [...SUPPORTED_WORKER_ASPECT_RATIOS];
}

export function normalizeAspectRatioForGenerationModel(
  generationModel: WorkerGenerationModel | string,
  aspectRatio: WorkerAspectRatio | string,
): WorkerAspectRatio {
  const allowedAspectRatios = getAllowedAspectRatiosForGenerationModel(generationModel);

  if (allowedAspectRatios.includes(aspectRatio as WorkerAspectRatio)) {
    return aspectRatio as WorkerAspectRatio;
  }

  return allowedAspectRatios[0] || "1:1";
}

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
  defaultPlatformWorkflowName?: string;
  platformWorkflowCount?: number;
  customWorkflowCount?: number;
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
  videoDurationSeconds: number | null;
  quality: WorkerQuality;
  aspectRatio: WorkerAspectRatio;
  quantity: number;
  poseMultiplierEnabled: boolean;
  poseMultiplier: number;
  poseMultiplierGenerationModel: PoseMultiplierGenerationModel;
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