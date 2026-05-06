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

export const DEFAULT_AGENCY_BILLING_SETTINGS: AgencyBillingSettings = {
  monthlySubscriptionPrice: 7500,
  includedMonthlyCredits: 30000,
  aiInfluencerAllowance: 2,
  workspaceTabAllowance: 9,
  parallelRowGenerations: 8,
  teamSeatAllowance: 4,
};

function normalizeAllowanceValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

export function normalizeAgencyBillingSettings(value: Partial<AgencyBillingSettings> | null | undefined): AgencyBillingSettings {
  return {
    monthlySubscriptionPrice: normalizeAllowanceValue(value?.monthlySubscriptionPrice, DEFAULT_AGENCY_BILLING_SETTINGS.monthlySubscriptionPrice),
    includedMonthlyCredits: normalizeAllowanceValue(value?.includedMonthlyCredits, DEFAULT_AGENCY_BILLING_SETTINGS.includedMonthlyCredits),
    aiInfluencerAllowance: normalizeAllowanceValue(value?.aiInfluencerAllowance, DEFAULT_AGENCY_BILLING_SETTINGS.aiInfluencerAllowance),
    workspaceTabAllowance: normalizeAllowanceValue(value?.workspaceTabAllowance, DEFAULT_AGENCY_BILLING_SETTINGS.workspaceTabAllowance),
    parallelRowGenerations: normalizeAllowanceValue(value?.parallelRowGenerations, DEFAULT_AGENCY_BILLING_SETTINGS.parallelRowGenerations),
    teamSeatAllowance: normalizeAllowanceValue(value?.teamSeatAllowance, DEFAULT_AGENCY_BILLING_SETTINGS.teamSeatAllowance),
  };
}

export const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  canSuspendUsers: true,
  canDeleteUsers: false,
  canResetPasswords: false,
  canManageAssignments: false,
  canManageCredits: false,
};

export const DEFAULT_FACE_SWAP_MODEL_STRENGTH = 0.5;
export const DEFAULT_UPSCALE_FACTOR = 1;
export const DEFAULT_UPSCALE_DENOISE = 0;

export function normalizeFaceSwapModelStrength(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0.3, Math.min(0.6, value)) : DEFAULT_FACE_SWAP_MODEL_STRENGTH;
}

export function normalizeUpscaleFactor(value: unknown): number {
  return value === 1 || value === 1.5 || value === 2 ? value : DEFAULT_UPSCALE_FACTOR;
}

export function normalizeUpscaleDenoise(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(0.4, value)) : DEFAULT_UPSCALE_DENOISE;
}

export type GenerationStatus =
  | "IDLE"
  | "QUEUED"
  | "GENERATING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED";

export type ReferenceSourceType = "UPLOAD" | "ASSET";

export const IMAGE_WORKER_GENERATION_MODELS = ["nb_pro", "nb2", "sd_4_5", "gpt_2", "flux_2", "kling_o1", "flux_kontext", "z_image", "sdxl"] as const;
export const VIDEO_WORKER_GENERATION_MODELS = ["sd_2_0", "sd_2_0_fast", "kling_3_0", "kling_motion_control", "grok_imagine"] as const;
export const VIDEO_NSFW_WORKER_GENERATION_MODELS = ["sd_2_0", "sd_2_0_fast", "grok_imagine"] as const;
export const VOICE_WORKER_GENERATION_MODELS = ["eleven_v3"] as const;
export const SUPPORTED_WORKER_GENERATION_MODELS = [...IMAGE_WORKER_GENERATION_MODELS, ...VIDEO_WORKER_GENERATION_MODELS, ...VOICE_WORKER_GENERATION_MODELS] as const;

export type WorkerGenerationModel = (typeof SUPPORTED_WORKER_GENERATION_MODELS)[number];

export const SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS = ["nb_pro", "nb2", "sd_4_5", "gpt_2", "flux_2", "kling_o1", "flux_kontext"] as const;

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
  if (
    VIDEO_WORKER_GENERATION_MODELS.includes(generationModel as (typeof VIDEO_WORKER_GENERATION_MODELS)[number]) ||
    VOICE_WORKER_GENERATION_MODELS.includes(generationModel as (typeof VOICE_WORKER_GENERATION_MODELS)[number])
  ) {
    return 1;
  }

  return generationModel === "sdxl" ? 20 : 4;
}

export const SUPPORTED_WORKER_RESOLUTIONS = ["480p", "720p", "1080p", "1k", "2k", "4k"] as const;
export const SUPPORTED_POSE_MULTIPLIER_RESOLUTIONS = ["2k", "4k"] as const;

export type WorkerResolution = (typeof SUPPORTED_WORKER_RESOLUTIONS)[number];
export type PoseMultiplierResolution = WorkerResolution;

export function getAllowedResolutionsForGenerationModel(generationModel: WorkerGenerationModel | string): WorkerResolution[] {
  if (generationModel === "sdxl") {
    return ["1k", "2k"];
  }

  if (generationModel === "nb_pro" || generationModel === "nb2") {
    return ["1k", "2k", "4k"];
  }

  if (generationModel === "gpt_2") {
    return ["1k", "2k", "4k"];
  }

  if (generationModel === "sd_4_5") {
    return ["2k", "4k"];
  }

  if (generationModel === "flux_2") {
    return ["1k", "2k"];
  }

  if (generationModel === "flux_kontext" || generationModel === "z_image") {
    return [];
  }

  if (generationModel === "kling_o1") {
    return ["1k", "2k"];
  }

  if (generationModel === "sd_2_0" || generationModel === "sd_2_0_fast") {
    return ["480p", "720p", "1080p"];
  }

  if (generationModel === "kling_3_0") {
    return ["1080p", "4k"];
  }

  if (generationModel === "kling_motion_control") {
    return ["1080p"];
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
  if (generationModel === "gpt_2" && resolution.toLowerCase() === "3k") {
    return "2k";
  }

  const allowedResolutions = getAllowedResolutionsForGenerationModel(generationModel);

  if (!allowedResolutions.length) {
    return "1k";
  }

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

export function normalizePoseMultiplierResolution(
  resolution: WorkerResolution | string | null | undefined,
  generationModel?: WorkerGenerationModel | string,
  isSdxlPoseMultiplierLayout = false,
): PoseMultiplierResolution {
  if (generationModel === "gpt_2" && resolution?.toLowerCase() === "3k") {
    return "2k";
  }

  const allowedResolutions = isSdxlPoseMultiplierLayout
    ? [...SUPPORTED_POSE_MULTIPLIER_RESOLUTIONS]
    : getAllowedResolutionsForGenerationModel(generationModel ?? SUPPORTED_POSE_MULTIPLIER_GENERATION_MODELS[0]);

  if (!allowedResolutions.length) {
    return "1k";
  }

  if (allowedResolutions.includes(resolution as WorkerResolution)) {
    return resolution as PoseMultiplierResolution;
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

  if (generationModel === "kling_3_0") {
    return Array.from({ length: 13 }, (_, index) => index + 3);
  }

  if (generationModel === "grok_imagine") {
    return [6, 10];
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

const HIGGSFIELD_ASPECT_RATIOS_BY_WORKER_MODEL: Record<string, WorkerAspectRatio[]> = {
  nb_pro: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"],
  nb2: ["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"],
  sd_4_5: ["1:1", "4:3", "16:9", "3:2", "21:9", "3:4", "9:16", "2:3"],
  gpt_2: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
  flux_2: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  kling_o1: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"],
  flux_kontext: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  z_image: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  sd_2_0: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
  sd_2_0_fast: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
  kling_3_0: ["16:9", "9:16", "1:1"],
  grok_imagine: ["16:9", "9:16", "1:1"],
  sdxl: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  kling_motion_control: ["auto"],
  eleven_v3: ["auto"],
};

export function getAllowedAspectRatiosForGenerationModel(generationModel: WorkerGenerationModel | string): WorkerAspectRatio[] {
  return [...(HIGGSFIELD_ASPECT_RATIOS_BY_WORKER_MODEL[generationModel] ?? ["1:1"])];
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

export function isSdxlPoseMultiplierWorkspace(
  generationModel: WorkerGenerationModel | string,
  sdxlWorkspaceMode: string | null | undefined,
): boolean {
  return generationModel === "sdxl" && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

export function isNsfwPoseMultiplierWorkspace(
  generationModel: WorkerGenerationModel | string,
  sdxlWorkspaceMode: string | null | undefined,
  isNsfwWorkspace: boolean,
): boolean {
  return isNsfwWorkspace && (generationModel === "sdxl" || generationModel === "sd_4_5") && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

export function isPoseMultiplierWorkspace(
  generationModel: WorkerGenerationModel | string,
  sdxlWorkspaceMode: string | null | undefined,
): boolean {
  return IMAGE_WORKER_GENERATION_MODELS.includes(generationModel as (typeof IMAGE_WORKER_GENERATION_MODELS)[number]) && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

export function normalizeBoardAspectRatio(
  generationModel: WorkerGenerationModel | string,
  aspectRatio: WorkerAspectRatio | string,
  sdxlWorkspaceMode?: string | null,
): WorkerAspectRatio {
  if (generationModel === "kling_motion_control" || isPoseMultiplierWorkspace(generationModel, sdxlWorkspaceMode)) {
    const allowedAspectRatios = getAllowedAspectRatiosForGenerationModel(generationModel);
    if (allowedAspectRatios.includes("auto")) {
      return "auto";
    }
  }

  return normalizeAspectRatioForGenerationModel(generationModel, aspectRatio);
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
  billingSettings: AgencyBillingSettings;
}

export interface PlatformNotification {
  id: string;
  type: "BILLING_FOLLOW_UP_REQUEST" | "INFLUENCER_DRAFT_REQUEST";
  agencyId: string | null;
  requesterId: string;
  message: string;
  createdAt: string;
  draftInfluencerName?: string | null;
  draftInfluencerHandle?: string | null;
  draftPrompt?: string | null;
  draftPortraitUrls?: string[];
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
  poseMultiplierResolution: PoseMultiplierResolution;
  videoDurationSeconds: number | null;
  quality: WorkerQuality;
  aspectRatio: WorkerAspectRatio;
  quantity: number;
  sdxlWorkspaceMode: "DEFAULT" | "POSE_MULTIPLIER" | "FACE_SWAP";
  poseMultiplierEnabled: boolean;
  poseMultiplier: number;
  poseMultiplierGenerationModel: PoseMultiplierGenerationModel | "sdxl";
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
  outputAssetIds: string[];
  poseOutputAssetIds: string[];
  faceSwapOutputAssetIds: string[];
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
  workflowStage: string;
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
  platformNotifications: PlatformNotification[];
}

export interface UploadRecord {
  fileName: string;
  filePath: string;
  url: string;
}
