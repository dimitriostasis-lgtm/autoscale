import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";
import { readStore, updateStore } from "../lib/store.js";
import { saveGeneratedFile, toAbsoluteStoragePath } from "../lib/storage.js";
import { normalizeResolutionForGenerationModel } from "../types/domain.js";
import type { AuthUser, GeneratedAsset, GenerationStatus, ReferenceSelection, StoreData } from "../types/domain.js";

import { publishAssetCreated, publishBoardUpdate } from "./notifications.service.js";
import { assertBoardEdit } from "./permissions.service.js";
import { presentBoard } from "./presenters.js";

const WORKER_TIMEOUT_MS = 20 * 60 * 1000;
const WORKER_POLL_INTERVAL_MS = 2500;
const runningBoards = new Set<string>();

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

interface WorkerJobStatus {
  job_id: string;
  status: string;
  error?: string | null;
  artifacts?: WorkerArtifact[];
}

interface RowJobLink {
  rowId: string;
  jobId: string;
  prompt: string;
  generationModel: GeneratedAsset["generationModel"];
  resolution: GeneratedAsset["resolution"];
  aspectRatio: GeneratedAsset["aspectRatio"];
  quantity: number;
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
  prompt: string;
  generationModel: string;
  resolution: string;
  aspectRatio: string;
  quantity: number;
  globalReferences: FilePayload[];
  rowReference: FilePayload;
  isFirst: boolean;
  isLast: boolean;
}): Promise<string> {
  const formData = new FormData();
  formData.append("prompt", options.prompt);
  formData.append("model", options.generationModel);
  formData.append("resolution", options.resolution);
  formData.append("aspect_ratio", options.aspectRatio);
  formData.append("quantity", String(options.quantity));
  formData.append("headless", "false");
  formData.append("reference_mode", options.isFirst ? "replace" : "patch_slot");
  formData.append("reference_patch_indices", "[]");
  formData.append("reuse_browser", "true");
  formData.append("settings_already_set", options.isFirst ? "false" : "true");
  formData.append("fire_only", options.isLast ? "false" : "true");

  if (options.isFirst) {
    for (const reference of options.globalReferences) {
      formData.append("reference_images", new Blob([bufferToArrayBuffer(reference.buffer)]), reference.fileName);
    }
  }

  formData.append(
    "reference_images",
    new Blob([bufferToArrayBuffer(options.rowReference.buffer)]),
    options.rowReference.fileName,
  );

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
        row.lastRunAt = nowIso();
      }
    }
  });
  await publishBoardUpdate(boardId, updatedStore);
}

async function processBoardGeneration(boardId: string, requestedById: string): Promise<void> {
  const initialStore = await readStore();
  const board = initialStore.boards.find((entry) => entry.id === boardId);
  if (!board) {
    return;
  }

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

      if (!row.reference) {
        throw new Error("Missing row reference image");
      }

      const rowReference = await readSelectionFile(row.reference, initialStore);
      const poseMultiplierActive = board.settings.poseMultiplierEnabled && row.poseMultiplier > 1;
      const generationModel = poseMultiplierActive ? board.settings.poseMultiplierGenerationModel : board.settings.generationModel;
      const resolution = normalizeResolutionForGenerationModel(generationModel, board.settings.resolution);
      const quantity = poseMultiplierActive ? Math.max(1, Math.min(4, row.poseMultiplier)) : board.settings.quantity;
      const jobId = await createWorkerJob({
        prompt: row.prompt,
        generationModel,
        resolution,
        aspectRatio: board.settings.aspectRatio,
        quantity,
        globalReferences,
        rowReference,
        isFirst: index === 0,
        isLast: index === activeRows.length - 1,
      });

      rowJobs.push({ rowId: row.id, jobId, prompt: row.prompt, generationModel, resolution, aspectRatio: board.settings.aspectRatio, quantity });
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
      rowId: entry.rowId,
      prompt: entry.prompt,
      generationModel: entry.generationModel,
      resolution: entry.resolution,
      aspectRatio: entry.aspectRatio,
      quantity: entry.quantity,
      job: await getWorkerJob(entry.jobId),
    })),
  );

  const createdAssets: GeneratedAsset[] = [];

  for (const result of statusResults) {
    const artifacts = result.job.artifacts || [];
    for (const [index, artifact] of artifacts.entries()) {
      try {
        const buffer = await downloadArtifact(artifact);
        const fileRecord = await saveGeneratedFile(artifact.name || `${result.rowId}-${index + 1}.webp`, buffer);
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
          generationModel: result.generationModel,
          resolution: result.resolution,
          aspectRatio: result.aspectRatio,
          quantity: result.quantity,
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

      const rowAssets = createdAssets.filter((asset) => asset.rowId === row.id);
      const status = deriveRowStatus(result.job.artifacts || []);

      row.outputAssetIds = rowAssets.map((asset) => asset.id);
      row.status = rowAssets.length ? status.status : "FAILED";
      row.errorMessage = result.job.error || status.errorMessage;
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
    const executableRows = board.rows.filter((row) => row.prompt.trim() && row.reference);

    for (const row of board.rows) {
      row.outputAssetIds = [];
      row.errorMessage = null;
      if (row.prompt.trim() && row.reference) {
        row.status = "QUEUED";
      } else {
        row.status = "SKIPPED";
        row.errorMessage = row.prompt.trim() || row.reference ? "Prompt and a reference image are both required" : null;
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

  runningBoards.add(boardId);
  void processBoardGeneration(boardId, viewer.id).finally(() => {
    runningBoards.delete(boardId);
  });

  return presentBoard(preparedBoard, preparedStore);
}