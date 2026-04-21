import { useEffect, useState } from "react";
import { useApolloClient, useMutation, useQuery, useSubscription } from "@apollo/client/react";

import { BoardTabs } from "../components/workspace/BoardTabs";
import { ImagePickerModal } from "../components/workspace/ImagePickerModal";
import { SettingsPanel } from "../components/workspace/SettingsPanel";
import { WorkspaceGrid } from "../components/workspace/WorkspaceGrid";
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
  ENSURE_BOARD_MUTATION,
  RUN_BOARD_MUTATION,
  UPDATE_ROW_MUTATION,
  UPDATE_SETTINGS_MUTATION,
} from "../queries/workspace";
import { theme } from "../styles/theme";
import type { BoardSettings, GeneratedAsset, InfluencerModel, ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../types";

interface ModelWorkspacePageProps {
  slug: string;
  boardId?: string | null;
  onSelectBoard: (boardId: string) => void;
}

interface EnsureBoardMutationData {
  ensureBoard: {
    id: string;
  };
}

interface CreateBoardMutationData {
  createBoard: {
    id: string;
  };
}

interface BoardUpdatedSubscriptionData {
  boardUpdated: WorkspaceBoard;
}

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

export function ModelWorkspacePage({ slug, boardId, onSelectBoard }: ModelWorkspacePageProps) {
  const client = useApolloClient();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [pickerState, setPickerState] = useState<PickerState | null>(null);

  const { data: modelData, loading: modelLoading, refetch: refetchModel } = useQuery<{ influencerModel: InfluencerModel | null }>(
    INFLUENCER_MODEL_QUERY,
    {
      variables: { slug },
      fetchPolicy: "cache-and-network",
    },
  );

  const model = modelData?.influencerModel ?? null;

  const [ensureBoardMutation] = useMutation<EnsureBoardMutationData>(ENSURE_BOARD_MUTATION);
  const [createBoardMutation] = useMutation<CreateBoardMutationData>(CREATE_BOARD_MUTATION);
  const [deleteBoardMutation] = useMutation(DELETE_BOARD_MUTATION);
  const [addRowMutation] = useMutation(ADD_ROW_MUTATION);
  const [deleteRowMutation] = useMutation(DELETE_ROW_MUTATION);
  const [updateRowMutation] = useMutation(UPDATE_ROW_MUTATION);
  const [updateSettingsMutation] = useMutation(UPDATE_SETTINGS_MUTATION);
  const [clearBoardMutation] = useMutation(CLEAR_BOARD_MUTATION);
  const [runBoardMutation] = useMutation(RUN_BOARD_MUTATION);

  useEffect(() => {
    if (!model || modelLoading) {
      return;
    }

    if (!model.boards.length) {
      void ensureBoardMutation({ variables: { influencerModelId: model.id } }).then(async ({ data }) => {
        const ensuredBoardId = data?.ensureBoard.id;
        await refetchModel();
        if (ensuredBoardId) {
          onSelectBoard(ensuredBoardId);
        }
      });
      return;
    }

    if (!boardId && model.boards[0]) {
      onSelectBoard(model.boards[0].id);
    }
  }, [boardId, ensureBoardMutation, model, modelLoading, onSelectBoard, refetchModel]);

  const activeBoardId = boardId || model?.boards[0]?.id || null;

  const { data: boardData, loading: boardLoading, refetch: refetchBoard } = useQuery<{ workspaceBoard: WorkspaceBoard | null }>(
    BOARD_DETAIL_QUERY,
    {
      skip: !activeBoardId,
      variables: { boardId: activeBoardId },
      fetchPolicy: "cache-and-network",
    },
  );

  const board = boardData?.workspaceBoard ?? null;

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
      variables: { influencerModelId: model.id },
    });
    const nextBoardId = data?.createBoard.id as string | undefined;
    await refetchModel();
    if (nextBoardId) {
      onSelectBoard(nextBoardId);
    }
  }

  async function handleDeleteBoard() {
    if (!board || !model) {
      return;
    }
    await deleteBoardMutation({ variables: { boardId: board.id } });
    await refetchModel();
    const queryResult = await client.query<{ influencerModel: InfluencerModel | null }>({
      query: INFLUENCER_MODEL_QUERY,
      variables: { slug },
      fetchPolicy: "network-only",
    });
    const remainingBoards = queryResult.data?.influencerModel?.boards;
    if (remainingBoards?.[0]) {
      onSelectBoard(remainingBoards[0].id);
    }
  }

  async function handleCommitRow(input: {
    rowId: string;
    label?: string;
    prompt?: string;
    reference?: ReferenceSelection;
    clearReference?: boolean;
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
          reference: input.reference,
          clearReference: input.clearReference,
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
          aspectRatio: nextSettings.aspectRatio,
          quantity: nextSettings.quantity,
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

  return (
    <div className="space-y-5">
      <section className={theme.cardStrong + " glass-panel p-6 sm:p-7"}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/42">Airtable-style generation workspace</p>
            <h1 className="font-display mt-3 text-4xl text-white">{model.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
              {model.description} This workspace mirrors the eight-slot Higgsfield batch contract: shared global references live above the grid, each row controls one worker job, and outputs are routed back into the matching row.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className={theme.buttonSecondary} disabled={!board || running} onClick={() => void handleCreateBoard()} type="button">
              Add table
            </button>
            <button className={theme.buttonSecondary} disabled={!board || running} onClick={() => void clearBoardMutation({ variables: { boardId: board?.id } }).then(() => refreshCurrentBoard())} type="button">
              Clear table
            </button>
            <button className={theme.buttonDanger} disabled={!board || running || (model.boards.length ?? 0) <= 1} onClick={() => void handleDeleteBoard()} type="button">
              Delete table
            </button>
            <button className={theme.buttonPrimary} disabled={!board || running} onClick={() => void runBoardMutation({ variables: { boardId: board?.id } }).then(() => refetchBoard())} type="button">
              {running ? "Running..." : "Run workflow"}
            </button>
          </div>
        </div>
      </section>

      <BoardTabs boards={model.boards} activeBoardId={activeBoardId} onCreate={() => void handleCreateBoard()} onSelect={onSelectBoard} />

      {boardLoading && !board ? (
        <div className="h-[50vh] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />
      ) : board ? (
        <>
          <SettingsPanel
            allowedGenerationModels={model.allowedGenerationModels}
            onPickReference={(slotIndex) => setPickerState({ kind: "global", slotIndex })}
            onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
            onToggle={() => setSettingsOpen((current) => !current)}
            onUploadReference={(slotIndex, file) => void handleUploadGlobalReference(slotIndex, file)}
            open={settingsOpen}
            promptPrefix={model.defaults.promptPrefix}
            settings={board.settings}
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
        </>
      ) : null}

      <ImagePickerModal assets={assets} onClose={() => setPickerState(null)} onSelect={(asset) => void handleSelectAsset(asset)} open={Boolean(pickerState)} />
    </div>
  );
}