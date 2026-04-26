import { useEffect, useMemo, useState } from "react";
import { useApolloClient, useMutation, useQuery, useSubscription } from "@apollo/client/react";

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
import { theme } from "../styles/theme";
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
  safetyLabel: "SFW" | "NSFW";
}

const workspaceModeMenus: Array<{
  kind: WorkspaceGenerationKind;
  label: string;
  modes: WorkspaceModeMeta[];
}> = [
  {
    kind: "image",
    label: "Image Gen",
    modes: [
      { mode: "image-sfw", kind: "image", menuLabel: "Image Gen", safetyLabel: "SFW" },
      { mode: "image-nsfw", kind: "image", menuLabel: "Image Gen", safetyLabel: "NSFW" },
    ],
  },
  {
    kind: "video",
    label: "Video Gen",
    modes: [
      { mode: "video-sfw", kind: "video", menuLabel: "Video Gen", safetyLabel: "SFW" },
      { mode: "video-nsfw", kind: "video", menuLabel: "Video Gen", safetyLabel: "NSFW" },
    ],
  },
  {
    kind: "voice",
    label: "Voice Gen",
    modes: [
      { mode: "voice-sfw", kind: "voice", menuLabel: "Voice Gen", safetyLabel: "SFW" },
      { mode: "voice-nsfw", kind: "voice", menuLabel: "Voice Gen", safetyLabel: "NSFW" },
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

type PickerState =
  | { kind: "row"; row: WorkspaceRow }
  | { kind: "global"; slotIndex: number };

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
        const isOpen = openKind === menu.kind;
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
            onFocus={() => setOpenKind(menu.kind)}
            onMouseEnter={() => setOpenKind(menu.kind)}
            onMouseLeave={() => setOpenKind((current) => (current === menu.kind ? null : current))}
          >
            <button
              aria-expanded={isOpen}
              className={cx(
                "inline-flex min-w-24 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                activeMenu ? "bg-lime-300 text-black" : "text-white/54 hover:bg-white/[0.06] hover:text-white/82",
              )}
              onClick={() => {
                onSelectMode(defaultMode);
              }}
              type="button"
            >
              {menu.label}
              <span aria-hidden="true" className="text-[10px] opacity-70">
                v
              </span>
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
                      {item.safetyLabel}
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
  assets,
  board,
  model,
}: {
  assets: GeneratedAsset[];
  board: WorkspaceBoard | null;
  model: InfluencerModel;
}) {
  const [prompt, setPrompt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleAssets = assets.slice(0, 18);

  return (
    <div className="relative min-h-[68vh] overflow-hidden bg-[#171717]">
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
          <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4 flex min-h-[420px] items-center justify-center bg-[#1b1b1b] px-6 text-center">
            <div>
              <p className="font-display text-2xl text-white">Playground is ready</p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/56">
                Generated images for {model.name} will appear here as a Higgsfield-style working wall.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {settingsOpen ? (
        <div className="absolute right-4 top-4 z-20 w-[min(360px,calc(100%-2rem))] rounded-[28px] border border-white/10 bg-[#202020]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/42">Settings</p>
              <p className="mt-2 text-sm font-semibold text-white">Playground defaults</p>
            </div>
            <button className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/62" onClick={() => setSettingsOpen(false)} type="button">
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Model", board?.settings.generationModel || model.defaults.generationModel],
              ["Resolution", board?.settings.resolution || model.defaults.resolution],
              ["Ratio", board?.settings.aspectRatio || model.defaults.aspectRatio],
              ["Quantity", String(board?.settings.quantity || model.defaults.quantity)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">{label}</p>
                <p className="mt-2 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 border-t border-white/8 bg-[#171717]/82 px-4 py-4 backdrop-blur-2xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-[32px] border border-white/10 bg-[#252525] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
          <textarea
            className="min-h-16 flex-1 resize-none rounded-[26px] border border-white/8 bg-[#181818] px-5 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/34 focus:border-lime-300/25"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe what you want to generate..."
            value={prompt}
          />
          <button className={theme.buttonSecondary + " h-12 rounded-full px-4"} onClick={() => setSettingsOpen((current) => !current)} type="button">
            Settings
          </button>
          <button className={theme.buttonPrimary + " h-12 rounded-full px-5"} disabled={!prompt.trim()} type="button">
            Generate
          </button>
        </div>
      </div>
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

  async function handleSettingsChange(nextSettings: BoardSettings) {
    if (!board) {
      return;
    }

    await updateSettingsMutation({
      variables: {
        boardId: board.id,
        input: {
          generationModel: nextSettings.generationModel,
          resolution: nextSettings.resolution,
          quality: nextSettings.quality,
          aspectRatio: nextSettings.aspectRatio,
          quantity: nextSettings.quantity,
          poseMultiplierEnabled: nextSettings.poseMultiplierEnabled,
          poseMultiplier: nextSettings.poseMultiplier,
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
  }

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
    const nextSettings: BoardSettings = {
      ...board.settings,
      globalReferences: board.settings.globalReferences.map((selection) =>
        selection.slotIndex === slotIndex ? buildUploadReference(slotIndex, file.name, upload) : selection,
      ),
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
      const nextSettings: BoardSettings = {
        ...board.settings,
        globalReferences: board.settings.globalReferences.map((selection) =>
          selection.slotIndex === pickerState.slotIndex ? buildAssetReference(pickerState.slotIndex, asset) : selection,
        ),
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
  const activeModeLabel = activeModeMeta ? `${activeModeMeta.menuLabel} / ${activeModeMeta.safetyLabel}` : "Playground";

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
            </div>
          </div>
        </div>

        <div className="border-b border-white/8 bg-[#222222] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-sm leading-6 text-white/58">
              {activeModeMeta
                ? `${model.description} ${activeModeMeta.menuLabel} ${activeModeMeta.safetyLabel} keeps its own tables, settings, rows, and outputs.`
                : `${model.description} Playground mode gives you a visual wall, a bottom prompt composer, and quick settings without folder rails.`}
            </p>
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

        {mode === "playground" ? (
          <PlaygroundSurface assets={assets} board={board} model={model} />
        ) : (
        <div className="grid min-h-[68vh] gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
          {boardLoading && !board ? (
            <div className="xl:col-span-2 h-[50vh] animate-pulse bg-white/[0.03]" />
          ) : board ? (
            <>
              <div className="border-b border-white/8 bg-[#202020] xl:border-r xl:border-b-0">
                <SettingsPanel
                  allowedGenerationModels={model.allowedGenerationModels}
                  onPickReference={(slotIndex) => setPickerState({ kind: "global", slotIndex })}
                  onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
                  onUploadReference={(slotIndex, file) => void handleUploadGlobalReference(slotIndex, file)}
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
