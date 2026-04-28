import { createBoardSeed, createDefaultRows, readStore, updateStore } from "../lib/store.js";
import {
  DEFAULT_POSE_PROMPT_TEMPLATE,
  getMaxBoardQuantityForGenerationModel,
  isNsfwPoseMultiplierWorkspace,
  isPoseMultiplierWorkspace,
  normalizeBoardAspectRatio,
  normalizeOptionalPosePromptTemplates,
  normalizePoseMultiplierResolution,
  normalizePoseMultiplierGenerationModel,
  normalizePosePromptTemplates,
  normalizeQualityForGenerationModel,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
} from "../types/domain.js";
import type { AuthUser, BoardSettings, ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../types/domain.js";

import { publishBoardUpdate } from "./notifications.service.js";
import {
  assertBoardAccess,
  assertBoardEdit,
  assertInfluencerAccess,
  filterBoardsForUser,
  isAgencyAdmin,
  isPlatformAdmin,
  MAX_BOARD_ROWS,
  requireAuthenticatedUser,
} from "./permissions.service.js";
import { presentBoard } from "./presenters.js";
import { queueBoardRun } from "./worker-bridge.service.js";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRows(rows: WorkspaceRow[]): WorkspaceRow[] {
  return [...rows]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((row, index) => ({
      ...row,
      orderIndex: index,
      label: row.label || `${index + 1}`,
      poseMultiplier: typeof row.poseMultiplier === "number" ? row.poseMultiplier : 1,
      upscale: typeof row.upscale === "boolean" ? row.upscale : false,
      faceSwap: typeof row.faceSwap === "boolean" ? row.faceSwap : false,
      audioReference: row.audioReference ?? null,
    }));
}

function isImageNsfwWorkspaceBoardName(name: string): boolean {
  return name.startsWith("__autoscale_workspace_nsfw__:");
}

function normalizeReference(selection: ReferenceSelection): ReferenceSelection {
  return {
    ...selection,
    assetId: selection.assetId || null,
    assetUrl: selection.assetUrl || null,
    uploadPath: selection.uploadPath || null,
    uploadUrl: selection.uploadUrl || null,
  };
}

type BoardSettingsInput = Omit<
  BoardSettings,
  "generationModel" | "resolution" | "poseMultiplierResolution" | "videoDurationSeconds" | "quality" | "aspectRatio" | "sdxlWorkspaceMode" | "poseMultiplierGenerationModel" | "posePromptMode"
> & {
  generationModel: string;
  resolution: string;
  poseMultiplierResolution: string;
  videoDurationSeconds?: number | null;
  quality: string;
  aspectRatio: string;
  sdxlWorkspaceMode: string;
  poseMultiplierGenerationModel: string;
  posePromptMode: string;
};

function normalizeBoardSettingsForBoardName(boardName: string, input: BoardSettingsInput): BoardSettings {
  const normalizedGenerationModel = input.generationModel as WorkspaceBoard["settings"]["generationModel"];
  const isPoseMultiplierWorkspaceLayout = isPoseMultiplierWorkspace(normalizedGenerationModel, input.sdxlWorkspaceMode);
  const isFaceSwapWorkspaceLayout = input.sdxlWorkspaceMode === "FACE_SWAP";
  const isSdxlDefaultWorkspace = normalizedGenerationModel === "sdxl" && !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout;
  const isNsfwPoseMultiplierLayout = isNsfwPoseMultiplierWorkspace(normalizedGenerationModel, input.sdxlWorkspaceMode, isImageNsfwWorkspaceBoardName(boardName));
  const normalizedResolution = normalizeResolutionForGenerationModel(normalizedGenerationModel, input.resolution);
  const normalizedVideoDurationSeconds = normalizeVideoDurationForGenerationModel(normalizedGenerationModel, input.videoDurationSeconds);
  const normalizedQuality = normalizeQualityForGenerationModel(normalizedGenerationModel, input.quality);
  const normalizedAspectRatio = normalizeBoardAspectRatio(normalizedGenerationModel, input.aspectRatio, input.sdxlWorkspaceMode);
  const normalizedQuantity = isPoseMultiplierWorkspaceLayout || isFaceSwapWorkspaceLayout ? 1 : Math.max(1, Math.min(getMaxBoardQuantityForGenerationModel(input.generationModel), input.quantity));
  const normalizedPoseMultiplierGenerationModel = normalizePoseMultiplierGenerationModel(
    input.poseMultiplierGenerationModel,
    normalizedGenerationModel,
  );
  const nextPoseMultiplierGenerationModel = isNsfwPoseMultiplierLayout ? "sdxl" : normalizedPoseMultiplierGenerationModel;
  const normalizedPoseMultiplierResolution = normalizePoseMultiplierResolution(
    input.poseMultiplierResolution || input.resolution,
    nextPoseMultiplierGenerationModel,
    isNsfwPoseMultiplierLayout,
  );
  const normalizedPosePromptTemplates = normalizePosePromptTemplates(input.posePromptTemplates, input.posePromptTemplate);
  const normalizedGlobalReferences = input.globalReferences.map((selection) => normalizeReference(selection));

  return {
    generationModel: normalizedGenerationModel,
    resolution: normalizedResolution,
    poseMultiplierResolution: normalizedPoseMultiplierResolution,
    videoDurationSeconds: normalizedVideoDurationSeconds,
    quality: normalizedQuality,
    aspectRatio: normalizedAspectRatio,
    quantity: normalizedQuantity,
    sdxlWorkspaceMode: isPoseMultiplierWorkspaceLayout ? "POSE_MULTIPLIER" : isFaceSwapWorkspaceLayout ? "FACE_SWAP" : "DEFAULT",
    poseMultiplierEnabled: isPoseMultiplierWorkspaceLayout ? true : isSdxlDefaultWorkspace || isFaceSwapWorkspaceLayout ? false : normalizedQuantity === 1 ? input.poseMultiplierEnabled : false,
    poseMultiplier: Math.max(1, Math.min(4, input.poseMultiplier)),
    poseMultiplierGenerationModel: nextPoseMultiplierGenerationModel,
    upscale: isSdxlDefaultWorkspace ? input.upscale : false,
    faceSwap: isFaceSwapWorkspaceLayout ? true : input.faceSwap,
    autoPromptGen: isFaceSwapWorkspaceLayout ? false : input.autoPromptGen,
    autoPromptImage: isPoseMultiplierWorkspaceLayout || isFaceSwapWorkspaceLayout ? false : input.autoPromptImage,
    posePromptMode: input.posePromptMode === "CUSTOM" ? "CUSTOM" : "AUTO",
    posePromptTemplate: normalizedPosePromptTemplates[0] || DEFAULT_POSE_PROMPT_TEMPLATE,
    posePromptTemplates: normalizedPosePromptTemplates,
    globalReferences: normalizedGlobalReferences,
  };
}

export async function ensureBoard(currentUser: AuthUser | null, influencerModelId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const model = assertInfluencerAccess(current, viewer, influencerModelId);
    const candidateBoards = current.boards.filter((board) => board.influencerModelId === influencerModelId);
    const visibleBoards = filterBoardsForUser(current, viewer, candidateBoards);

    const preferredBoard =
      isPlatformAdmin(viewer) || isAgencyAdmin(viewer)
        ? visibleBoards[0]
        : visibleBoards.find((board) => board.ownerId === viewer.id);

    if (!preferredBoard) {
      current.boards.push(createBoardSeed(model, viewer.id, "Table 1"));
    }

    return current;
  });

  const board =
    store.boards.find((entry) => entry.influencerModelId === influencerModelId && entry.ownerId === viewer.id) ||
    store.boards.find((entry) => entry.influencerModelId === influencerModelId);

  if (!board) {
    throw new Error("Failed to create a board");
  }

  return presentBoard(board, store);
}

export async function getWorkspaceBoard(currentUser: AuthUser | null, boardId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await readStore();
  const board = assertBoardAccess(store, viewer, boardId);
  return presentBoard(board, store);
}

export async function createBoard(currentUser: AuthUser | null, influencerModelId: string, name?: string, sourceBoardId?: string) {
  const viewer = requireAuthenticatedUser(currentUser);

  const store = await updateStore((current) => {
    const model = assertInfluencerAccess(current, viewer, influencerModelId);
    const existingCount = current.boards.filter((board) => board.influencerModelId === influencerModelId && board.ownerId === viewer.id).length;
    const board = createBoardSeed(model, viewer.id, name?.trim() || `Table ${existingCount + 1}`);
    if (sourceBoardId) {
      const sourceBoard = assertBoardAccess(current, viewer, sourceBoardId);
      if (sourceBoard.influencerModelId !== influencerModelId) {
        throw new Error("Source board does not belong to this model");
      }
      board.settings = normalizeBoardSettingsForBoardName(board.name, {
        ...sourceBoard.settings,
        globalReferences: board.settings.globalReferences,
      });
      board.rows = createDefaultRows(4, board.settings);
    }
    current.boards.push(board);
    return current;
  });

  const board = [...store.boards].reverse().find((entry) => entry.ownerId === viewer.id && entry.influencerModelId === influencerModelId);
  if (!board) {
    throw new Error("Failed to create board");
  }

  await publishBoardUpdate(board.id, store);
  return presentBoard(board, store);
}

export async function renameBoard(currentUser: AuthUser | null, boardId: string, name: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, boardId);
    board.name = name.trim() || board.name;
    board.updatedAt = nowIso();
    return current;
  });
  await publishBoardUpdate(boardId, store);
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    throw new Error("Board not found");
  }
  return presentBoard(board, store);
}

export async function deleteBoard(currentUser: AuthUser | null, boardId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, boardId);
    current.boards = current.boards.filter((entry) => entry.id !== board.id);
    return current;
  });
  return true;
}

export async function addBoardRow(currentUser: AuthUser | null, boardId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, boardId);
    if (board.rows.length >= MAX_BOARD_ROWS) {
      throw new Error(`A board can contain at most ${MAX_BOARD_ROWS} rows`);
    }
    const [newRow] = createDefaultRows(1, {
      poseMultiplier: board.settings.poseMultiplier,
      upscale: board.settings.upscale,
      faceSwap: board.settings.faceSwap,
    });
    newRow.orderIndex = board.rows.length;
    newRow.label = `${board.rows.length + 1}`;
    board.rows.push(newRow);
    board.updatedAt = nowIso();
    return current;
  });
  await publishBoardUpdate(boardId, store);
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    throw new Error("Board not found");
  }
  return presentBoard(board, store);
}

export async function deleteBoardRow(currentUser: AuthUser | null, boardId: string, rowId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, boardId);
    if (board.rows.length <= 1) {
      throw new Error("A board must keep at least one row");
    }
    board.rows = normalizeRows(board.rows.filter((row) => row.id !== rowId));
    board.updatedAt = nowIso();
    return current;
  });
  await publishBoardUpdate(boardId, store);
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    throw new Error("Board not found");
  }
  return presentBoard(board, store);
}

export async function updateBoardRow(
  currentUser: AuthUser | null,
  input: {
    boardId: string;
    rowId: string;
    label?: string | null;
    prompt?: string | null;
    poseMultiplier?: number | null;
    posePromptTemplates?: string[] | null;
    faceSwap?: boolean | null;
    upscale?: boolean | null;
    reference?: ReferenceSelection | null;
    audioReference?: ReferenceSelection | null;
    clearReference?: boolean | null;
    clearAudioReference?: boolean | null;
    clearPosePromptTemplates?: boolean | null;
  },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, input.boardId);
    const row = board.rows.find((entry) => entry.id === input.rowId);
    if (!row) {
      throw new Error("Row not found");
    }

    if (typeof input.label === "string") {
      row.label = input.label;
    }
    if (typeof input.prompt === "string") {
      row.prompt = input.prompt;
    }
    if (typeof input.poseMultiplier === "number") {
      row.poseMultiplier = Math.max(1, Math.min(4, input.poseMultiplier));
    }
    if (input.clearPosePromptTemplates) {
      row.posePromptTemplates = null;
    } else if (Array.isArray(input.posePromptTemplates)) {
      row.posePromptTemplates = normalizeOptionalPosePromptTemplates(
        input.posePromptTemplates,
        board.settings.posePromptTemplates[0] || board.settings.posePromptTemplate || DEFAULT_POSE_PROMPT_TEMPLATE,
      );
    }
    if (typeof input.faceSwap === "boolean") {
      row.faceSwap = board.settings.sdxlWorkspaceMode === "FACE_SWAP" ? true : input.faceSwap;
    }
    if (typeof input.upscale === "boolean") {
      row.upscale = board.settings.sdxlWorkspaceMode !== "FACE_SWAP" && board.settings.generationModel === "sdxl" && !isPoseMultiplierWorkspace(board.settings.generationModel, board.settings.sdxlWorkspaceMode)
        ? input.upscale
        : false;
    }
    if (input.clearReference) {
      row.reference = null;
    } else if (input.reference) {
      row.reference = normalizeReference(input.reference);
    }
    if (input.clearAudioReference) {
      row.audioReference = null;
    } else if (input.audioReference) {
      row.audioReference = normalizeReference(input.audioReference);
    }

    row.status = "IDLE";
    row.errorMessage = null;
    board.updatedAt = nowIso();
    return current;
  });
  await publishBoardUpdate(input.boardId, store);
  const board = store.boards.find((entry) => entry.id === input.boardId);
  if (!board) {
    throw new Error("Board not found");
  }
  return presentBoard(board, store);
}

export async function updateBoardSettings(
  currentUser: AuthUser | null,
  boardId: string,
  input: BoardSettingsInput,
) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, boardId);
    board.settings = normalizeBoardSettingsForBoardName(board.name, input);
    board.rows = board.rows.map((row) => ({
      ...row,
      poseMultiplier: board.settings.poseMultiplier,
      upscale: board.settings.upscale,
      faceSwap: board.settings.faceSwap,
      status: "IDLE",
      errorMessage: null,
    }));
    board.updatedAt = nowIso();
    return current;
  });
  await publishBoardUpdate(boardId, store);
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    throw new Error("Board not found");
  }
  return presentBoard(board, store);
}

export async function clearBoard(currentUser: AuthUser | null, boardId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    const board = assertBoardEdit(current, viewer, boardId);
    board.rows = normalizeRows(
      board.rows.map((row) => ({
        ...row,
        prompt: "",
        reference: null,
        audioReference: null,
        status: "IDLE",
        errorMessage: null,
        outputAssetIds: [],
      })),
    );
    board.updatedAt = nowIso();
    return current;
  });
  await publishBoardUpdate(boardId, store);
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    throw new Error("Board not found");
  }
  return presentBoard(board, store);
}

export async function runBoard(currentUser: AuthUser | null, boardId: string) {
  return queueBoardRun(currentUser, boardId);
}
