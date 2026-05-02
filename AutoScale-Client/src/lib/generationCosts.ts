import {
  isNsfwPoseMultiplierWorkspace,
  normalizePoseMultiplierResolution,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
  videoGenerationModelOptions,
  voiceGenerationModelOptions,
} from "../styles/theme";
import type { BoardSettings, WorkspaceBoard, WorkspaceRow } from "../types";

const WAVESPEED_MARKUP = 1.3;
const LOCAL_SDXL_IMAGE_CREDITS = 0.001;
const LOCAL_SDXL_UPSCALE_CREDITS = 0.001;
const LOCAL_FACE_SWAP_CREDITS = 0.01;
export const AUTO_IMAGE_CREDITS = 0.002;
export const TEXT_PROMPT_AUTOMATION_CREDITS = 0.001;
export const IMPROVE_PROMPT_CREDITS = 0.001;

const nbProPrices: Record<string, number> = {
  "1k": 0.14,
  "2k": 0.14,
  "4k": 0.24,
};

const nb2Prices: Record<string, number> = {
  "0.5k": 0.045,
  "1k": 0.07,
  "2k": 0.105,
  "4k": 0.14,
};

const gptImage2Prices: Record<string, Record<string, number>> = {
  "1k": {
    low: 0.03,
    medium: 0.06,
    high: 0.22,
  },
  "2k": {
    low: 0.06,
    medium: 0.12,
    high: 0.44,
  },
  "4k": {
    low: 0.09,
    medium: 0.18,
    high: 0.66,
  },
};

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
  rowCount?: number;
  readyRowCount?: number;
  outputCount?: number;
}

function withMarkup(usd: number): number {
  return usd * WAVESPEED_MARKUP;
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

function estimateImageCost(input: GenerationCostInput): number {
  const quantity = normalizedQuantity(input.quantity);
  const resolution = input.resolution.toLowerCase();
  let total = 0;

  if (input.generationModel === "sdxl") {
    total += LOCAL_SDXL_IMAGE_CREDITS * quantity;
  } else if (input.generationModel === "nb_pro") {
    total += withMarkup((nbProPrices[resolution] ?? nbProPrices["1k"]) * quantity);
  } else if (input.generationModel === "nb2") {
    total += withMarkup((nb2Prices[resolution] ?? nb2Prices["1k"]) * quantity);
  } else if (input.generationModel === "sd_4_5") {
    total += withMarkup(0.04 * quantity);
  } else if (input.generationModel === "kling_o1") {
    total += withMarkup(0.028 * quantity);
  } else if (input.generationModel === "gpt_2") {
    const priceByQuality = gptImage2Prices[resolution] ?? gptImage2Prices["1k"];
    total += withMarkup(priceByQuality[gptQuality(input.quality)] * quantity);
  }

  if (input.generationModel === "sdxl" && input.upscale) {
    total += LOCAL_SDXL_UPSCALE_CREDITS * quantity;
  }

  if (input.faceSwap) {
    total += LOCAL_FACE_SWAP_CREDITS * quantity;
  }

  return total;
}

function estimateVideoCost(input: GenerationCostInput): number {
  const duration = input.durationSeconds ?? (input.generationModel === "grok_imagine" ? 6 : 5);
  const resolution = input.resolution.toLowerCase();

  if (input.generationModel === "sd_2_0" || input.generationModel === "sd_2_0_fast") {
    const basePricePerSecondAt480p = input.generationModel === "sd_2_0" ? 0.12 : 0.1;
    const resolutionMultiplier = resolution === "1080p" ? 5 : resolution === "720p" ? 2 : 1;
    return withMarkup(basePricePerSecondAt480p * resolutionMultiplier * duration);
  }

  if (input.generationModel === "kling_3_0") {
    const perSecondPrice = resolution === "4k" ? 0.42 : 0.112;
    return withMarkup(perSecondPrice * duration);
  }

  if (input.generationModel === "kling_motion_control") {
    return withMarkup(0.84 * (duration / 5));
  }

  if (input.generationModel === "grok_imagine") {
    return withMarkup(duration === 10 ? 0.5 : 0.3);
  }

  return 0;
}

function estimateVoiceCost(input: GenerationCostInput): number {
  const text = (input.prompt || "").trim();
  if (!text) {
    return 0;
  }

  const billableBlocks = Math.max(1, Math.ceil(text.length / 1000));
  return withMarkup(0.1 * billableBlocks);
}

export function estimateGenerationModelCost(input: GenerationCostInput): GenerationCostEstimate {
  if (isVoiceModel(input.generationModel)) {
    return { credits: estimateVoiceCost(input) };
  }

  if (isVideoModel(input.generationModel)) {
    return { credits: estimateVideoCost(input) };
  }

  return { credits: estimateImageCost(input) };
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

  return hasPrompt && Boolean(row.reference);
}

function estimateRowCost(board: WorkspaceBoard, row: WorkspaceRow): { credits: number; outputCount: number } {
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
  };
}

export function estimateBoardRunCost(board: WorkspaceBoard | null | undefined): GenerationCostEstimate {
  if (!board) {
    return { credits: 0, outputCount: 0, readyRowCount: 0, rowCount: 0 };
  }

  const rowEstimates = board.rows.map((row) => estimateRowCost(board, row));
  const credits = rowEstimates.reduce((total, estimate) => total + estimate.credits, 0);
  const outputCount = rowEstimates.reduce((total, estimate) => total + estimate.outputCount, 0);

  return {
    credits,
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
    return "0.000";
  }

  if (credits < 1) {
    return credits.toFixed(3);
  }

  return credits.toFixed(2);
}
