import {
  isNsfwPoseMultiplierWorkspace,
  normalizePoseMultiplierResolution,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
  videoGenerationModelOptions,
  voiceGenerationModelOptions,
} from "../styles/theme";
import type { BoardSettings, WorkspaceBoard, WorkspaceRow } from "../types";

const HIGGSFIELD_PASS_THROUGH_MULTIPLIER = 1;
const LOCAL_SDXL_IMAGE_CREDITS = 0.01;
const LOCAL_SDXL_UPSCALE_CREDITS = 0.01;
const LOCAL_FACE_SWAP_CREDITS = 0.1;
export const AUTO_IMAGE_CREDITS = 0.002;
export const TEXT_PROMPT_AUTOMATION_CREDITS = 0.001;
export const IMPROVE_PROMPT_CREDITS = 0.001;

const nbProPrices: Record<string, number> = {
  "1k": 2,
  "2k": 2,
  "4k": 4,
};

const nb2Prices: Record<string, number> = {
  "0.5k": 1.5,
  "1k": 1.5,
  "2k": 2,
  "4k": 3,
};

const gptImage2Prices: Record<string, Record<"low" | "medium" | "high", number>> = {
  "1k": {
    low: 0.5,
    medium: 2,
    high: 4,
  },
  "2k": {
    low: 0.75,
    medium: 3,
    high: 7,
  },
  "4k": {
    low: 1,
    medium: 6,
    high: 12,
  },
};

const flux2Prices: Record<string, number> = {
  "1k": 4,
  "2k": 6,
};

const seedance2PricesPerSecond: Record<string, number> = {
  "480p": 9,
  "720p": 13.5,
  "1080p": 27,
};

const klingO1Prices: Record<string, number> = {
  "1k": 0.5,
  "2k": 0.5,
};

const KLING_3_CREDITS_PER_FIVE_SECOND_VIDEO = 6;

interface GenerationCostInput {
  generationModel: string;
  resolution: string;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  quality?: string | null;
  quantity?: number | null;
  prompt?: string | null;
  faceSwap?: boolean;
  upscale?: boolean;
}

export interface GenerationCostEstimate {
  credits: number;
  pricingKnown?: boolean;
  rowCount?: number;
  readyRowCount?: number;
  outputCount?: number;
}

interface CostPart {
  credits: number;
  pricingKnown: boolean;
}

function withMarkup(credits: number): number {
  return credits * HIGGSFIELD_PASS_THROUGH_MULTIPLIER;
}

function normalizedQuantity(quantity: number | null | undefined): number {
  return Math.max(1, Math.floor(quantity ?? 1));
}

function isVideoModel(generationModel: string): boolean {
  return (videoGenerationModelOptions as readonly string[]).includes(generationModel);
}

function isVoiceModel(generationModel: string): boolean {
  return (voiceGenerationModelOptions as readonly string[]).includes(generationModel);
}

function gptQuality(quality: string | null | undefined): "low" | "medium" | "high" {
  return quality === "low" || quality === "high" ? quality : "medium";
}

function estimateAutomationCost(settings: Pick<BoardSettings, "autoPromptGen" | "autoPromptImage">): number {
  return (settings.autoPromptGen ? TEXT_PROMPT_AUTOMATION_CREDITS : 0) + (settings.autoPromptImage ? AUTO_IMAGE_CREDITS : 0);
}

function knownCost(credits: number): CostPart {
  return { credits, pricingKnown: true };
}

function addCostPart(current: CostPart, next: CostPart): CostPart {
  return {
    credits: current.credits + next.credits,
    pricingKnown: current.pricingKnown && next.pricingKnown,
  };
}

function estimateImageCost(input: GenerationCostInput): CostPart {
  const quantity = normalizedQuantity(input.quantity);
  const resolution = input.resolution.toLowerCase();
  let estimate = knownCost(0);

  if (input.generationModel === "sdxl") {
    estimate = addCostPart(estimate, knownCost(LOCAL_SDXL_IMAGE_CREDITS * quantity));
  } else if (input.generationModel === "nb_pro") {
    estimate = addCostPart(estimate, knownCost(withMarkup((nbProPrices[resolution] ?? nbProPrices["1k"]) * quantity)));
  } else if (input.generationModel === "nb2") {
    estimate = addCostPart(estimate, knownCost(withMarkup((nb2Prices[resolution] ?? nb2Prices["1k"]) * quantity)));
  } else if (input.generationModel === "sd_4_5") {
    estimate = addCostPart(estimate, knownCost(withMarkup(1 * quantity)));
  } else if (input.generationModel === "flux_2") {
    estimate = addCostPart(estimate, knownCost(withMarkup((flux2Prices[resolution] ?? flux2Prices["1k"]) * quantity)));
  } else if (input.generationModel === "flux_kontext") {
    estimate = addCostPart(estimate, knownCost(withMarkup(1.5 * quantity)));
  } else if (input.generationModel === "z_image") {
    estimate = addCostPart(estimate, knownCost(withMarkup(0.15 * quantity)));
  } else if (input.generationModel === "kling_o1") {
    estimate = addCostPart(estimate, knownCost(withMarkup((klingO1Prices[resolution] ?? klingO1Prices["1k"]) * quantity)));
  } else if (input.generationModel === "gpt_2") {
    const price = gptImage2Prices[resolution]?.[gptQuality(input.quality)] ?? gptImage2Prices["1k"].medium;
    estimate = addCostPart(estimate, knownCost(withMarkup(price * quantity)));
  }

  if (input.generationModel === "sdxl" && input.upscale) {
    estimate = addCostPart(estimate, knownCost(LOCAL_SDXL_UPSCALE_CREDITS * quantity));
  }

  if (input.faceSwap) {
    estimate = addCostPart(estimate, knownCost(LOCAL_FACE_SWAP_CREDITS * quantity));
  }

  return estimate;
}

function estimateVideoCost(input: GenerationCostInput): CostPart {
  const duration = input.durationSeconds ?? (input.generationModel === "grok_imagine" ? 6 : 5);
  const resolution = input.resolution.toLowerCase();

  if (input.generationModel === "sd_2_0" || input.generationModel === "sd_2_0_fast") {
    return knownCost(withMarkup((seedance2PricesPerSecond[resolution] ?? seedance2PricesPerSecond["720p"]) * duration));
  }

  if (input.generationModel === "kling_3_0") {
    return knownCost(withMarkup(KLING_3_CREDITS_PER_FIVE_SECOND_VIDEO * (duration / 5)));
  }

  if (input.generationModel === "kling_motion_control") {
    return knownCost(withMarkup(67.5 * (duration / 5)));
  }

  if (input.generationModel === "grok_imagine") {
    return knownCost(withMarkup(duration === 10 ? 0.5 : 0.3));
  }

  return knownCost(0);
}

function estimateVoiceCost(input: GenerationCostInput): CostPart {
  const text = (input.prompt || "").trim();
  if (!text) {
    return knownCost(0);
  }

  const billableBlocks = Math.max(1, Math.ceil(text.length / 1000));
  return knownCost(withMarkup(0.1 * billableBlocks));
}

export function estimateGenerationModelCost(input: GenerationCostInput): GenerationCostEstimate {
  if (isVoiceModel(input.generationModel)) {
    return estimateVoiceCost(input);
  }

  if (isVideoModel(input.generationModel)) {
    return estimateVideoCost(input);
  }

  return estimateImageCost(input);
}

function resolveRowCostContext(board: WorkspaceBoard, row: WorkspaceRow) {
  const poseMultiplierActive = board.settings.poseMultiplierEnabled && row.poseMultiplier > 1;
  const generationModel = poseMultiplierActive ? board.settings.poseMultiplierGenerationModel : board.settings.generationModel;
  const isNsfwPoseMultiplierLayout = isNsfwPoseMultiplierWorkspace(
    board.settings.generationModel,
    board.settings.sdxlWorkspaceMode,
    board.name.startsWith("__autoscale_workspace_nsfw__:") ? "NSFW" : "SFW",
  );

  return {
    poseMultiplierActive,
    generationModel,
    resolution: poseMultiplierActive
      ? normalizePoseMultiplierResolution(board.settings.poseMultiplierResolution, generationModel, isNsfwPoseMultiplierLayout)
      : normalizeResolutionForGenerationModel(generationModel, board.settings.resolution),
    durationSeconds: normalizeVideoDurationForGenerationModel(generationModel, board.settings.videoDurationSeconds),
    quantity: poseMultiplierActive
      ? Math.max(1, Math.min(4, row.poseMultiplier))
      : isVideoModel(generationModel) || isVoiceModel(generationModel)
        ? 1
        : board.settings.quantity,
  };
}

function resolveNsfwPoseMultiplierLayout(board: WorkspaceBoard): boolean {
  return isNsfwPoseMultiplierWorkspace(
    board.settings.generationModel,
    board.settings.sdxlWorkspaceMode,
    board.name.startsWith("__autoscale_workspace_nsfw__:") ? "NSFW" : "SFW",
  );
}

function isDedicatedPoseMultiplierWorkspace(board: WorkspaceBoard): boolean {
  return board.settings.sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

function isAddOnPoseMultiplierMode(board: WorkspaceBoard): boolean {
  return (
    board.settings.poseMultiplierEnabled &&
    !isDedicatedPoseMultiplierWorkspace(board) &&
    board.settings.sdxlWorkspaceMode !== "FACE_SWAP" &&
    !isVideoModel(board.settings.generationModel) &&
    !isVoiceModel(board.settings.generationModel)
  );
}

function isExecutableRow(board: WorkspaceBoard, row: WorkspaceRow): boolean {
  const { generationModel } = resolveRowCostContext(board, row);
  const hasPrompt = Boolean(row.prompt.trim());

  if (isVoiceModel(generationModel)) {
    return hasPrompt;
  }

  if (generationModel === "kling_motion_control") {
    return Boolean(row.reference);
  }

  if (board.settings.sdxlWorkspaceMode === "FACE_SWAP") {
    return Boolean(row.reference);
  }

  return hasPrompt;
}

function estimateRowCost(board: WorkspaceBoard, row: WorkspaceRow): { credits: number; outputCount: number; pricingKnown: boolean } {
  const faceSwapEnabled = board.settings.sdxlWorkspaceMode === "FACE_SWAP" || row.faceSwap || board.settings.faceSwap;
  const automationCredits = estimateAutomationCost(board.settings);

  if (isAddOnPoseMultiplierMode(board)) {
    const baseQuantity = Math.max(1, normalizedQuantity(board.settings.quantity));
    const baseEstimate = estimateGenerationModelCost({
      generationModel: board.settings.generationModel,
      resolution: normalizeResolutionForGenerationModel(board.settings.generationModel, board.settings.resolution),
      durationSeconds: normalizeVideoDurationForGenerationModel(board.settings.generationModel, board.settings.videoDurationSeconds),
      aspectRatio: board.settings.aspectRatio,
      quality: board.settings.quality,
      quantity: baseQuantity,
      prompt: row.prompt,
      faceSwap: faceSwapEnabled,
      upscale: board.settings.generationModel === "sdxl" && row.upscale,
    });
    const poseQuantity = Math.max(1, Math.min(4, Math.floor(row.poseMultiplier || board.settings.poseMultiplier || 1)));
    const poseGenerationModel = board.settings.poseMultiplierGenerationModel;
    const poseEstimate = estimateGenerationModelCost({
      generationModel: poseGenerationModel,
      resolution: normalizePoseMultiplierResolution(board.settings.poseMultiplierResolution, poseGenerationModel, resolveNsfwPoseMultiplierLayout(board)),
      durationSeconds: null,
      aspectRatio: board.settings.aspectRatio,
      quality: board.settings.quality,
      quantity: poseQuantity,
      prompt: row.prompt,
      faceSwap: faceSwapEnabled,
      upscale: false,
    });

    return {
      credits: baseEstimate.credits + poseEstimate.credits + automationCredits,
      outputCount: baseQuantity + poseQuantity,
      pricingKnown: Boolean(baseEstimate.pricingKnown && poseEstimate.pricingKnown),
    };
  }

  const context = resolveRowCostContext(board, row);
  const estimate = estimateGenerationModelCost({
    generationModel: context.generationModel,
    resolution: context.resolution,
    durationSeconds: context.durationSeconds,
    aspectRatio: board.settings.aspectRatio,
    quality: board.settings.quality,
    quantity: context.quantity,
    prompt: row.prompt,
    faceSwap: faceSwapEnabled,
    upscale: context.generationModel === "sdxl" && !context.poseMultiplierActive && row.upscale,
  });

  return {
    credits: estimate.credits + automationCredits,
    outputCount: context.quantity,
    pricingKnown: Boolean(estimate.pricingKnown),
  };
}

export function estimateBoardRunCost(board: WorkspaceBoard | null | undefined): GenerationCostEstimate {
  if (!board) {
    return { credits: 0, pricingKnown: true, outputCount: 0, readyRowCount: 0, rowCount: 0 };
  }

  const rowEstimates = board.rows.map((row) => estimateRowCost(board, row));
  const credits = rowEstimates.reduce((total, estimate) => total + estimate.credits, 0);
  const outputCount = rowEstimates.reduce((total, estimate) => total + estimate.outputCount, 0);
  const pricingKnown = rowEstimates.every((estimate) => estimate.pricingKnown);

  return {
    credits,
    pricingKnown,
    outputCount,
    readyRowCount: board.rows.filter((row) => isExecutableRow(board, row)).length,
    rowCount: board.rows.length,
  };
}

export function estimatePlaygroundCost(settings: BoardSettings, prompt: string): GenerationCostEstimate {
  const generationModel = settings.generationModel;
  const quantity = isVideoModel(generationModel) || isVoiceModel(generationModel) ? 1 : settings.quantity;

  const estimate = estimateGenerationModelCost({
    generationModel,
    resolution: normalizeResolutionForGenerationModel(generationModel, settings.resolution),
    durationSeconds: normalizeVideoDurationForGenerationModel(generationModel, settings.videoDurationSeconds),
    aspectRatio: settings.aspectRatio,
    quality: settings.quality,
    quantity,
    prompt,
    faceSwap: settings.sdxlWorkspaceMode === "FACE_SWAP" || settings.faceSwap,
    upscale: generationModel === "sdxl" && settings.upscale,
  });

  return {
    ...estimate,
    credits: estimate.credits + estimateAutomationCost(settings),
  };
}

export function formatCreditCost(credits: number): string {
  if (!Number.isFinite(credits) || credits <= 0) {
    return "0";
  }

  if (credits < 1) {
    return credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (Number.isInteger(credits)) {
    return credits.toLocaleString();
  }

  return credits.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatGenerationCostEstimate(estimate: Pick<GenerationCostEstimate, "credits" | "pricingKnown">): string {
  if (!estimate.pricingKnown) {
    return "Live price required";
  }

  return `${formatCreditCost(estimate.credits)} credits`;
}
