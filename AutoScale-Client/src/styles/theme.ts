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
};

export const resolutionLabels: Record<string, string> = {
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
};

export const qualityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const generationModelOptions = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2", "sdxl"] as const;
export const resolutionOptions = ["1k", "2k", "4k"] as const;
export const qualityOptions = ["low", "medium", "high"] as const;
export const aspectRatioOptions = ["auto", "1:1", "16:9", "9:16", "3:4", "4:3", "2:3", "3:2", "5:4", "4:5", "21:9"] as const;

export function getMaxQuantityForGenerationModel(generationModel: string): number {
  return generationModel === "sdxl" ? 20 : 4;
}

export function getResolutionOptionsForGenerationModel(generationModel: string): readonly (typeof resolutionOptions)[number][] {
  if (generationModel === "sd_4_5") {
    return ["2k", "4k"];
  }

  if (generationModel === "kling_o1") {
    return ["1k", "2k"];
  }

  return resolutionOptions;
}

export function normalizeResolutionForGenerationModel(generationModel: string, resolution: string): (typeof resolutionOptions)[number] {
  const allowedResolutions = getResolutionOptionsForGenerationModel(generationModel);

  if (allowedResolutions.includes(resolution as (typeof resolutionOptions)[number])) {
    return resolution as (typeof resolutionOptions)[number];
  }

  const requestedIndex = resolutionOptions.indexOf(resolution as (typeof resolutionOptions)[number]);
  if (requestedIndex !== -1) {
    const upgradedResolution = allowedResolutions.find((option) => resolutionOptions.indexOf(option) >= requestedIndex);
    if (upgradedResolution) {
      return upgradedResolution;
    }
  }

  return allowedResolutions[allowedResolutions.length - 1] || resolutionOptions[0];
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