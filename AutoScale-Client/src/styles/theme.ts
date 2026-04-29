export const theme = {
  shell: "border border-[color:var(--surface-border)] bg-[color:var(--surface-shell)] shadow-[var(--shadow-shell)] backdrop-blur-2xl",
  card: "rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] shadow-[var(--shadow-card)]",
  cardStrong: "rounded-[28px] border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-card-strong)] shadow-[var(--shadow-card-strong)]",
  subtleText: "text-[color:var(--text-muted)]",
  accentText: "text-[color:var(--accent-text)]",
  accentRing: "ring-1 ring-[color:var(--accent-soft)]",
  input:
    "w-full rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-sm text-[color:var(--text-main)] outline-none transition focus:border-[color:var(--focus-ring)] focus:bg-[color:var(--surface-soft-hover)] disabled:cursor-not-allowed disabled:border-[color:var(--surface-border)] disabled:bg-[color:var(--surface-soft)] disabled:text-[color:var(--text-disabled)]",
  buttonPrimary:
    "inline-flex items-center justify-center rounded-2xl bg-[color:var(--accent-main)] px-4 py-2.5 text-sm font-bold tracking-tight text-[color:var(--accent-foreground)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55",
  buttonSecondary:
    "inline-flex items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-2.5 text-sm font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)] disabled:cursor-not-allowed disabled:opacity-55",
  buttonDanger:
    "inline-flex items-center justify-center rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-4 py-2.5 text-sm font-semibold text-[color:var(--danger-text)] transition hover:bg-[color:var(--danger-bg-hover)] disabled:cursor-not-allowed disabled:opacity-55",
};

export const workerModelLabels: Record<string, string> = {
  nb_pro: "NB Pro",
  nb2: "NB 2",
  sd_4_5: "SD 4.5",
  kling_o1: "Kling O1",
  gpt_2: "GPT-2",
  sdxl: "SDXL",
  sd_2_0: "SD 2.0",
  sd_2_0_fast: "SD 2.0 Fast",
  kling_3_0: "Kling 3.0",
  kling_motion_control: "Kling Motion Control",
  grok_imagine: "Grok Imagine",
  eleven_v3: "Eleven v3",
};

export const resolutionLabels: Record<string, string> = {
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
  "480p": "480p",
  "720p": "720p",
  "1080p": "1080p",
};

export const qualityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const imageGenerationModelOptions = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2", "sdxl"] as const;
export const videoGenerationModelOptions = ["sd_2_0", "sd_2_0_fast", "kling_3_0", "kling_motion_control", "grok_imagine"] as const;
export const videoNsfwGenerationModelOptions = ["sd_2_0", "sd_2_0_fast", "grok_imagine"] as const;
export const voiceGenerationModelOptions = ["eleven_v3"] as const;
export const generationModelOptions = [...imageGenerationModelOptions, ...videoGenerationModelOptions, ...voiceGenerationModelOptions] as const;
export const poseMultiplierGenerationModelOptions = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2"] as const;
export const resolutionOptions = ["1k", "2k", "4k"] as const;
export const poseMultiplierResolutionOptions = ["2k", "4k"] as const;
export const videoResolutionOptions = ["480p", "720p", "1080p"] as const;
export const workerResolutionOptions = [...videoResolutionOptions, ...resolutionOptions] as const;
export const qualityOptions = ["low", "medium", "high"] as const;
export const aspectRatioOptions = ["auto", "1:1", "16:9", "9:16", "3:4", "4:3", "2:3", "3:2", "5:4", "4:5", "21:9"] as const;
export const videoDurationOptions = Array.from({ length: 13 }, (_, index) => index + 3);

export function isVideoGenerationModel(generationModel: string): boolean {
  return (videoGenerationModelOptions as readonly string[]).includes(generationModel);
}

export function getAspectRatioOptionsForGenerationModel(generationModel: string): readonly (typeof aspectRatioOptions)[number][] {
  return generationModel === "sdxl" ? aspectRatioOptions.filter((option) => option !== "auto") : aspectRatioOptions;
}

export function isSdxlPoseMultiplierWorkspace(generationModel: string, sdxlWorkspaceMode?: string | null): boolean {
  return generationModel === "sdxl" && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

export function isNsfwPoseMultiplierWorkspace(generationModel: string, sdxlWorkspaceMode?: string | null, workspaceSafety?: "SFW" | "NSFW"): boolean {
  return workspaceSafety === "NSFW" && (generationModel === "sdxl" || generationModel === "sd_4_5") && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

export function isPoseMultiplierWorkspace(generationModel: string, sdxlWorkspaceMode?: string | null): boolean {
  return (imageGenerationModelOptions as readonly string[]).includes(generationModel) && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

export function normalizeAspectRatioForGenerationModel(generationModel: string, aspectRatio: string): (typeof aspectRatioOptions)[number] {
  const allowedAspectRatios = getAspectRatioOptionsForGenerationModel(generationModel);

  if (allowedAspectRatios.includes(aspectRatio as (typeof aspectRatioOptions)[number])) {
    return aspectRatio as (typeof aspectRatioOptions)[number];
  }

  return allowedAspectRatios[0] || "1:1";
}

export function normalizeBoardAspectRatio(
  generationModel: string,
  aspectRatio: string,
  sdxlWorkspaceMode?: string | null,
): (typeof aspectRatioOptions)[number] {
  if (generationModel === "kling_motion_control" || isPoseMultiplierWorkspace(generationModel, sdxlWorkspaceMode)) {
    return "auto";
  }

  return normalizeAspectRatioForGenerationModel(generationModel, aspectRatio);
}

export function getMaxQuantityForGenerationModel(generationModel: string): number {
  if (isVideoGenerationModel(generationModel)) {
    return 1;
  }

  return generationModel === "sdxl" ? 20 : 4;
}

export function getResolutionOptionsForGenerationModel(generationModel: string): readonly (typeof workerResolutionOptions)[number][] {
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

  return resolutionOptions;
}

export function getPoseMultiplierResolutionOptionsForGenerationModel(
  generationModel: string,
  isSdxlPoseMultiplierLayout = false,
): readonly (typeof workerResolutionOptions)[number][] {
  if (isSdxlPoseMultiplierLayout) {
    return poseMultiplierResolutionOptions;
  }

  return getResolutionOptionsForGenerationModel(generationModel);
}

export function normalizeResolutionForGenerationModel(generationModel: string, resolution: string): (typeof workerResolutionOptions)[number] {
  const allowedResolutions = getResolutionOptionsForGenerationModel(generationModel);

  if (allowedResolutions.includes(resolution as (typeof workerResolutionOptions)[number])) {
    return resolution as (typeof workerResolutionOptions)[number];
  }

  const requestedIndex = workerResolutionOptions.indexOf(resolution as (typeof workerResolutionOptions)[number]);
  if (requestedIndex !== -1) {
    const upgradedResolution = allowedResolutions.find((option) => workerResolutionOptions.indexOf(option) >= requestedIndex);
    if (upgradedResolution) {
      return upgradedResolution;
    }
  }

  return allowedResolutions[allowedResolutions.length - 1] || resolutionOptions[0];
}

export function normalizePoseMultiplierResolution(
  resolution: string | null | undefined,
  generationModel?: string,
  isSdxlPoseMultiplierLayout = false,
): (typeof workerResolutionOptions)[number] {
  const allowedResolutions = getPoseMultiplierResolutionOptionsForGenerationModel(generationModel ?? poseMultiplierGenerationModelOptions[0], isSdxlPoseMultiplierLayout);

  if (allowedResolutions.includes(resolution as (typeof workerResolutionOptions)[number])) {
    return resolution as (typeof workerResolutionOptions)[number];
  }

  const requestedIndex = workerResolutionOptions.indexOf(resolution as (typeof workerResolutionOptions)[number]);
  if (requestedIndex !== -1) {
    const upgradedResolution = allowedResolutions.find((option) => workerResolutionOptions.indexOf(option) >= requestedIndex);
    if (upgradedResolution) {
      return upgradedResolution;
    }
  }

  return allowedResolutions[allowedResolutions.length - 1] || resolutionOptions[0];
}

export function getVideoDurationOptionsForGenerationModel(generationModel: string): readonly number[] {
  if (generationModel === "kling_motion_control") {
    return [];
  }

  if (generationModel === "sd_2_0" || generationModel === "sd_2_0_fast") {
    return videoDurationOptions.filter((option) => option >= 4);
  }

  if (generationModel === "kling_3_0" || generationModel === "grok_imagine") {
    return videoDurationOptions;
  }

  return [];
}

export function normalizeVideoDurationForGenerationModel(generationModel: string, duration: number | null | undefined): number | null {
  const allowedDurations = getVideoDurationOptionsForGenerationModel(generationModel);

  if (!allowedDurations.length) {
    return null;
  }

  if (typeof duration === "number" && allowedDurations.includes(duration)) {
    return duration;
  }

  return allowedDurations[0] ?? null;
}

export function getQualityOptionsForGenerationModel(generationModel: string): readonly (typeof qualityOptions)[number][] {
  return generationModel === "gpt_2" ? qualityOptions : ["medium"];
}

export function normalizeQualityForGenerationModel(generationModel: string, quality: string): (typeof qualityOptions)[number] {
  const allowedQualities = getQualityOptionsForGenerationModel(generationModel);

  if (allowedQualities.includes(quality as (typeof qualityOptions)[number])) {
    return quality as (typeof qualityOptions)[number];
  }

  return allowedQualities[0] || "medium";
}

export function normalizePoseMultiplierGenerationModel(generationModel: string | null | undefined, fallbackGenerationModel?: string): string {
  const allowedModels = poseMultiplierGenerationModelOptions as readonly string[];

  if (generationModel && allowedModels.includes(generationModel)) {
    return generationModel;
  }

  if (fallbackGenerationModel && allowedModels.includes(fallbackGenerationModel)) {
    return fallbackGenerationModel;
  }

  return poseMultiplierGenerationModelOptions[0] || generationModelOptions[0];
}
