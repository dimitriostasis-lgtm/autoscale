import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import { resolveWorkerWorkflow } from "../config/workflows.js";
import { readStore, updateStore } from "../lib/store.js";
import { saveGeneratedFile, toAbsoluteStoragePath } from "../lib/storage.js";
import {
  VIDEO_WORKER_GENERATION_MODELS,
  VOICE_WORKER_GENERATION_MODELS,
  isNsfwPoseMultiplierWorkspace,
  normalizeBoardAspectRatio,
  normalizePoseMultiplierResolution,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
} from "../types/domain.js";
import type { AuthUser, GeneratedAsset, GenerationStatus, ReferenceSelection, StoreData } from "../types/domain.js";

import { publishAssetCreated, publishBoardUpdate } from "./notifications.service.js";
import { assertBoardEdit } from "./permissions.service.js";
import { presentBoard } from "./presenters.js";

const WORKER_TIMEOUT_MS = 20 * 60 * 1000;
const WORKER_POLL_INTERVAL_MS = 2500;
const runningBoards = new Set<string>();
type GenerationLane = "image" | "video" | "voice";
const laneQueues: Record<GenerationLane, Promise<void>> = {
  image: Promise.resolve(),
  video: Promise.resolve(),
  voice: Promise.resolve(),
};

interface FilePayload {
  buffer: Buffer;
  fileName: string;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

interface WorkerArtifact {
  name?: string;
  download_url?: string;
  downloadUrl?: string;
  synthetic_failure?: boolean;
  syntheticFailure?: boolean;
  failure_label?: string;
  failureLabel?: string;
  width?: number | null;
  height?: number | null;
}

interface WorkerJobMetadata {
  stage_artifacts?: Record<string, WorkerArtifact[]>;
  stageArtifacts?: Record<string, WorkerArtifact[]>;
  stage_errors?: Record<string, string>;
  stageErrors?: Record<string, string>;
}

interface WorkerJobStatus {
  job_id: string;
  status: string;
  error?: string | null;
  artifacts?: WorkerArtifact[];
  metadata?: WorkerJobMetadata;
}

interface RowJobLink {
  rowId: string;
  jobId: string;
  prompt: string;
  generationModel: GeneratedAsset["generationModel"];
  resolution: GeneratedAsset["resolution"];
  videoDurationSeconds: number | null;
  aspectRatio: GeneratedAsset["aspectRatio"];
  quantity: number;
  baseGenerationModel: string;
  baseResolution: string;
  baseAspectRatio: string;
  baseQuantity: number;
  multiposeGenerationModel: string;
  multiposeResolution: string;
  multiposeAspectRatio: string;
  multiposeQuantity: number;
  poseMultiplierActive: boolean;
  faceSwapEnabled: boolean;
  upscale: boolean;
}

function isVideoWorkerModel(generationModel: string): boolean {
  return VIDEO_WORKER_GENERATION_MODELS.includes(generationModel as (typeof VIDEO_WORKER_GENERATION_MODELS)[number]);
}

function isVoiceWorkerModel(generationModel: string): boolean {
  return VOICE_WORKER_GENERATION_MODELS.includes(generationModel as (typeof VOICE_WORKER_GENERATION_MODELS)[number]);
}

function safeStorageSegment(value: string | null | undefined, fallback: string): string {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || fallback;
}

function boardSafetySegment(boardName: string): "sfw" | "nsfw" {
  return boardName.startsWith("__autoscale_workspace_nsfw__:") || boardName.startsWith("__autoscale_workspace_video_nsfw__:") || boardName.startsWith("__autoscale_workspace_voice_nsfw__:")
    ? "nsfw"
    : "sfw";
}

function mediaKindForStage(stage: string, generationModel: string): GeneratedAsset["mediaKind"] {
  if (stage === "multipose" || stage === "face_swap") {
    return "image";
  }

  if (isVideoWorkerModel(generationModel)) {
    return "video";
  }

  if (isVoiceWorkerModel(generationModel)) {
    return "voice";
  }

  return "image";
}

function galleryModeForStage(stage: string, generationModel: string, upscale: boolean): string {
  if (stage === "face_swap") {
    return "face_swap";
  }

  if (stage === "multipose") {
    return "multipose";
  }

  if (upscale) {
    return "upscale";
  }

  if (isVideoWorkerModel(generationModel)) {
    return "video";
  }

  if (isVoiceWorkerModel(generationModel)) {
    return "voice";
  }

  return "base";
}

function stageAssetContext(result: RowJobLink, stage: string) {
  if (stage === "multipose") {
    return {
      generationModel: result.multiposeGenerationModel,
      resolution: result.multiposeResolution,
      aspectRatio: result.multiposeAspectRatio,
      quantity: result.multiposeQuantity,
      galleryMode: galleryModeForStage(stage, result.multiposeGenerationModel, false),
      mediaKind: mediaKindForStage(stage, result.multiposeGenerationModel),
    };
  }

  if (stage === "face_swap") {
    return {
      generationModel: "face_swap",
      resolution: result.resolution,
      aspectRatio: result.aspectRatio,
      quantity: 1,
      galleryMode: "face_swap",
      mediaKind: "image" as const,
    };
  }

  return {
    generationModel: result.baseGenerationModel || result.generationModel,
    resolution: result.baseResolution || result.resolution,
    aspectRatio: result.baseAspectRatio || result.aspectRatio,
    quantity: result.baseQuantity || result.quantity,
    galleryMode: galleryModeForStage(stage, result.baseGenerationModel || result.generationModel, result.upscale),
    mediaKind: mediaKindForStage(stage, result.baseGenerationModel || result.generationModel),
  };
}

function resolveGenerationLane(generationModel: string): GenerationLane {
  if (isVoiceWorkerModel(generationModel)) {
    return "voice";
  }
  if (isVideoWorkerModel(generationModel)) {
    return "video";
  }
  return "image";
}

function resolveRowGenerationContext(board: StoreData["boards"][number], row: StoreData["boards"][number]["rows"][number]) {
  const poseMultiplierActive = board.settings.poseMultiplierEnabled && row.poseMultiplier > 1;
  const generationModel = poseMultiplierActive ? board.settings.poseMultiplierGenerationModel : board.settings.generationModel;
  const isNsfwPoseMultiplierLayout = isNsfwPoseMultiplierWorkspace(
    board.settings.generationModel,
    board.settings.sdxlWorkspaceMode,
    board.name.startsWith("__autoscale_workspace_nsfw__:"),
  );
  const resolution = poseMultiplierActive
    ? normalizePoseMultiplierResolution(board.settings.poseMultiplierResolution, generationModel, isNsfwPoseMultiplierLayout)
    : normalizeResolutionForGenerationModel(generationModel, board.settings.resolution);
  const videoDurationSeconds = normalizeVideoDurationForGenerationModel(generationModel, board.settings.videoDurationSeconds);
  const aspectRatio = normalizeBoardAspectRatio(generationModel, board.settings.aspectRatio, board.settings.sdxlWorkspaceMode);
  const quantity = poseMultiplierActive
    ? Math.max(1, Math.min(4, row.poseMultiplier))
    : isVideoWorkerModel(generationModel) || isVoiceWorkerModel(generationModel)
      ? 1
      : board.settings.quantity;

  return {
    poseMultiplierActive,
    generationModel,
    resolution,
    videoDurationSeconds,
    aspectRatio,
    quantity,
  };
}

function requiresRowReferenceForGeneration(
  board: StoreData["boards"][number],
  generationModel: string,
): boolean {
  return (
    env.requireRowReferenceImages ||
    generationModel === "kling_motion_control" ||
    board.settings.sdxlWorkspaceMode === "FACE_SWAP"
  );
}

function getRowReadiness(board: StoreData["boards"][number], row: StoreData["boards"][number]["rows"][number]): { ready: boolean; reason: string | null } {
  const { generationModel } = resolveRowGenerationContext(board, row);
  const hasPrompt = Boolean(row.prompt.trim());
  const hasAnyInput = hasPrompt || Boolean(row.reference || row.audioReference);

  if (isVoiceWorkerModel(generationModel)) {
    return hasPrompt
      ? { ready: true, reason: null }
      : { ready: false, reason: hasAnyInput ? "Voice text is required" : null };
  }

  if (requiresRowReferenceForGeneration(board, generationModel) && !row.reference) {
    const reason = generationModel === "kling_motion_control"
      ? "Motion reference video is required"
      : board.settings.sdxlWorkspaceMode === "FACE_SWAP"
        ? "Reference image is required"
        : "Reference image is required by the configured generation bridge";
    return { ready: false, reason: hasAnyInput ? reason : null };
  }

  if (hasPrompt || (generationModel === "kling_motion_control" && row.reference)) {
    return { ready: true, reason: null };
  }

  return {
    ready: false,
    reason: hasAnyInput ? "Prompt is required" : null,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function workerHeaders(): HeadersInit {
  return {
    "x-api-key": env.workerApiKey,
  };
}

async function fetchWorkerJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...workerHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Worker request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function readSelectionFile(selection: ReferenceSelection, store: StoreData): Promise<FilePayload> {
  if (selection.uploadPath) {
    const absolutePath = toAbsoluteStoragePath(selection.uploadPath);
    const buffer = await fs.readFile(absolutePath);
    const fileName = selection.uploadPath.split("/").pop() || `${selection.label}.bin`;
    return { buffer, fileName };
  }

  if (selection.assetId) {
    const asset = store.assets.find((entry) => entry.id === selection.assetId);
    if (!asset) {
      throw new Error("Referenced gallery asset not found");
    }
    const absolutePath = toAbsoluteStoragePath(asset.filePath);
    const buffer = await fs.readFile(absolutePath);
    return { buffer, fileName: asset.fileName };
  }

  throw new Error("Reference source is incomplete");
}

async function createWorkerJob(options: {
  boardRunId: string;
  boardId: string;
  rowId: string;
  rowIndex: number;
  totalRows: number;
  influencerModelId: string;
  influencerModelSlug: string;
  influencerModelName: string;
  workflowId: string;
  workflowName: string;
  workflowPath: string;
  prompt: string;
  generationModel: string;
  baseGenerationModel: string;
  baseResolution: string;
  baseAspectRatio: string;
  baseQuantity: number;
  multiposeGenerationModel: string;
  multiposeResolution: string;
  multiposeAspectRatio: string;
  multiposeQuantity: number;
  resolution: string;
  videoDurationSeconds: number | null;
  aspectRatio: string;
  quantity: number;
  quality: string;
  poseMultiplierActive: boolean;
  faceSwapEnabled: boolean;
  autoPromptEnabled: boolean;
  autoPromptImageEnabled: boolean;
  multiposeAutoPromptEnabled: boolean;
  upscale: boolean;
  upscaleFactor: number;
  upscaleDenoise: number;
  globalReferences: FilePayload[];
  rowReference: FilePayload | null;
  audioReference: FilePayload | null;
  isFirst: boolean;
  isLast: boolean;
}): Promise<string> {
  const formData = new FormData();
  formData.append("board_run_id", options.boardRunId);
  formData.append("board_id", options.boardId);
  formData.append("row_id", options.rowId);
  formData.append("row_index", String(options.rowIndex));
  formData.append("total_rows", String(options.totalRows));
  formData.append("influencer_model_id", options.influencerModelId);
  formData.append("higgsfield_account_key", options.influencerModelId);
  formData.append("influencer_model_slug", options.influencerModelSlug);
  formData.append("influencer_model_name", options.influencerModelName);
  formData.append("workflow_id", options.workflowId);
  formData.append("workflow_name", options.workflowName);
  formData.append("workflow_path", options.workflowPath);
  formData.append("prompt", options.prompt);
  formData.append("model", options.generationModel);
  formData.append("base_model", options.baseGenerationModel);
  formData.append("base_resolution", options.baseResolution);
  formData.append("base_aspect_ratio", options.baseAspectRatio);
  formData.append("base_quantity", String(options.baseQuantity));
  formData.append("base_quality", options.quality);
  formData.append("multipose_model", options.multiposeGenerationModel);
  formData.append("multipose_resolution", options.multiposeResolution);
  formData.append("multipose_aspect_ratio", options.multiposeAspectRatio);
  formData.append("multipose_quantity", String(options.multiposeQuantity));
  formData.append("multipose_quality", options.quality);
  formData.append("resolution", options.resolution);
  if (options.videoDurationSeconds !== null) {
    formData.append("duration", String(options.videoDurationSeconds));
  }
  formData.append("aspect_ratio", options.aspectRatio);
  formData.append("quantity", String(options.quantity));
  formData.append("quality", options.quality);
  formData.append("upscale", options.upscale ? "true" : "false");
  formData.append("upscale_factor", String(options.upscaleFactor));
  formData.append("upscale_denoise", String(options.upscaleDenoise));
  formData.append("headless", "false");
  const hasFirstJobGlobalReferences = options.isFirst && options.globalReferences.length > 0;
  const referenceMode = options.rowReference
    ? options.isFirst
      ? "replace"
      : "patch_slot"
    : hasFirstJobGlobalReferences
      ? "replace"
      : "keep";
  formData.append("reference_mode", referenceMode);
  formData.append("reference_patch_indices", "[]");
  formData.append("reuse_browser", "true");
  formData.append("settings_already_set", options.isFirst ? "false" : "true");
  formData.append("fire_only", options.isLast ? "false" : "true");
  formData.append("pose_multiplier_enabled", options.poseMultiplierActive ? "true" : "false");
  formData.append("face_swap_enabled", options.faceSwapEnabled ? "true" : "false");
  formData.append("auto_prompt_enabled", options.autoPromptEnabled ? "true" : "false");
  formData.append("auto_prompt_image_enabled", options.autoPromptImageEnabled ? "true" : "false");
  formData.append("multipose_auto_prompt_enabled", options.multiposeAutoPromptEnabled ? "true" : "false");
  formData.append("pose_prompt_mode", options.multiposeAutoPromptEnabled ? "AUTO" : "CUSTOM");

  if (options.isFirst) {
    for (const reference of options.globalReferences) {
      formData.append("global_reference_images", new Blob([bufferToArrayBuffer(reference.buffer)]), reference.fileName);
    }
  }

  if (options.rowReference) {
    formData.append(
      "reference_images",
      new Blob([bufferToArrayBuffer(options.rowReference.buffer)]),
      options.rowReference.fileName,
    );
  }

  if (options.audioReference) {
    formData.append(
      "audio_reference",
      new Blob([bufferToArrayBuffer(options.audioReference.buffer)]),
      options.audioReference.fileName,
    );
  }

  const payload = await fetchWorkerJson<{ job_id: string }>(`${env.workerUrl}/api/v1/jobs`, {
    method: "POST",
    body: formData,
  });

  return payload.job_id;
}

async function getWorkerJob(jobId: string): Promise<WorkerJobStatus> {
  return fetchWorkerJson<WorkerJobStatus>(`${env.workerUrl}/api/v1/jobs/${jobId}`);
}

async function pollWorkerJob(jobId: string): Promise<WorkerJobStatus> {
  const deadline = Date.now() + WORKER_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await getWorkerJob(jobId);
    if (status.status === "succeeded" || status.status === "failed") {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, WORKER_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out while waiting for the worker batch to complete");
}

async function downloadArtifact(artifact: WorkerArtifact): Promise<Buffer> {
  const rawUrl = artifact.download_url || artifact.downloadUrl;
  if (!rawUrl) {
    throw new Error("Artifact is missing a download URL");
  }

  const url = rawUrl.startsWith("http") ? rawUrl : `${env.workerUrl}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  const response = await fetch(url, {
    headers: workerHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Artifact download failed with ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function deriveRowStatus(artifacts: WorkerArtifact[]): { status: GenerationStatus; errorMessage: string | null } {
  if (!artifacts.length) {
    return { status: "FAILED", errorMessage: "No artifacts returned by the worker" };
  }

  const syntheticCount = artifacts.filter((artifact) => artifact.synthetic_failure || artifact.syntheticFailure).length;
  if (syntheticCount === 0) {
    return { status: "SUCCEEDED", errorMessage: null };
  }

  const labels = Array.from(
    new Set(
      artifacts
        .map((artifact) => artifact.failure_label || artifact.failureLabel)
        .filter((label): label is string => Boolean(label)),
    ),
  );

  if (syntheticCount === artifacts.length) {
    return {
      status: "FAILED",
      errorMessage: labels.join(", ") || "All outputs were replaced with worker failure placeholders",
    };
  }

  return {
    status: "PARTIAL",
    errorMessage: labels.join(", ") || "One or more outputs completed with worker failure placeholders",
  };
}

function getStageArtifacts(job: WorkerJobStatus, stage: string): WorkerArtifact[] {
  const stageArtifacts = job.metadata?.stage_artifacts || job.metadata?.stageArtifacts;
  const artifacts = stageArtifacts?.[stage];
  if (Array.isArray(artifacts)) {
    return artifacts;
  }
  return stage === "base" ? job.artifacts || [] : [];
}

function getStageError(job: WorkerJobStatus, stage: string): string {
  const stageErrors = job.metadata?.stage_errors || job.metadata?.stageErrors;
  const message = stageErrors?.[stage];
  return typeof message === "string" ? message : "";
}

async function markBoardRows(
  boardId: string,
  updater: (board: StoreData["boards"][number]) => void,
): Promise<StoreData> {
  return updateStore((store) => {
    const board = store.boards.find((entry) => entry.id === boardId);
    if (!board) {
      throw new Error("Board not found");
    }
    updater(board);
    board.updatedAt = nowIso();
    return store;
  });
}

async function failRows(boardId: string, rowIds: string[], message: string): Promise<void> {
  const updatedStore = await markBoardRows(boardId, (board) => {
    for (const row of board.rows) {
      if (rowIds.includes(row.id)) {
        row.status = "FAILED";
        row.errorMessage = message;
        row.outputAssetIds = [];
        row.poseOutputAssetIds = [];
        row.faceSwapOutputAssetIds = [];
        row.lastRunAt = nowIso();
      }
    }
  });
  await publishBoardUpdate(boardId, updatedStore);
}

function enqueueLane(lane: GenerationLane, task: () => Promise<void>): void {
  const previous = laneQueues[lane].catch(() => undefined);
  const next = previous.then(task);
  laneQueues[lane] = next.catch(() => undefined);
}

async function processBoardGeneration(boardId: string, requestedById: string): Promise<void> {
  const initialStore = await readStore();
  const board = initialStore.boards.find((entry) => entry.id === boardId);
  if (!board) {
    return;
  }

  const influencerModel = initialStore.influencerModels.find((entry) => entry.id === board.influencerModelId);
  const workflow = resolveWorkerWorkflow(influencerModel);
  const boardRunId = randomUUID();
  const activeRows = [...board.rows].sort((left, right) => left.orderIndex - right.orderIndex).filter((row) => row.status === "QUEUED");
  const globalSelections = board.settings.globalReferences.filter(
    (selection) => Boolean(selection.uploadPath || selection.assetId),
  );
  const globalReferences = await Promise.all(globalSelections.map((selection) => readSelectionFile(selection, initialStore)));

  const rowJobs: RowJobLink[] = [];

  for (const [index, row] of activeRows.entries()) {
    try {
      const generatingStore = await markBoardRows(boardId, (mutableBoard) => {
        const targetRow = mutableBoard.rows.find((entry) => entry.id === row.id);
        if (targetRow) {
          targetRow.status = "GENERATING";
          targetRow.errorMessage = null;
        }
      });
      await publishBoardUpdate(boardId, generatingStore);

      const { poseMultiplierActive, generationModel, resolution, videoDurationSeconds, aspectRatio, quantity } = resolveRowGenerationContext(board, row);
      const needsRowReference = !isVoiceWorkerModel(generationModel) && requiresRowReferenceForGeneration(board, generationModel);
      if (needsRowReference && !row.reference) {
        throw new Error(isVideoWorkerModel(generationModel) ? "Missing row reference media" : "Missing row reference image");
      }

      const rowReference = row.reference ? await readSelectionFile(row.reference, initialStore) : null;
      const audioReference = row.audioReference ? await readSelectionFile(row.audioReference, initialStore) : null;
      const baseGenerationModel = board.settings.generationModel;
      const baseResolution = normalizeResolutionForGenerationModel(baseGenerationModel, board.settings.resolution);
      const baseAspectRatio = normalizeBoardAspectRatio(baseGenerationModel, board.settings.aspectRatio, board.settings.sdxlWorkspaceMode);
      const baseQuantity = isVideoWorkerModel(baseGenerationModel) || isVoiceWorkerModel(baseGenerationModel) ? 1 : board.settings.quantity;
      const multiposeGenerationModel = board.settings.poseMultiplierGenerationModel;
      const multiposeResolution = normalizePoseMultiplierResolution(
        board.settings.poseMultiplierResolution,
        multiposeGenerationModel,
        isNsfwPoseMultiplierWorkspace(board.settings.generationModel, board.settings.sdxlWorkspaceMode, board.name.startsWith("__autoscale_workspace_nsfw__:")),
      );
      const multiposeAspectRatio = normalizeBoardAspectRatio(multiposeGenerationModel, board.settings.aspectRatio, board.settings.sdxlWorkspaceMode);
      const multiposeQuantity = Math.max(1, Math.min(4, row.poseMultiplier));
      const jobId = await createWorkerJob({
        boardRunId,
        boardId,
        rowId: row.id,
        rowIndex: row.orderIndex + 1,
        totalRows: board.rows.length,
        influencerModelId: board.influencerModelId,
        influencerModelSlug: influencerModel?.slug || "",
        influencerModelName: influencerModel?.name || "",
        workflowId: workflow?.id || "default-platform",
        workflowName: workflow?.name || influencerModel?.defaultPlatformWorkflowName || "Default platform workflow",
        workflowPath: workflow?.path || "",
        prompt: row.prompt,
        generationModel,
        baseGenerationModel,
        baseResolution,
        baseAspectRatio,
        baseQuantity,
        multiposeGenerationModel,
        multiposeResolution,
        multiposeAspectRatio,
        multiposeQuantity,
        resolution,
        videoDurationSeconds,
        aspectRatio,
        quantity,
        quality: board.settings.quality,
        poseMultiplierActive,
        faceSwapEnabled: board.settings.faceSwap || row.faceSwap || board.settings.sdxlWorkspaceMode === "FACE_SWAP",
        autoPromptEnabled: board.settings.autoPromptGen,
        autoPromptImageEnabled: board.settings.autoPromptImage,
        multiposeAutoPromptEnabled: board.settings.posePromptMode === "AUTO",
        upscale: generationModel === "sdxl" && !poseMultiplierActive ? row.upscale : false,
        upscaleFactor: generationModel === "sdxl" && !poseMultiplierActive ? board.settings.upscaleFactor : 1,
        upscaleDenoise: generationModel === "sdxl" && !poseMultiplierActive ? board.settings.upscaleDenoise : 0,
        globalReferences,
        rowReference,
        audioReference,
        isFirst: index === 0,
        isLast: index === activeRows.length - 1,
      });

      rowJobs.push({
        rowId: row.id,
        jobId,
        prompt: row.prompt,
        generationModel,
        resolution,
        videoDurationSeconds,
        aspectRatio,
        quantity,
        baseGenerationModel,
        baseResolution,
        baseAspectRatio,
        baseQuantity,
        multiposeGenerationModel,
        multiposeResolution,
        multiposeAspectRatio,
        multiposeQuantity,
        poseMultiplierActive,
        faceSwapEnabled: board.settings.faceSwap || row.faceSwap || board.settings.sdxlWorkspaceMode === "FACE_SWAP",
        upscale: generationModel === "sdxl" && !poseMultiplierActive ? row.upscale : false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit this row to the generation worker";
      const remainingIds = activeRows.slice(index).map((entry) => entry.id);
      await failRows(boardId, remainingIds, message);
      return;
    }
  }

  if (!rowJobs.length) {
    return;
  }

  try {
    await pollWorkerJob(rowJobs[rowJobs.length - 1].jobId);
  } catch (error) {
    await failRows(boardId, rowJobs.map((entry) => entry.rowId), error instanceof Error ? error.message : "Worker polling failed");
    return;
  }

  const statusResults = await Promise.all(
    rowJobs.map(async (entry) => ({
      jobId: entry.jobId,
      rowId: entry.rowId,
      prompt: entry.prompt,
      generationModel: entry.generationModel,
      resolution: entry.resolution,
      aspectRatio: entry.aspectRatio,
      quantity: entry.quantity,
      videoDurationSeconds: entry.videoDurationSeconds,
      baseGenerationModel: entry.baseGenerationModel,
      baseResolution: entry.baseResolution,
      baseAspectRatio: entry.baseAspectRatio,
      baseQuantity: entry.baseQuantity,
      multiposeGenerationModel: entry.multiposeGenerationModel,
      multiposeResolution: entry.multiposeResolution,
      multiposeAspectRatio: entry.multiposeAspectRatio,
      multiposeQuantity: entry.multiposeQuantity,
      poseMultiplierActive: entry.poseMultiplierActive,
      faceSwapEnabled: entry.faceSwapEnabled,
      upscale: entry.upscale,
      job: await getWorkerJob(entry.jobId),
    })),
  );

  const createdAssets: GeneratedAsset[] = [];

  for (const result of statusResults) {
    const stageEntries = [
      { stage: "base", artifacts: getStageArtifacts(result.job, "base") },
      { stage: "multipose", artifacts: getStageArtifacts(result.job, "multipose") },
      { stage: "face_swap", artifacts: getStageArtifacts(result.job, "face_swap") },
    ];
    for (const { stage, artifacts } of stageEntries) {
      for (const [index, artifact] of artifacts.entries()) {
      try {
        const buffer = await downloadArtifact(artifact);
        const assetContext = stageAssetContext(result, stage);
        const storageSegments = [
          safeStorageSegment(influencerModel?.slug || influencerModel?.name || board.influencerModelId, "influencer"),
          assetContext.mediaKind === "video" ? "videos" : assetContext.mediaKind === "voice" ? "voices" : "images",
          safeStorageSegment(assetContext.galleryMode, "base"),
          safeStorageSegment(assetContext.generationModel, "model"),
          boardSafetySegment(board.name),
        ];
        const storageNamespace = storageSegments.join("/");
        const fileRecord = await saveGeneratedFile(artifact.name || `${result.rowId}-${index + 1}.webp`, buffer, {
          directorySegments: storageSegments,
        });
        createdAssets.push({
          id: randomUUID(),
          influencerModelId: board.influencerModelId,
          boardId,
          rowId: result.rowId,
          createdById: requestedById,
          fileName: fileRecord.fileName,
          filePath: fileRecord.filePath,
          url: fileRecord.url,
          promptSnapshot: result.prompt,
          generationModel: assetContext.generationModel,
          resolution: assetContext.resolution as GeneratedAsset["resolution"],
          aspectRatio: assetContext.aspectRatio as GeneratedAsset["aspectRatio"],
          quantity: assetContext.quantity,
          workflowStage: stage,
          mediaKind: assetContext.mediaKind,
          galleryMode: assetContext.galleryMode,
          storageNamespace,
          width: artifact.width ?? null,
          height: artifact.height ?? null,
          isSyntheticFailure: Boolean(artifact.synthetic_failure || artifact.syntheticFailure),
          failureLabel: artifact.failure_label || artifact.failureLabel || null,
          createdAt: nowIso(),
        });
      } catch {
        continue;
      }
      }
    }
  }

  const updatedStore = await updateStore((store) => {
    const targetBoard = store.boards.find((entry) => entry.id === boardId);
    if (!targetBoard) {
      throw new Error("Board not found");
    }

    store.assets.push(...createdAssets);

    for (const result of statusResults) {
      const row = targetBoard.rows.find((entry) => entry.id === result.rowId);
      if (!row) {
        continue;
      }

      const rowAssets = createdAssets.filter((asset) => asset.rowId === row.id && asset.workflowStage === "base");
      const rowPoseAssets = createdAssets.filter((asset) => asset.rowId === row.id && asset.workflowStage === "multipose");
      const rowFaceSwapAssets = createdAssets.filter((asset) => asset.rowId === row.id && asset.workflowStage === "face_swap");
      const status = deriveRowStatus(getStageArtifacts(result.job, "base"));
      const stageErrors = [getStageError(result.job, "multipose"), getStageError(result.job, "face_swap")].filter(Boolean);

      row.outputAssetIds = rowAssets.map((asset) => asset.id);
      row.poseOutputAssetIds = rowPoseAssets.map((asset) => asset.id);
      row.faceSwapOutputAssetIds = rowFaceSwapAssets.map((asset) => asset.id);
      row.status = rowAssets.length || rowPoseAssets.length || rowFaceSwapAssets.length
        ? stageErrors.length
          ? "PARTIAL"
          : status.status
        : "FAILED";
      row.errorMessage = result.job.error || status.errorMessage || stageErrors.join("; ") || null;
      row.lastRunAt = nowIso();
    }

    targetBoard.updatedAt = nowIso();
    return store;
  });

  await Promise.all(createdAssets.map((asset) => publishAssetCreated(asset.influencerModelId, asset)));
  await publishBoardUpdate(boardId, updatedStore);
}

export async function queueBoardRun(currentUser: AuthUser | null, boardId: string) {
  const viewer = currentUser;
  if (!viewer) {
    throw new Error("Authentication required");
  }

  if (runningBoards.has(boardId)) {
    throw new Error("This board already has an active generation run");
  }

  const preparedStore = await updateStore((store) => {
    const board = assertBoardEdit(store, viewer, boardId);
    const executableRows = board.rows.filter((row) => getRowReadiness(board, row).ready);

    for (const row of board.rows) {
      const readiness = getRowReadiness(board, row);
      row.outputAssetIds = [];
      row.poseOutputAssetIds = [];
      row.faceSwapOutputAssetIds = [];
      row.errorMessage = null;
      if (readiness.ready) {
        row.status = "QUEUED";
      } else {
        row.status = "SKIPPED";
        row.errorMessage = readiness.reason;
      }
    }
    board.updatedAt = nowIso();

    if (executableRows.length === 0) {
      return store;
    }

    return store;
  });

  await publishBoardUpdate(boardId, preparedStore);

  const preparedBoard = preparedStore.boards.find((entry) => entry.id === boardId);
  if (!preparedBoard) {
    throw new Error("Board not found");
  }

  const hasQueuedRows = preparedBoard.rows.some((row) => row.status === "QUEUED");
  if (!hasQueuedRows) {
    return presentBoard(preparedBoard, preparedStore);
  }

  const firstQueuedRow = preparedBoard.rows.find((row) => row.status === "QUEUED");
  const lane = resolveGenerationLane(
    firstQueuedRow ? resolveRowGenerationContext(preparedBoard, firstQueuedRow).generationModel : preparedBoard.settings.generationModel,
  );
  runningBoards.add(boardId);
  enqueueLane(lane, () => processBoardGeneration(boardId, viewer.id).finally(() => {
    runningBoards.delete(boardId);
  }));

  return presentBoard(preparedBoard, preparedStore);
}
