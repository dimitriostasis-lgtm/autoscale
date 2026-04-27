import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient, useMutation, useQuery, useSubscription } from "@apollo/client/react";

import playgroundReadyImage from "../assets/playground-ready.png";
import { InfluencerAvatar } from "../components/model/InfluencerAvatar";
import { BoardTabs } from "../components/workspace/BoardTabs";
import { ImagePickerModal } from "../components/workspace/ImagePickerModal";
import { SettingsPanel } from "../components/workspace/SettingsPanel";
import { WorkspaceGrid } from "../components/workspace/WorkspaceGrid";
import { cx } from "../lib/cx";
import type { WorkspaceMode } from "../lib/router";
import { uploadReferenceFile } from "../lib/uploads";
import { INFLUENCER_MODEL_QUERY, MODEL_ASSETS_QUERY } from "../queries/model";
import {
  ADD_ROW_MUTATION,
  BOARD_DETAIL_QUERY,
  BOARD_UPDATED_SUBSCRIPTION,
  CLEAR_BOARD_MUTATION,
  CREATE_BOARD_MUTATION,
  DELETE_BOARD_MUTATION,
  DELETE_ROW_MUTATION,
  RUN_BOARD_MUTATION,
  UPDATE_ROW_MUTATION,
  UPDATE_SETTINGS_MUTATION,
} from "../queries/workspace";
import {
  getAspectRatioOptionsForGenerationModel,
  getMaxQuantityForGenerationModel,
  getResolutionOptionsForGenerationModel,
  getVideoDurationOptionsForGenerationModel,
  imageGenerationModelOptions,
  isVideoGenerationModel,
  normalizeAspectRatioForGenerationModel,
  normalizeQualityForGenerationModel,
  normalizePoseMultiplierGenerationModel,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
  resolutionLabels,
  theme,
  videoGenerationModelOptions,
  videoNsfwGenerationModelOptions,
  workerModelLabels,
} from "../styles/theme";
import type { BoardSettings, GeneratedAsset, InfluencerModel, ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../types";

interface ModelWorkspacePageProps {
  slug: string;
  boardId?: string | null;
  mode: WorkspaceMode;
  onSelectBoard: (boardId: string) => void;
  onSelectMode: (mode: WorkspaceMode) => void;
}

interface CreateBoardMutationData {
  createBoard: {
    id: string;
  };
}

interface BoardUpdatedSubscriptionData {
  boardUpdated: WorkspaceBoard;
}

type WorkspaceBoardTab = Pick<WorkspaceBoard, "id" | "name" | "updatedAt">;

type WorkspaceGenerationKind = "image" | "video" | "voice";
type WorkspaceTableMode = Exclude<WorkspaceMode, "playground">;

interface WorkspaceModeMeta {
  mode: WorkspaceTableMode;
  kind: WorkspaceGenerationKind;
  menuLabel: string;
  dropdownLabel: string;
  safetyLabel: "SFW" | "NSFW";
}

const workspaceModeMenus: Array<{
  kind: WorkspaceGenerationKind;
  label: string;
  hasSafetyMenu?: boolean;
  modes: WorkspaceModeMeta[];
}> = [
  {
    kind: "image",
    label: "Image Gen",
    modes: [
      { mode: "image-sfw", kind: "image", menuLabel: "Image Gen", dropdownLabel: "SFW IMAGES", safetyLabel: "SFW" },
      { mode: "image-nsfw", kind: "image", menuLabel: "Image Gen", dropdownLabel: "NSFW IMAGES", safetyLabel: "NSFW" },
    ],
  },
  {
    kind: "video",
    label: "Video Gen",
    modes: [
      { mode: "video-sfw", kind: "video", menuLabel: "Video Gen", dropdownLabel: "SFW VIDEOS", safetyLabel: "SFW" },
      { mode: "video-nsfw", kind: "video", menuLabel: "Video Gen", dropdownLabel: "NSFW VIDEOS", safetyLabel: "NSFW" },
    ],
  },
  {
    kind: "voice",
    label: "Voice Gen",
    hasSafetyMenu: false,
    modes: [
      { mode: "voice-sfw", kind: "voice", menuLabel: "Voice Gen", dropdownLabel: "Voice Gen", safetyLabel: "SFW" },
      { mode: "voice-nsfw", kind: "voice", menuLabel: "Voice Gen", dropdownLabel: "Voice Gen", safetyLabel: "NSFW" },
    ],
  },
];

const workspaceModeDefaultByKind: Record<WorkspaceGenerationKind, WorkspaceTableMode> = {
  image: "image-sfw",
  video: "video-sfw",
  voice: "voice-sfw",
};

const workspaceModeMetaByMode = Object.fromEntries(
  workspaceModeMenus.flatMap((menu) => menu.modes.map((mode) => [mode.mode, mode])),
) as Record<WorkspaceTableMode, WorkspaceModeMeta>;

const workspaceModeGenerationModelOptions: Partial<Record<WorkspaceMode, string[]>> = {
  "image-sfw": [...imageGenerationModelOptions],
  "image-nsfw": ["sd_4_5", "sdxl"],
  "video-sfw": [...videoGenerationModelOptions],
  "video-nsfw": [...videoNsfwGenerationModelOptions],
  "voice-sfw": [...imageGenerationModelOptions],
  "voice-nsfw": [...imageGenerationModelOptions],
};

function resolveWorkspaceGenerationModels(mode: WorkspaceMode, modelGenerationModels: string[]): string[] {
  const modeGenerationModels = workspaceModeGenerationModelOptions[mode];
  if (!modeGenerationModels) {
    return modelGenerationModels;
  }

  return modeGenerationModels.filter((generationModel) => modelGenerationModels.includes(generationModel));
}

function normalizeSettingsForGenerationModel(settings: BoardSettings, generationModel: string): BoardSettings {
  const quantity = Math.min(settings.quantity, getMaxQuantityForGenerationModel(generationModel));

  return {
    ...settings,
    generationModel,
    resolution: normalizeResolutionForGenerationModel(generationModel, settings.resolution),
    videoDurationSeconds: normalizeVideoDurationForGenerationModel(generationModel, settings.videoDurationSeconds),
    quality: normalizeQualityForGenerationModel(generationModel, settings.quality),
    aspectRatio: normalizeAspectRatioForGenerationModel(generationModel, settings.aspectRatio),
    quantity,
    poseMultiplierEnabled: quantity === 1 ? settings.poseMultiplierEnabled : false,
    poseMultiplierGenerationModel: normalizePoseMultiplierGenerationModel(settings.poseMultiplierGenerationModel, generationModel),
  };
}

type PickerState =
  | { kind: "row"; row: WorkspaceRow }
  | { kind: "global"; slotIndex: number; source?: "tray" };

const maxPlaygroundReferenceCount = 10;

function buildUploadReference(slotIndex: number, fileName: string, upload: Awaited<ReturnType<typeof uploadReferenceFile>>): ReferenceSelection {
  return {
    id: `upload-${slotIndex}-${upload.fileName}`,
    slotIndex,
    label: fileName,
    sourceType: "UPLOAD",
    assetId: null,
    assetUrl: null,
    uploadPath: upload.filePath,
    uploadUrl: upload.url,
  };
}

function buildAssetReference(slotIndex: number, asset: GeneratedAsset): ReferenceSelection {
  return {
    id: `asset-${slotIndex}-${asset.id}`,
    slotIndex,
    label: asset.fileName,
    sourceType: "ASSET",
    assetId: asset.id,
    assetUrl: asset.url,
    uploadPath: null,
    uploadUrl: null,
    asset,
  };
}

function buildEmptyGlobalReference(slotIndex: number): ReferenceSelection {
  return {
    id: `global-empty-${slotIndex}`,
    slotIndex,
    label: `Global ${slotIndex + 1}`,
    sourceType: "UPLOAD",
    assetId: null,
    assetUrl: null,
    uploadPath: null,
    uploadUrl: null,
    asset: null,
  };
}

function previewSourceForReference(reference: ReferenceSelection): string | null {
  return reference.asset?.url || reference.assetUrl || reference.uploadUrl || null;
}

function filledGlobalReferences(settings: BoardSettings): ReferenceSelection[] {
  return settings.globalReferences
    .filter((reference) => previewSourceForReference(reference))
    .sort((left, right) => left.slotIndex - right.slotIndex);
}

function normalizeGlobalReferenceTray(references: ReferenceSelection[]): ReferenceSelection[] {
  const filledReferences = references
    .filter((reference) => previewSourceForReference(reference))
    .slice(0, maxPlaygroundReferenceCount)
    .map((reference, index) => ({ ...reference, slotIndex: index }));

  return [
    ...filledReferences,
    ...Array.from({ length: maxPlaygroundReferenceCount - filledReferences.length }, (_, index) =>
      buildEmptyGlobalReference(filledReferences.length + index),
    ),
  ];
}

function upsertGlobalReference(settings: BoardSettings, reference: ReferenceSelection): ReferenceSelection[] {
  const references = filledGlobalReferences(settings);
  const targetIndex = Math.max(0, Math.min(reference.slotIndex, maxPlaygroundReferenceCount - 1));

  if (targetIndex < references.length) {
    references[targetIndex] = reference;
  } else {
    references.push(reference);
  }

  return normalizeGlobalReferenceTray(references);
}

function replaceGlobalReferenceAtSlot(settings: BoardSettings, reference: ReferenceSelection): ReferenceSelection[] {
  const replacedReferences = settings.globalReferences.map((selection) => (selection.slotIndex === reference.slotIndex ? reference : selection));

  if (replacedReferences.some((selection) => selection.id === reference.id)) {
    return replacedReferences.sort((left, right) => left.slotIndex - right.slotIndex);
  }

  return [...replacedReferences, reference].sort((left, right) => left.slotIndex - right.slotIndex);
}

function moveReferenceToIndex(references: ReferenceSelection[], sourceReferenceId: string, targetIndex: number): ReferenceSelection[] {
  const sourceIndex = references.findIndex((reference) => reference.id === sourceReferenceId);

  if (sourceIndex === -1) {
    return references;
  }

  const nextReferences = [...references];
  const [sourceReference] = nextReferences.splice(sourceIndex, 1);
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, nextReferences.length));

  nextReferences.splice(boundedTargetIndex, 0, sourceReference);

  return nextReferences;
}

function removeGlobalReference(settings: BoardSettings, referenceId: string): ReferenceSelection[] {
  return normalizeGlobalReferenceTray(filledGlobalReferences(settings).filter((reference) => reference.id !== referenceId));
}

function reorderGlobalReference(settings: BoardSettings, sourceReferenceId: string, targetIndex: number): ReferenceSelection[] {
  return normalizeGlobalReferenceTray(moveReferenceToIndex(filledGlobalReferences(settings), sourceReferenceId, targetIndex));
}

function buildPositionNamedBoards(boards: WorkspaceBoardTab[]): WorkspaceBoardTab[] {
  return boards.map((board, index) => ({
    ...board,
    name: `Table ${index + 1}`,
  }));
}

const workspaceModeBoardPrefixes: Partial<Record<WorkspaceMode, string>> = {
  "image-nsfw": "__autoscale_workspace_nsfw__:",
  playground: "__autoscale_workspace_playground__:",
  "video-sfw": "__autoscale_workspace_video_sfw__:",
  "video-nsfw": "__autoscale_workspace_video_nsfw__:",
  "voice-sfw": "__autoscale_workspace_voice_sfw__:",
  "voice-nsfw": "__autoscale_workspace_voice_nsfw__:",
};

function resolveBoardWorkspaceMode(board: WorkspaceBoardTab): WorkspaceMode | null {
  for (const [mode, prefix] of Object.entries(workspaceModeBoardPrefixes) as Array<[WorkspaceMode, string]>) {
    if (board.name.startsWith(prefix)) {
      return mode;
    }
  }

  return "image-sfw";
}

function filterBoardsForWorkspaceMode(boards: WorkspaceBoardTab[], mode: WorkspaceMode): WorkspaceBoardTab[] {
  return boards.filter((board) => resolveBoardWorkspaceMode(board) === mode);
}

function buildBoardNameForWorkspaceMode(mode: WorkspaceMode, index: number): string {
  const label = `Table ${index}`;
  const prefix = workspaceModeBoardPrefixes[mode];

  return prefix ? `${prefix}${label}` : label;
}

function GenerationModeMenus({ activeMode, onSelectMode }: { activeMode: WorkspaceMode; onSelectMode: (mode: WorkspaceMode) => void }) {
  const [openKind, setOpenKind] = useState<WorkspaceGenerationKind | null>(null);
  const activeMeta = activeMode === "playground" ? null : workspaceModeMetaByMode[activeMode];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-[#262626] p-1">
      {workspaceModeMenus.map((menu) => {
        const activeMenu = activeMeta?.kind === menu.kind;
        const hasSafetyMenu = menu.hasSafetyMenu !== false && menu.modes.length > 1;
        const isOpen = hasSafetyMenu && openKind === menu.kind;
        const defaultMode = workspaceModeDefaultByKind[menu.kind];

        return (
          <div
            key={menu.kind}
            className="relative -mb-2 pb-2"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setOpenKind(null);
              }
            }}
            onFocus={() => {
              if (hasSafetyMenu) {
                setOpenKind(menu.kind);
              }
            }}
            onMouseEnter={() => {
              if (hasSafetyMenu) {
                setOpenKind(menu.kind);
              }
            }}
            onMouseLeave={() => setOpenKind((current) => (current === menu.kind ? null : current))}
          >
            <button
              aria-expanded={hasSafetyMenu ? isOpen : undefined}
              aria-haspopup={hasSafetyMenu ? "menu" : undefined}
              className={cx(
                "inline-flex min-w-24 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                activeMenu ? "bg-lime-300 text-black" : "text-white/54 hover:bg-white/[0.06] hover:text-white/82",
              )}
              onClick={() => {
                setOpenKind(null);
                onSelectMode(defaultMode);
              }}
              type="button"
            >
              {menu.label}
              {hasSafetyMenu ? (
                <span aria-hidden="true" className="text-[10px] opacity-70">
                  v
                </span>
              ) : null}
            </button>

            {isOpen ? (
              <div className="absolute left-0 top-full z-30 w-36 overflow-hidden rounded-2xl border border-white/10 bg-[#202020] p-1 shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
                {menu.modes.map((item) => {
                  const active = activeMode === item.mode;

                  return (
                    <button
                      key={item.mode}
                      className={cx(
                        "block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] transition",
                        active ? "bg-lime-300 text-black" : "text-white/62 hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => {
                        setOpenKind(null);
                        onSelectMode(item.mode);
                      }}
                      type="button"
                    >
                      {item.dropdownLabel}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        className={cx(
          "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
          activeMode === "playground" ? "bg-lime-300 text-black" : "text-white/54 hover:bg-white/[0.06] hover:text-white/82",
        )}
        onClick={() => {
          setOpenKind(null);
          onSelectMode("playground");
        }}
        type="button"
      >
        Playground
      </button>
    </div>
  );
}

function PlaygroundSurface({
  allowedGenerationModels,
  assets,
  board,
  onPickReference,
  onSettingsChange,
  onUploadReferences,
}: {
  allowedGenerationModels: string[];
  assets: GeneratedAsset[];
  board: WorkspaceBoard | null;
  onPickReference: (slotIndex: number) => void;
  onSettingsChange: (nextSettings: BoardSettings) => void;
  onUploadReferences: (slotIndex: number, files: File[]) => Promise<void> | void;
}) {
  const [prompt, setPrompt] = useState("");
  const [referenceMenuPosition, setReferenceMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [draggedReferenceId, setDraggedReferenceId] = useState<string | null>(null);
  const [referenceDropIndex, setReferenceDropIndex] = useState<number | null>(null);
  const [referenceDragPreview, setReferenceDragPreview] = useState<{
    reference: ReferenceSelection;
    x: number;
    offsetX: number;
    railLeft: number;
    railRight: number;
    railTop: number;
    width: number;
    height: number;
  } | null>(null);
  const referenceTileElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const referenceMenuRef = useRef<HTMLDivElement | null>(null);
  const addReferenceButtonRef = useRef<HTMLButtonElement | null>(null);
  const referenceRailRef = useRef<HTMLDivElement | null>(null);
  const visibleAssets = assets.slice(0, 18);

  useEffect(() => {
    if (!referenceMenuPosition) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (referenceMenuRef.current?.contains(target) || addReferenceButtonRef.current?.contains(target)) {
        return;
      }

      setReferenceMenuPosition(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setReferenceMenuPosition(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [referenceMenuPosition]);

  if (!board) {
    return (
      <div className="relative min-h-[68vh] overflow-hidden bg-[color:var(--surface-card-strong)]">
        <div className="grid gap-px bg-white/8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleAssets.map((asset) => (
            <button key={asset.id} className="group relative aspect-[3/4] overflow-hidden bg-[#202020] text-left" type="button">
              <img alt={asset.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={asset.url} />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                <p className="line-clamp-1 text-sm font-semibold text-white">{asset.fileName}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/62">{asset.promptSnapshot}</p>
              </div>
            </button>
          ))}

          {!visibleAssets.length ? (
            <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4 flex min-h-[420px] items-center justify-center bg-[color:var(--surface-card)] px-6 text-center">
              <img alt="Ready to bring your idea to life?" className="w-full max-w-[680px] select-none object-contain opacity-95" draggable={false} src={playgroundReadyImage} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const settings = board.settings;
  const generationModel = settings.generationModel;
  const videoGenerationModel = isVideoGenerationModel(generationModel);
  const allowedResolutionOptions = getResolutionOptionsForGenerationModel(generationModel);
  const allowedAspectRatioOptions = getAspectRatioOptionsForGenerationModel(generationModel);
  const allowedVideoDurationOptions = getVideoDurationOptionsForGenerationModel(generationModel);
  const maxQuantity = getMaxQuantityForGenerationModel(generationModel);
  const quantityOptions = Array.from({ length: maxQuantity }, (_, index) => index + 1);
  const imageModelSelectOptions = allowedGenerationModels.filter((option) => imageGenerationModelOptions.includes(option as (typeof imageGenerationModelOptions)[number]));
  const videoModelSelectOptions = allowedGenerationModels.filter(
    (option) => videoGenerationModelOptions.includes(option as (typeof videoGenerationModelOptions)[number]) || videoNsfwGenerationModelOptions.includes(option as (typeof videoNsfwGenerationModelOptions)[number]),
  );
  const activeGlobalReferences = filledGlobalReferences(settings);
  const draggedReference = draggedReferenceId ? activeGlobalReferences.find((reference) => reference.id === draggedReferenceId) ?? null : null;
  const referencesWithoutDragged = draggedReference
    ? activeGlobalReferences.filter((reference) => reference.id !== draggedReference.id)
    : activeGlobalReferences;
  const draggedReferenceOriginalIndex = draggedReference
    ? activeGlobalReferences.findIndex((reference) => reference.id === draggedReference.id)
    : -1;
  const activeReferenceDropIndex = draggedReference
    ? Math.max(0, Math.min(referenceDropIndex ?? draggedReferenceOriginalIndex, referencesWithoutDragged.length))
    : null;
  const previewReferenceItems = draggedReference
    ? [
        ...referencesWithoutDragged.slice(0, activeReferenceDropIndex ?? 0).map((reference) => ({ kind: "reference" as const, reference })),
        { kind: "drop-slot" as const, id: "reference-drop-slot" },
        ...referencesWithoutDragged.slice(activeReferenceDropIndex ?? 0).map((reference) => ({ kind: "reference" as const, reference })),
      ]
    : activeGlobalReferences.map((reference) => ({ kind: "reference" as const, reference }));
  const nextReferenceSlot = activeGlobalReferences.length;
  const canAddReference = nextReferenceSlot < maxPlaygroundReferenceCount;

  function updateGenerationModel(nextGenerationModel: string) {
    const nextVideoGenerationModel = isVideoGenerationModel(nextGenerationModel);
    const nextQuantity = Math.min(settings.quantity, getMaxQuantityForGenerationModel(nextGenerationModel));

    onSettingsChange({
      ...settings,
      generationModel: nextGenerationModel,
      resolution: normalizeResolutionForGenerationModel(nextGenerationModel, settings.resolution),
      videoDurationSeconds: normalizeVideoDurationForGenerationModel(nextGenerationModel, settings.videoDurationSeconds),
      quality: normalizeQualityForGenerationModel(nextGenerationModel, settings.quality),
      aspectRatio: normalizeAspectRatioForGenerationModel(nextGenerationModel, settings.aspectRatio),
      quantity: nextQuantity,
      poseMultiplierEnabled: nextQuantity === 1 && !nextVideoGenerationModel ? settings.poseMultiplierEnabled : false,
      poseMultiplierGenerationModel: normalizePoseMultiplierGenerationModel(settings.poseMultiplierGenerationModel, nextGenerationModel),
    });
  }

  const controlClass =
    "h-10 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-xs font-semibold text-[color:var(--text-strong)] outline-none transition hover:bg-[color:var(--surface-soft-hover)] focus:border-[color:var(--focus-ring)]";
  const iconTileClass =
    "grid size-14 shrink-0 place-items-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)] transition-all duration-200 ease-out hover:bg-[color:var(--surface-soft-hover)]";
  const addReferenceButtonClass =
    "relative -top-[5.5px] grid size-8 shrink-0 place-items-center rounded-[0.625rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-strong)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--accent-text)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]";

  function resolveReferenceDropIndex(clientX: number, sourceReferenceId: string): number {
    const tileBounds = [];

    for (const reference of activeGlobalReferences.filter((currentReference) => currentReference.id !== sourceReferenceId)) {
      if (reference.id === sourceReferenceId) {
        continue;
      }

      const tile = referenceTileElementsRef.current.get(reference.id);
      if (!tile) {
        continue;
      }

      const bounds = tile.getBoundingClientRect();
      tileBounds.push({ centerX: bounds.left + bounds.width / 2, left: bounds.left });
    }

    const orderedTileBounds = tileBounds.sort((left, right) => left.left - right.left);
    const beforeIndex = orderedTileBounds.findIndex((bounds) => clientX < bounds.centerX);

    return beforeIndex === -1 ? orderedTileBounds.length : beforeIndex;
  }

  function finishReferenceDrag() {
    if (draggedReferenceId && referenceDropIndex !== null) {
      onSettingsChange({
        ...settings,
        globalReferences: reorderGlobalReference(settings, draggedReferenceId, referenceDropIndex),
      });
    }

    setDraggedReferenceId(null);
    setReferenceDropIndex(null);
    setReferenceDragPreview(null);
  }

  return (
    <div className="relative min-h-[68vh] overflow-hidden bg-[color:var(--surface-card-strong)] pb-44">
      <div className="grid gap-px bg-white/8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleAssets.map((asset) => (
          <button key={asset.id} className="group relative aspect-[3/4] overflow-hidden bg-[#202020] text-left" type="button">
            <img alt={asset.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={asset.url} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
              <p className="line-clamp-1 text-sm font-semibold text-white">{asset.fileName}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/62">{asset.promptSnapshot}</p>
            </div>
          </button>
        ))}

        {!visibleAssets.length ? (
          <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4 flex min-h-[420px] items-center justify-center bg-[color:var(--surface-card)] px-6 text-center">
            <img
              alt="Ready to bring your idea to life?"
              className="w-full max-w-[680px] select-none object-contain opacity-95"
              draggable={false}
              src={playgroundReadyImage}
            />
          </div>
        ) : null}
      </div>

      <form
        className="sticky bottom-4 z-30 mx-auto mt-4 w-[min(calc(100%-2rem),70rem)] rounded-[26px] border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-card-strong)] p-1 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl"
        style={{
          background:
            "linear-gradient(115deg, color-mix(in srgb, var(--text-strong) 8%, transparent) 27.54%, color-mix(in srgb, var(--surface-card) 38%, transparent) 85.5%), var(--surface-card-strong)",
        }}
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset className="flex min-w-0 flex-col gap-4 rounded-[22px] border border-[color:var(--surface-border)] p-4 sm:p-5 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 space-y-3">
            <div
              className="relative flex min-h-16 items-center gap-2 overflow-x-auto overflow-y-visible pb-2"
              onPointerCancel={finishReferenceDrag}
              onPointerMove={(event) => {
                if (!draggedReferenceId) {
                  return;
                }

                setReferenceDragPreview((current) => {
                  if (!current) {
                    return current;
                  }

                  const railBounds = referenceRailRef.current?.getBoundingClientRect();

                  return {
                    ...current,
                    railLeft: railBounds?.left ?? current.railLeft,
                    railRight: railBounds?.right ?? current.railRight,
                    x: event.clientX,
                  };
                });
                setReferenceDropIndex((current) => {
                  const nextDropIndex = resolveReferenceDropIndex(event.clientX, draggedReferenceId);
                  return current === nextDropIndex ? current : nextDropIndex;
                });
              }}
              onPointerUp={finishReferenceDrag}
              ref={referenceRailRef}
            >
              {previewReferenceItems.map((item, index) => {
                if (item.kind === "drop-slot") {
                  return (
                    <div
                      key={item.id}
                      className="size-14 shrink-0 rounded-xl border-2 border-dashed border-[color:var(--accent-main)] bg-[color:var(--surface-soft-hover)] shadow-[0_0_22px_color-mix(in_srgb,var(--accent-main)_28%,transparent)] transition-all duration-200"
                    />
                  );
                }

                const { reference } = item;
                const previewSrc = previewSourceForReference(reference);

                return (
                  <div
                    key={reference.id || index}
                    aria-grabbed={draggedReferenceId === reference.id}
                    className={cx(iconTileClass, "group relative cursor-grab touch-none select-none overflow-visible active:cursor-grabbing")}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }

                      const bounds = event.currentTarget.getBoundingClientRect();
                      const railBounds = referenceRailRef.current?.getBoundingClientRect() ?? bounds;
                      try {
                        referenceRailRef.current?.setPointerCapture(event.pointerId);
                      } catch {
                        // Some browsers only allow the original pointer target to capture.
                      }
                      setReferenceMenuPosition(null);
                      setDraggedReferenceId(reference.id);
                      setReferenceDropIndex(activeGlobalReferences.findIndex((currentReference) => currentReference.id === reference.id));
                      setReferenceDragPreview({
                        reference,
                        x: event.clientX,
                        offsetX: event.clientX - bounds.left,
                        railLeft: railBounds.left,
                        railRight: railBounds.right,
                        railTop: bounds.top,
                        width: bounds.width,
                        height: bounds.height,
                      });
                      event.preventDefault();
                    }}
                    ref={(node) => {
                      if (node) {
                        referenceTileElementsRef.current.set(reference.id, node);
                      } else {
                        referenceTileElementsRef.current.delete(reference.id);
                      }
                    }}
                    title="Drag to reorder"
                  >
                    <img alt={reference.label} className="h-full w-full rounded-xl object-cover" draggable={false} src={previewSrc ?? ""} />
                    <button
                      aria-label="Remove reference image"
                      className="absolute -right-2 -top-2 z-10 grid size-6 place-items-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] text-[color:var(--text-muted)] opacity-100 shadow-[0_8px_22px_rgba(0,0,0,0.25)] transition hover:text-[color:var(--text-strong)] sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSettingsChange({
                          ...settings,
                          globalReferences: removeGlobalReference(settings, reference.id),
                        });
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      type="button"
                    >
                      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 20 20">
                        <path
                          fill="currentColor"
                          d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {canAddReference ? (
                <div className="relative">
                  <button
                    aria-label="Add reference image"
                    className={addReferenceButtonClass}
                    onClick={(event) => {
                      const bounds = event.currentTarget.getBoundingClientRect();
                      const menuWidth = 176;
                      const menuHeight = 104;
                      const nextLeft = Math.max(8, Math.min(bounds.left, window.innerWidth - menuWidth - 8));
                      const nextTop =
                        bounds.bottom + menuHeight + 8 > window.innerHeight
                          ? Math.max(8, bounds.top - menuHeight - 8)
                          : bounds.bottom + 8;

                      setReferenceMenuPosition((current) => (current ? null : { left: nextLeft, top: nextTop }));
                    }}
                    ref={addReferenceButtonRef}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-5" viewBox="0 0 20 20">
                      <path fill="currentColor" d="M9.16602 9.16602V4.16602H10.8327V9.16602H15.8327V10.8327H10.8327V15.8327H9.16602V10.8327H4.16602V9.16602H9.16602Z" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>

            <textarea
              className="min-h-16 max-h-32 w-full resize-none border-none bg-transparent text-sm leading-6 text-[color:var(--text-strong)] outline-none placeholder:text-[color:var(--text-muted)]"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the scene you imagine"
              value={prompt}
            />

            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Worker model" className={controlClass + " min-w-40"} disabled={!board} onChange={(event) => updateGenerationModel(event.target.value)} value={generationModel}>
                {imageModelSelectOptions.length ? (
                  <optgroup label="Image models">
                    {imageModelSelectOptions.map((option) => (
                      <option key={option} value={option}>
                        {workerModelLabels[option]}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {videoModelSelectOptions.length ? (
                  <optgroup label="Video models">
                    {videoModelSelectOptions.map((option) => (
                      <option key={option} value={option}>
                        {workerModelLabels[option]}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Voice models">
                  <option disabled value="__voice_models_coming_soon">
                    Coming soon
                  </option>
                </optgroup>
              </select>

              <select
                aria-label="Resolution"
                className={controlClass + " w-24"}
                disabled={!board}
                onChange={(event) => onSettingsChange({ ...settings, resolution: event.target.value })}
                value={settings.resolution}
              >
                {allowedResolutionOptions.map((option) => (
                  <option key={option} value={option}>
                    {resolutionLabels[option]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Aspect ratio"
                className={controlClass + " w-24"}
                disabled={!board}
                onChange={(event) => onSettingsChange({ ...settings, aspectRatio: event.target.value })}
                value={normalizeAspectRatioForGenerationModel(generationModel, settings.aspectRatio)}
              >
                {allowedAspectRatioOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>

              {allowedVideoDurationOptions.length ? (
                <select
                  aria-label="Duration"
                  className={controlClass + " w-24"}
                  disabled={!board}
                  onChange={(event) => onSettingsChange({ ...settings, videoDurationSeconds: Number(event.target.value) })}
                  value={normalizeVideoDurationForGenerationModel(generationModel, settings.videoDurationSeconds) ?? allowedVideoDurationOptions[0]}
                >
                  {allowedVideoDurationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}s
                    </option>
                  ))}
                </select>
              ) : null}

              {!videoGenerationModel ? (
                <div className="flex h-10 items-center gap-1 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-2">
                  <button
                    aria-label="Decrease quantity"
                    className="grid size-7 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:opacity-35"
                    disabled={!board || settings.quantity <= 1}
                    onClick={() => onSettingsChange({ ...settings, quantity: Math.max(1, settings.quantity - 1) })}
                    type="button"
                  >
                    -
                  </button>
                  <select
                    aria-label="Quantity"
                    className="h-8 bg-transparent px-1 text-center text-xs font-bold text-[color:var(--text-strong)] outline-none"
                    disabled={!board}
                    onChange={(event) => onSettingsChange({ ...settings, quantity: Number(event.target.value) })}
                    value={settings.quantity}
                  >
                    {quantityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}/{maxQuantity}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label="Increase quantity"
                    className="grid size-7 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:opacity-35"
                    disabled={!board || settings.quantity >= maxQuantity}
                    onClick={() => onSettingsChange({ ...settings, quantity: Math.min(maxQuantity, settings.quantity + 1) })}
                    type="button"
                  >
                    +
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <button className={theme.buttonPrimary + " h-20 w-full rounded-2xl px-6 text-sm lg:w-36"} disabled={!prompt.trim()} type="submit">
            Generate
          </button>
        </fieldset>
      </form>
      {referenceMenuPosition ? (
        <div
          className="fixed z-[95] w-44 overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
          ref={referenceMenuRef}
          style={{
            left: referenceMenuPosition.left,
            top: referenceMenuPosition.top,
          }}
        >
          <label className="block cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)]">
            Upload image
            <input
              accept="image/*"
              className="hidden"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, maxPlaygroundReferenceCount - activeGlobalReferences.length);
                if (files.length) {
                  setReferenceMenuPosition(null);
                  void onUploadReferences(nextReferenceSlot, files);
                }
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <button
            className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)]"
            onClick={() => {
              setReferenceMenuPosition(null);
              onPickReference(nextReferenceSlot);
            }}
            type="button"
          >
            Choose from gallery
          </button>
        </div>
      ) : null}
      {referenceDragPreview ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[90] overflow-hidden rounded-xl border border-[color:var(--focus-ring)] bg-[color:var(--surface-card-strong)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] ring-2 ring-[color:var(--focus-ring)]"
          style={{
            height: referenceDragPreview.height,
            left: Math.max(
              referenceDragPreview.railLeft,
              Math.min(referenceDragPreview.x - referenceDragPreview.offsetX, referenceDragPreview.railRight - referenceDragPreview.width),
            ),
            top: referenceDragPreview.railTop,
            transform: "scale(1.08)",
            transformOrigin: "center",
            width: referenceDragPreview.width,
          }}
        >
          <img
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            src={previewSourceForReference(referenceDragPreview.reference) ?? ""}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ModelWorkspacePage({ slug, boardId, mode, onSelectBoard, onSelectMode }: ModelWorkspacePageProps) {
  const client = useApolloClient();
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

  const { data: modelData, loading: modelLoading, refetch: refetchModel } = useQuery<{ influencerModel: InfluencerModel | null }>(
    INFLUENCER_MODEL_QUERY,
    {
      variables: { slug },
      fetchPolicy: "cache-and-network",
    },
  );

  const model = modelData?.influencerModel ?? null;

  const [createBoardMutation] = useMutation<CreateBoardMutationData>(CREATE_BOARD_MUTATION);
  const [deleteBoardMutation] = useMutation(DELETE_BOARD_MUTATION);
  const [addRowMutation] = useMutation(ADD_ROW_MUTATION);
  const [deleteRowMutation] = useMutation(DELETE_ROW_MUTATION);
  const [updateRowMutation] = useMutation(UPDATE_ROW_MUTATION);
  const [updateSettingsMutation] = useMutation(UPDATE_SETTINGS_MUTATION);
  const [clearBoardMutation] = useMutation(CLEAR_BOARD_MUTATION);
  const [runBoardMutation] = useMutation(RUN_BOARD_MUTATION);
  const modeBoards = useMemo(() => filterBoardsForWorkspaceMode(model?.boards ?? [], mode), [mode, model?.boards]);
  const requestedBoardBelongsToMode = Boolean(boardId && modeBoards.some((board) => board.id === boardId));
  const activeBoardId = requestedBoardBelongsToMode ? boardId ?? null : modeBoards[0]?.id || null;

  useEffect(() => {
    if (!model || modelLoading) {
      return;
    }

    if (!modeBoards.length) {
      void createBoardMutation({
        variables: {
          influencerModelId: model.id,
          name: buildBoardNameForWorkspaceMode(mode, 1),
        },
      }).then(async ({ data }) => {
        const ensuredBoardId = data?.createBoard.id;
        await refetchModel();
        if (ensuredBoardId) {
          onSelectBoard(ensuredBoardId);
        }
      });
      return;
    }

    if (!requestedBoardBelongsToMode && modeBoards[0]) {
      onSelectBoard(modeBoards[0].id);
    }
  }, [createBoardMutation, mode, modeBoards, model, modelLoading, onSelectBoard, refetchModel, requestedBoardBelongsToMode]);

  const { data: boardData, loading: boardLoading, refetch: refetchBoard } = useQuery<{ workspaceBoard: WorkspaceBoard | null }>(
    BOARD_DETAIL_QUERY,
    {
      skip: !activeBoardId,
      variables: { boardId: activeBoardId },
      fetchPolicy: "cache-and-network",
    },
  );

  const board = boardData?.workspaceBoard ?? null;
  const positionedBoards = buildPositionNamedBoards(modeBoards);
  const activeBoardLabel = positionedBoards.find((entry) => entry.id === activeBoardId)?.name ?? board?.name ?? "Workspace";
  const activeGenerationModelOptions = useMemo(
    () => resolveWorkspaceGenerationModels(mode, model?.allowedGenerationModels ?? []),
    [mode, model?.allowedGenerationModels],
  );

  const { data: assetData, refetch: refetchAssets } = useQuery<{ modelAssets: GeneratedAsset[] }>(MODEL_ASSETS_QUERY, {
    skip: !model?.id,
    variables: { influencerModelId: model?.id || "", limit: 120 },
    fetchPolicy: "cache-and-network",
  });

  const assets = assetData?.modelAssets || [];

  useSubscription<BoardUpdatedSubscriptionData>(BOARD_UPDATED_SUBSCRIPTION, {
    skip: !activeBoardId,
    variables: { boardId: activeBoardId },
    onData: async ({ data }) => {
      const updatedBoard = data.data?.boardUpdated;
      if (!updatedBoard || !activeBoardId) {
        return;
      }

      client.writeQuery({
        query: BOARD_DETAIL_QUERY,
        variables: { boardId: activeBoardId },
        data: { workspaceBoard: updatedBoard },
      });

      await Promise.all([refetchModel(), refetchAssets()]);
    },
  });

  async function refreshCurrentBoard(): Promise<void> {
    await Promise.all([refetchModel(), refetchBoard(), refetchAssets()]);
  }

  async function handleCreateBoard() {
    if (!model) {
      return;
    }
    const { data } = await createBoardMutation({
      variables: {
        influencerModelId: model.id,
        name: buildBoardNameForWorkspaceMode(mode, modeBoards.length + 1),
      },
    });
    const nextBoardId = data?.createBoard.id as string | undefined;
    await refetchModel();
    if (nextBoardId) {
      await client.query({
        query: BOARD_DETAIL_QUERY,
        variables: { boardId: nextBoardId },
        fetchPolicy: "network-only",
      });
      onSelectBoard(nextBoardId);
    }
  }

  async function handleDeleteBoard(targetBoardId?: string) {
    if (!model) {
      return;
    }

    const boardIdToDelete = targetBoardId || board?.id;
    if (!boardIdToDelete) {
      return;
    }

    await deleteBoardMutation({ variables: { boardId: boardIdToDelete } });
    await refetchModel();
    const queryResult = await client.query<{ influencerModel: InfluencerModel | null }>({
      query: INFLUENCER_MODEL_QUERY,
      variables: { slug },
      fetchPolicy: "network-only",
    });
    const remainingBoards = filterBoardsForWorkspaceMode(queryResult.data?.influencerModel?.boards ?? [], mode);

    if (!remainingBoards?.length) {
      return;
    }

    if (boardIdToDelete === activeBoardId) {
      onSelectBoard(remainingBoards[0].id);
      return;
    }

    const stillActive = remainingBoards.find((entry) => entry.id === activeBoardId);
    onSelectBoard(stillActive?.id || remainingBoards[0].id);
  }

  async function handleCommitRow(input: {
    rowId: string;
    label?: string;
    prompt?: string;
    poseMultiplier?: number;
    posePromptTemplates?: string[] | null;
    faceSwap?: boolean;
    reference?: ReferenceSelection;
    clearReference?: boolean;
    clearPosePromptTemplates?: boolean;
  }) {
    if (!board) {
      return;
    }
    await updateRowMutation({
      variables: {
        input: {
          boardId: board.id,
          rowId: input.rowId,
          label: input.label,
          prompt: input.prompt,
          poseMultiplier: input.poseMultiplier,
          posePromptTemplates: input.posePromptTemplates,
          faceSwap: input.faceSwap,
          reference: input.reference,
          clearReference: input.clearReference,
          clearPosePromptTemplates: input.clearPosePromptTemplates,
        },
      },
    });
    await refetchBoard();
  }

  const handleSettingsChange = useCallback(async (nextSettings: BoardSettings) => {
    if (!board) {
      return;
    }

    await updateSettingsMutation({
      variables: {
        boardId: board.id,
        input: {
          generationModel: nextSettings.generationModel,
          resolution: nextSettings.resolution,
          videoDurationSeconds: nextSettings.videoDurationSeconds,
          quality: nextSettings.quality,
          aspectRatio: nextSettings.aspectRatio,
          quantity: nextSettings.quantity,
          poseMultiplierEnabled: nextSettings.poseMultiplierEnabled,
          poseMultiplier: nextSettings.poseMultiplier,
          poseMultiplierGenerationModel: nextSettings.poseMultiplierGenerationModel,
          faceSwap: nextSettings.faceSwap,
          autoPromptGen: nextSettings.autoPromptGen,
          autoPromptImage: nextSettings.autoPromptImage,
          posePromptMode: nextSettings.posePromptMode,
          posePromptTemplate: nextSettings.posePromptTemplate,
          posePromptTemplates: nextSettings.posePromptTemplates,
          globalReferences: nextSettings.globalReferences.map((reference) => ({
            id: reference.id,
            slotIndex: reference.slotIndex,
            label: reference.label,
            sourceType: reference.sourceType,
            assetId: reference.assetId,
            assetUrl: reference.assetUrl,
            uploadPath: reference.uploadPath,
            uploadUrl: reference.uploadUrl,
          })),
        },
      },
    });
    await refetchBoard();
  }, [board, refetchBoard, updateSettingsMutation]);

  useEffect(() => {
    if (!board || activeGenerationModelOptions.length === 0) {
      return;
    }

    const normalizedGenerationModel = activeGenerationModelOptions.includes(board.settings.generationModel)
      ? board.settings.generationModel
      : activeGenerationModelOptions[0];
    const normalizedSettings = normalizeSettingsForGenerationModel(board.settings, normalizedGenerationModel);
    const alreadyNormalized =
      normalizedSettings.generationModel === board.settings.generationModel &&
      normalizedSettings.resolution === board.settings.resolution &&
      normalizedSettings.videoDurationSeconds === board.settings.videoDurationSeconds &&
      normalizedSettings.quality === board.settings.quality &&
      normalizedSettings.aspectRatio === board.settings.aspectRatio &&
      normalizedSettings.quantity === board.settings.quantity &&
      normalizedSettings.poseMultiplierEnabled === board.settings.poseMultiplierEnabled &&
      normalizedSettings.poseMultiplierGenerationModel === board.settings.poseMultiplierGenerationModel;

    if (alreadyNormalized) {
      return;
    }

    void handleSettingsChange(normalizedSettings);
  }, [activeGenerationModelOptions, board, handleSettingsChange]);

  async function handleUploadRowReference(row: WorkspaceRow, file: File) {
    const upload = await uploadReferenceFile(file);
    await handleCommitRow({
      rowId: row.id,
      reference: buildUploadReference(0, file.name, upload),
    });
  }

  async function handleUploadGlobalReference(slotIndex: number, file: File) {
    if (!board) {
      return;
    }

    const upload = await uploadReferenceFile(file);
    const reference = buildUploadReference(slotIndex, file.name, upload);
    const nextSettings: BoardSettings = {
      ...board.settings,
      globalReferences: replaceGlobalReferenceAtSlot(board.settings, reference),
    };
    await handleSettingsChange(nextSettings);
  }

  async function handleUploadGlobalReferences(slotIndex: number, files: File[]) {
    if (!board) {
      return;
    }

    const currentReferenceCount = filledGlobalReferences(board.settings).length;
    const availableSlotCount = Math.max(0, maxPlaygroundReferenceCount - Math.min(slotIndex, currentReferenceCount));
    const selectedFiles = files.slice(0, availableSlotCount);

    if (!selectedFiles.length) {
      return;
    }

    const uploads = await Promise.all(selectedFiles.map((file) => uploadReferenceFile(file)));
    const references = uploads.map((upload, index) => buildUploadReference(slotIndex + index, selectedFiles[index].name, upload));
    const globalReferences = references.reduce(
      (nextReferences, reference) => upsertGlobalReference({ ...board.settings, globalReferences: nextReferences }, reference),
      board.settings.globalReferences,
    );
    const nextSettings: BoardSettings = {
      ...board.settings,
      globalReferences,
    };
    await handleSettingsChange(nextSettings);
  }

  async function handleSelectAsset(asset: GeneratedAsset) {
    if (!board || !pickerState) {
      return;
    }

    if (pickerState.kind === "row") {
      await handleCommitRow({
        rowId: pickerState.row.id,
        reference: buildAssetReference(0, asset),
      });
    } else {
      const reference = buildAssetReference(pickerState.slotIndex, asset);
      const nextSettings: BoardSettings = {
        ...board.settings,
        globalReferences:
          pickerState.source === "tray"
            ? upsertGlobalReference(board.settings, reference)
            : replaceGlobalReferenceAtSlot(board.settings, reference),
      };
      await handleSettingsChange(nextSettings);
    }

    setPickerState(null);
  }

  const running = Boolean(board?.rows.some((row) => row.status === "QUEUED" || row.status === "GENERATING"));

  if (modelLoading && !model) {
    return <div className="h-[60vh] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />;
  }

  if (!model) {
    return <div className={theme.cardStrong + " glass-panel p-10 text-white/58"}>This influencer model is not available.</div>;
  }

  const completedRows = board?.rows.filter((row) => row.status === "SUCCEEDED").length ?? 0;
  const activeModeMeta = mode === "playground" ? null : workspaceModeMetaByMode[mode];
  const activeModeLabel = activeModeMeta ? (activeModeMeta.kind === "voice" ? activeModeMeta.menuLabel : `${activeModeMeta.menuLabel} / ${activeModeMeta.safetyLabel}`) : "Playground";

  return (
    <div className="generation-workspace space-y-4">
      <section className={theme.cardStrong + " overflow-hidden border-white/10 bg-[#171717]/92 shadow-[0_28px_80px_rgba(0,0,0,0.35)]"}>
        <div className="border-b border-white/8 bg-[#1f1f1f] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <InfluencerAvatar model={model} size="lg" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Generation workspace</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl text-white sm:text-3xl">{model.name}</h1>
                  <GenerationModeMenus activeMode={mode} onSelectMode={onSelectMode} />
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/38">{model.handle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/48">
              <span className="rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1.5 uppercase tracking-[0.16em]">
                {mode === "playground" ? "Playground" : activeBoardLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1.5 uppercase tracking-[0.16em]">
                {board?.rows.length ?? 0} rows
              </span>
              <span className="rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1.5 uppercase tracking-[0.16em]">
                {completedRows} complete
              </span>
              {mode === "playground" ? null : (
                <span className="rounded-full border border-lime-300/45 bg-lime-300/12 px-3.5 py-1.5 font-bold uppercase tracking-[0.16em] text-lime-100 shadow-[0_0_24px_rgba(190,242,100,0.16)]">
                  {activeModeLabel}
                </span>
              )}
              {mode === "playground" ? null : (
                <div className="flex flex-wrap gap-2">
                  <button className={theme.buttonSecondary + " rounded-xl border-white/10 bg-[#2a2a2a] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-[#333333]"} disabled={!board || running} onClick={() => void clearBoardMutation({ variables: { boardId: board?.id } }).then(() => refreshCurrentBoard())} type="button">
                    Clear table
                  </button>
                  <button className={theme.buttonPrimary + " rounded-xl px-3 py-2 text-xs"} disabled={!board || running} onClick={() => void runBoardMutation({ variables: { boardId: board?.id } }).then(() => refetchBoard())} type="button">
                    {running ? "Running..." : "Run workflow"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mode === "playground" ? (
          <PlaygroundSurface
            allowedGenerationModels={activeGenerationModelOptions}
            assets={assets}
            board={board}
            onPickReference={(slotIndex) => setPickerState({ kind: "global", slotIndex, source: "tray" })}
            onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
            onUploadReferences={(slotIndex, files) => void handleUploadGlobalReferences(slotIndex, files)}
          />
        ) : (
        <div className="grid min-h-[68vh] gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
          {boardLoading && !board ? (
            <div className="xl:col-span-2 h-[50vh] animate-pulse bg-white/[0.03]" />
          ) : board ? (
            <>
              <div className="border-b border-white/8 bg-[#202020] xl:border-r xl:border-b-0">
                <SettingsPanel
                  allowedGenerationModels={activeGenerationModelOptions}
                  generationKind={activeModeMeta?.kind ?? "image"}
                  onPickReference={(slotIndex) => setPickerState({ kind: "global", slotIndex })}
                  onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
                  onUploadReference={(slotIndex, file) => void handleUploadGlobalReference(slotIndex, file)}
                  poseWorkerModelLocked={mode === "image-nsfw"}
                  promptPrefix={model.defaults.promptPrefix}
                  settings={board.settings}
                />
              </div>

              <div className="min-w-0 bg-[#171717]">
                <BoardTabs
                  boards={positionedBoards}
                  activeBoardId={activeBoardId}
                  onCreate={() => void handleCreateBoard()}
                  onDelete={(nextBoardId) => void handleDeleteBoard(nextBoardId)}
                  onSelect={onSelectBoard}
                />

                <WorkspaceGrid
                  board={board}
                  referenceColumnLabel={`${activeModeMeta?.kind ?? "image"} reference`}
                  referenceColumnLocked={(activeModeMeta?.kind ?? "image") === "voice"}
                  showPoseAndFaceSwapColumns={(activeModeMeta?.kind ?? "image") === "image"}
                  onAddRow={async () => {
                    await addRowMutation({ variables: { boardId: board.id } });
                    await refetchBoard();
                  }}
                  onCommitRow={(input) => handleCommitRow(input)}
                  onDeleteRow={async (rowId) => {
                    await deleteRowMutation({ variables: { boardId: board.id, rowId } });
                    await refetchBoard();
                  }}
                  onPickReference={(row) => setPickerState({ kind: "row", row })}
                  onUploadReference={(row, file) => handleUploadRowReference(row, file)}
                />
              </div>
            </>
          ) : null}
        </div>
        )}
      </section>

      <ImagePickerModal
        assets={assets}
        onClose={() => setPickerState(null)}
        onSelect={(asset) => void handleSelectAsset(asset)}
        open={Boolean(pickerState)}
        slug={slug}
      />
    </div>
  );
}
