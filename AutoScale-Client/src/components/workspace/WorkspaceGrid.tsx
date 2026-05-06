import { useEffect, useState } from "react";

import { cx } from "../../lib/cx";
import { IMPROVE_PROMPT_CREDITS, formatCreditCost } from "../../lib/generationCosts";
import { improvePromptDraft } from "../../lib/promptImprovement";
import type { GeneratedAsset, ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../../types";
import { isPoseMultiplierWorkspace, theme } from "../../styles/theme";

interface WorkspaceGridProps {
  board: WorkspaceBoard;
  referenceColumnLabel: string;
  referenceColumnLocked: boolean;
  referenceMediaKind: "image" | "video";
  showFaceSwapColumn: boolean;
  showPoseColumn: boolean;
  showUpscaleColumn: boolean;
  audioReferenceLocked: boolean;
  onCommitRow: (input: {
    rowId: string;
    label?: string;
    prompt?: string;
    poseMultiplier?: number;
    posePromptTemplates?: string[] | null;
    upscale?: boolean;
    faceSwap?: boolean;
    reference?: ReferenceSelection;
    audioReference?: ReferenceSelection;
    clearReference?: boolean;
    clearAudioReference?: boolean;
    clearPosePromptTemplates?: boolean;
  }) => Promise<void> | void;
  onUploadReference: (row: WorkspaceRow, file: File) => Promise<void> | void;
  onUploadAudioReference: (row: WorkspaceRow, file: File) => Promise<void> | void;
  onPickReference: (row: WorkspaceRow) => void;
  onPickAudioReference: (row: WorkspaceRow) => void;
  onDeleteRow: (rowId: string) => Promise<void> | void;
  onAddRow: () => Promise<void> | void;
  showAudioReferenceColumn: boolean;
  denseLayout?: boolean;
}

function statusClass(status: WorkspaceRow["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "bg-emerald-400/14 text-emerald-200 border border-emerald-300/20";
    case "PARTIAL":
      return "bg-amber-300/14 text-amber-100 border border-amber-300/20";
    case "FAILED":
      return "bg-rose-400/14 text-rose-100 border border-rose-300/20";
    case "GENERATING":
    case "QUEUED":
      return "bg-sky-400/14 text-sky-100 border border-sky-300/20";
    case "SKIPPED":
      return "bg-white/8 text-white/52 border border-white/10";
    default:
      return "bg-white/8 text-white/58 border border-white/10";
  }
}

const videoOutputExtensions = new Set(["mp4", "mov", "m4v", "webm"]);
const audioOutputExtensions = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "webm"]);

function assetExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function ExpandIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <path
        d="M11.25 3.5a.75.75 0 0 1 .75-.75h3.25a2 2 0 0 1 2 2V8a.75.75 0 0 1-1.5 0V4.75a.5.5 0 0 0-.5-.5H12a.75.75 0 0 1-.75-.75ZM2.75 12a.75.75 0 0 1 1.5 0v3.25a.5.5 0 0 0 .5.5H8a.75.75 0 0 1 0 1.5H4.75a2 2 0 0 1-2-2V12Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WorkspaceGrid({
  board,
  referenceColumnLabel,
  referenceColumnLocked,
  referenceMediaKind,
  showFaceSwapColumn,
  showPoseColumn,
  showUpscaleColumn,
  showAudioReferenceColumn,
  audioReferenceLocked,
  onCommitRow,
  onUploadReference,
  onUploadAudioReference,
  onPickReference,
  onPickAudioReference,
  onDeleteRow,
  onAddRow,
  denseLayout = false,
}: WorkspaceGridProps) {
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [improvingPromptRowId, setImprovingPromptRowId] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ src: string; label: string; error?: string | null } | null>(null);
  const [outputPreview, setOutputPreview] = useState<{
    rowLabel: string;
    columnLabel: string;
    assets: GeneratedAsset[];
    selectedAssetId?: string;
  } | null>(null);
  const isPoseMultiplierWorkspaceLayout = isPoseMultiplierWorkspace(board.settings.generationModel, board.settings.sdxlWorkspaceMode);
  const isFaceSwapWorkspaceLayout = board.settings.sdxlWorkspaceMode === "FACE_SWAP";
  const isVideoReference = referenceMediaKind === "video";
  const promptLocked = board.settings.generationModel === "kling_motion_control";
  const showPromptColumn = !promptLocked && !isFaceSwapWorkspaceLayout;
  const showOutputsColumn = !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout;
  const promptColumnLabel = isPoseMultiplierWorkspaceLayout ? "Pose Prompt" : "Prompt";
  const effectiveAutoPromptImage = board.settings.autoPromptImage && !isPoseMultiplierWorkspaceLayout;
  const referenceCopy = isVideoReference
    ? {
        emptyLabel: "Add video",
        selectedLabel: "Video reference",
        autoLabel: "Auto video",
        uploadLabel: "Upload video",
        pickLabel: "Pick from Gallery",
        clearLabel: "Clear video",
        accept: "video/*,.mp4,.mov,.m4v,.webm",
      }
    : {
        emptyLabel: "Add image",
        selectedLabel: "Image reference",
        autoLabel: "Auto image",
        uploadLabel: "Upload image",
        pickLabel: "Pick from Gallery",
        clearLabel: "Clear image",
        accept: "image/*",
      };
  const autoSurfaceClass = "border-[#4e6b22] bg-[#314513]";
  const controlColumnCount = [showPoseColumn, showUpscaleColumn, showFaceSwapColumn].filter(Boolean).length;
  const showRowControlColumns = controlColumnCount > 0;
  const relaxedGridColumns = isFaceSwapWorkspaceLayout
    ? "grid-cols-[56px_repeat(3,minmax(0,1fr))_96px]"
    : showPoseColumn && isPoseMultiplierWorkspaceLayout
    ? "grid-cols-[56px_repeat(5,minmax(0,1fr))_96px]"
    : showRowControlColumns && controlColumnCount === 3
      ? "grid-cols-[56px_repeat(7,minmax(0,1fr))_96px]"
    : showRowControlColumns && controlColumnCount === 2
      ? "grid-cols-[56px_repeat(6,minmax(0,1fr))_96px]"
    : showRowControlColumns
      ? "grid-cols-[56px_repeat(5,minmax(0,1fr))_96px]"
    : showAudioReferenceColumn
      ? "grid-cols-[56px_minmax(132px,0.5fr)_minmax(220px,0.85fr)_minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(0,0.8fr)_96px]"
    : isVideoReference && !showPromptColumn
      ? "grid-cols-[56px_repeat(3,minmax(0,1fr))_96px]"
    : isVideoReference
      ? "grid-cols-[56px_repeat(4,minmax(0,1fr))_96px]"
    : referenceColumnLocked
      ? "grid-cols-[56px_minmax(150px,0.58fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_96px]"
      : "grid-cols-[56px_repeat(4,minmax(0,1fr))_96px]";
  const denseGridColumns = isFaceSwapWorkspaceLayout
    ? "xl:grid-cols-[44px_repeat(3,minmax(0,1fr))_64px]"
    : showPoseColumn && isPoseMultiplierWorkspaceLayout
    ? "xl:grid-cols-[44px_repeat(5,minmax(0,1fr))_64px]"
    : showRowControlColumns && controlColumnCount === 3
      ? "xl:grid-cols-[44px_repeat(7,minmax(0,1fr))_64px]"
    : showRowControlColumns && controlColumnCount === 2
      ? "xl:grid-cols-[44px_repeat(6,minmax(0,1fr))_64px]"
    : showRowControlColumns
      ? "xl:grid-cols-[44px_repeat(5,minmax(0,1fr))_64px]"
    : showAudioReferenceColumn
      ? "xl:grid-cols-[44px_repeat(5,minmax(0,1fr))_64px]"
    : isVideoReference && !showPromptColumn
      ? "xl:grid-cols-[44px_repeat(3,minmax(0,1fr))_64px]"
    : isVideoReference
      ? "xl:grid-cols-[44px_repeat(4,minmax(0,1fr))_64px]"
    : referenceColumnLocked
      ? "xl:grid-cols-[44px_repeat(4,minmax(0,1fr))_64px]"
      : "xl:grid-cols-[44px_repeat(4,minmax(0,1fr))_64px]";
  const gridColumns = denseLayout ? cx(relaxedGridColumns, denseGridColumns) : relaxedGridColumns;
  const relaxedMinGridWidth = isFaceSwapWorkspaceLayout
    ? "min-w-[980px]"
    : showPoseColumn && isPoseMultiplierWorkspaceLayout
    ? "min-w-[1320px]"
    : showRowControlColumns && controlColumnCount === 3
      ? "min-w-[1660px]"
      : showRowControlColumns && controlColumnCount === 2
        ? "min-w-[1536px]"
        : showRowControlColumns
          ? "min-w-[1320px]"
          : showAudioReferenceColumn
            ? "min-w-[1240px]"
            : isVideoReference
              ? "min-w-[1180px]"
              : referenceColumnLocked
                ? "min-w-[980px]"
                : "min-w-[1120px]";
  const denseMinGridWidth = isFaceSwapWorkspaceLayout
    ? "xl:min-w-[760px]"
    : showPoseColumn && isPoseMultiplierWorkspaceLayout
    ? "xl:min-w-[928px]"
    : showRowControlColumns && controlColumnCount === 3
      ? "xl:min-w-[1032px]"
    : showRowControlColumns && controlColumnCount === 2
      ? "xl:min-w-[968px]"
      : showRowControlColumns
        ? "xl:min-w-[904px]"
        : showAudioReferenceColumn
          ? "xl:min-w-[940px]"
          : isVideoReference
            ? "xl:min-w-[850px]"
            : referenceColumnLocked
              ? "xl:min-w-[800px]"
              : "xl:min-w-[820px]";
  const minGridWidth = denseLayout ? cx(relaxedMinGridWidth, denseMinGridWidth) : relaxedMinGridWidth;
  const cellClass = "border-r border-[color:var(--surface-border)] px-3 py-3";
  const panelClass = "h-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-3";
  const stackedControlPanelClass = cx(panelClass, "flex flex-col gap-2");
  const pendingJobClass = "mt-1 flex min-h-[148px] flex-1 items-center justify-center rounded-lg border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]";
  const skippedPanelClass = cx(
    stackedControlPanelClass,
    "relative overflow-hidden border-dashed bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]",
  );
  const skippedBadgeClass =
    "relative z-10 mt-1 flex min-h-[148px] flex-1 items-center justify-center rounded-lg border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-card)]/72 px-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--text-muted)] backdrop-blur-sm";
  const autoReferenceTitle = isVideoReference ? "Auto video" : "Auto image";
  const autoReferenceKindLabel = isVideoReference ? "Video reference" : "Image reference";

  useEffect(() => {
    setPromptDrafts((current) => {
      const next: Record<string, string> = {};

      for (const row of board.rows) {
        next[row.id] = current[row.id] ?? row.prompt;
      }

      return next;
    });
  }, [board.rows]);

  useEffect(() => {
    if (!videoPreview && !outputPreview) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setVideoPreview(null);
        setOutputPreview(null);
        return;
      }

      if (!outputPreview || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
        return;
      }

      setOutputPreview((current) => {
        if (!current || current.assets.length < 2) {
          return current;
        }

        const currentIndex = current.assets.findIndex((asset) => asset.id === current.selectedAssetId);
        if (currentIndex < 0) {
          return current;
        }

        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + direction + current.assets.length) % current.assets.length;
        return { ...current, selectedAssetId: current.assets[nextIndex]?.id ?? current.selectedAssetId };
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [videoPreview, outputPreview]);

  function handlePromptDraftChange(rowId: string, prompt: string): void {
    setPromptDrafts((current) => ({ ...current, [rowId]: prompt }));
  }

  function handlePromptCommit(row: WorkspaceRow, prompt: string): void {
    if (prompt !== row.prompt) {
      void onCommitRow({ rowId: row.id, prompt });
    }
  }

  function handleImproveRowPrompt(row: WorkspaceRow): void {
    const currentPrompt = (promptDrafts[row.id] ?? row.prompt).trim();

    if (!currentPrompt || improvingPromptRowId) {
      return;
    }

    setImprovingPromptRowId(row.id);
    window.setTimeout(() => {
      const improvedPrompt = improvePromptDraft(currentPrompt);
      setPromptDrafts((current) => ({ ...current, [row.id]: improvedPrompt }));
      void onCommitRow({ rowId: row.id, prompt: improvedPrompt });
      setImprovingPromptRowId(null);
    }, 250);
  }

  function openOutputPreview(row: WorkspaceRow, assets: GeneratedAsset[], columnLabel: string, selectedAssetId?: string): void {
    if (!assets.length) {
      return;
    }

    setOutputPreview({
      rowLabel: row.label || `Row ${row.orderIndex + 1}`,
      columnLabel,
      assets,
      selectedAssetId: selectedAssetId ?? assets[0]?.id,
    });
  }

  function selectOutputPreviewAsset(assetId: string): void {
    setOutputPreview((current) => (current ? { ...current, selectedAssetId: assetId } : current));
  }

  function selectAdjacentOutputPreviewAsset(direction: -1 | 1): void {
    setOutputPreview((current) => {
      if (!current || current.assets.length < 2) {
        return current;
      }

      const currentIndex = current.assets.findIndex((asset) => asset.id === current.selectedAssetId);
      if (currentIndex < 0) {
        return current;
      }

      const nextIndex = (currentIndex + direction + current.assets.length) % current.assets.length;
      return { ...current, selectedAssetId: current.assets[nextIndex]?.id ?? current.selectedAssetId };
    });
  }

  const renderOutputPreviewMain = (asset: GeneratedAsset) => {
    const extension = assetExtension(asset.fileName);

    if (videoOutputExtensions.has(extension)) {
      return (
        <video
          className="max-h-full max-w-full rounded-2xl border border-white/10 bg-black object-contain shadow-[0_24px_90px_rgba(0,0,0,0.52)]"
          controls
          playsInline
          preload="metadata"
          src={asset.url}
        />
      );
    }

    if (audioOutputExtensions.has(extension)) {
      return (
        <div className="w-[min(92%,640px)] rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.52)] backdrop-blur-md">
          <p className="mb-4 truncate text-sm font-semibold text-white">{asset.fileName}</p>
          <audio className="w-full" controls preload="metadata" src={asset.url} />
        </div>
      );
    }

    return (
      <img
        alt={asset.fileName}
        className="max-h-full max-w-full rounded-2xl border border-white/10 bg-black/20 object-contain shadow-[0_24px_90px_rgba(0,0,0,0.52)]"
        src={asset.url}
      />
    );
  };

  const renderOutputPreviewThumb = (asset: GeneratedAsset, index: number, selected: boolean) => {
    const extension = assetExtension(asset.fileName);

    return (
      <button
        key={asset.id}
        aria-label={`View ${asset.fileName}`}
        className={cx(
          "relative h-16 w-16 flex-none overflow-hidden rounded-xl border bg-[#181818] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70",
          selected ? "scale-[1.04] border-lime-300/70 opacity-100 shadow-[0_0_0_1px_rgba(199,255,39,0.35),0_12px_28px_rgba(0,0,0,0.36)]" : "border-white/10 opacity-64 hover:border-white/24 hover:opacity-100",
        )}
        onClick={() => selectOutputPreviewAsset(asset.id)}
        type="button"
      >
        {videoOutputExtensions.has(extension) ? (
          <video className="h-full w-full object-cover" muted playsInline preload="metadata" src={asset.url} />
        ) : audioOutputExtensions.has(extension) ? (
          <span className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-[0.14em] text-white/52">Audio</span>
        ) : (
          <img alt="" className="h-full w-full object-cover" src={asset.url} />
        )}
        <span className="absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/62 px-1 text-[10px] font-bold text-white/86">
          {index + 1}
        </span>
      </button>
    );
  };

  const renderOutputAsset = (
    asset: GeneratedAsset,
    index: number,
    variant: "inline" | "modal" = "inline",
    onOpen?: (asset: GeneratedAsset) => void,
    selected = false,
  ) => {
    const extension = assetExtension(asset.fileName);
    const isModal = variant === "modal";

    if (videoOutputExtensions.has(extension)) {
      return (
        <div key={asset.id} className={cx("overflow-hidden rounded-lg border border-white/8 bg-[#181818]", isModal ? "aspect-video min-h-[180px]" : "aspect-video min-h-[82px]")}>
          <video className="h-full w-full object-cover" controls muted playsInline preload="metadata" src={asset.url} />
        </div>
      );
    }

    if (audioOutputExtensions.has(extension)) {
      return (
        <div key={asset.id} className="col-span-full flex min-h-[82px] flex-col justify-center gap-2 rounded-lg border border-white/8 bg-[#181818] px-3">
          <p className="truncate text-xs font-semibold text-white/72">{asset.fileName}</p>
          <audio className="h-8 w-full" controls preload="metadata" src={asset.url} />
        </div>
      );
    }

    const imageClassName = cx(
      "relative overflow-hidden rounded-lg border bg-[#181818]",
      isModal ? "aspect-[4/5] min-h-[220px]" : "aspect-[4/5] min-h-[82px]",
      selected ? "border-lime-300/60 shadow-[0_0_0_1px_rgba(199,255,39,0.35)]" : "border-white/8",
    );

    if (!isModal && onOpen) {
      return (
        <button
          key={asset.id}
          aria-label={`View ${asset.fileName}`}
          className={cx(imageClassName, "group/output text-left transition hover:border-lime-300/42 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70")}
          onClick={() => onOpen(asset)}
          type="button"
        >
          <img alt={asset.fileName} className="h-full w-full object-cover transition duration-200 group-hover/output:scale-[1.025]" src={asset.url} />
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover/output:bg-black/22 group-hover/output:opacity-100">
            <span className="inline-flex size-7 items-center justify-center rounded-full border border-white/12 bg-black/34 text-white shadow-[0_8px_22px_rgba(0,0,0,0.32)] backdrop-blur-[3px]">
              <ExpandIcon />
            </span>
          </span>
          <span className="absolute left-1.5 top-1.5 z-20 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-black/30 bg-black/58 px-1 text-[10px] font-bold text-white/86 backdrop-blur-sm">
            {index + 1}
          </span>
        </button>
      );
    }

    return (
      <div key={asset.id} className={imageClassName}>
        <img alt={asset.fileName} className="h-full w-full object-cover" src={asset.url} />
        <span className="absolute left-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-black/30 bg-black/58 px-1 text-[10px] font-bold text-white/86 backdrop-blur-sm">
          {index + 1}
        </span>
      </div>
    );
  };

  const renderOutputGrid = (row: WorkspaceRow, awaitingOutput: boolean, compact = false, assets = row.outputAssets, columnLabel = "Outputs") => {
    const outputCount = assets.length;
    const visibleOutputAssets = assets.slice(0, 4);
    const hiddenOutputCount = Math.max(0, outputCount - visibleOutputAssets.length);

    return (
      <div
        className={cx(
          "grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-[#202020] p-3",
          compact ? "min-h-[116px] flex-1" : "h-full min-h-[188px]",
        )}
      >
        {visibleOutputAssets.map((asset, index) =>
          renderOutputAsset(asset, index, "inline", (selectedAsset) => openOutputPreview(row, assets, columnLabel, selectedAsset.id)),
        )}
        {hiddenOutputCount > 0 ? (
          <button
            className="col-span-full inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-300/18 bg-lime-300/10 px-3 text-xs font-bold uppercase tracking-[0.16em] text-lime-100/82 transition hover:border-lime-200/38 hover:bg-lime-300/16 hover:text-lime-50"
            onClick={() => openOutputPreview(row, assets, columnLabel)}
            type="button"
          >
            View all {outputCount}
          </button>
        ) : null}
        {awaitingOutput ? (
          <div className={cx("col-span-full flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#1a1a1a] px-4 text-center text-xs uppercase tracking-[0.2em] text-white/28", compact ? "min-h-[92px]" : "min-h-[162px]")}>
            Awaiting output
          </div>
        ) : null}
      </div>
    );
  };

  const selectedOutputPreviewAsset =
    outputPreview?.assets.find((asset) => asset.id === outputPreview.selectedAssetId) ?? outputPreview?.assets[0] ?? null;

  return (
    <section className="h-full overflow-hidden bg-[color:var(--surface-card-strong)]">
      <div className="overflow-x-auto overflow-y-hidden">
        <div className={minGridWidth}>
          <div className={cx("grid border-b border-[color:var(--surface-border)] bg-[color:var(--surface-card)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]", gridColumns)}>
            <div className="border-r border-[color:var(--surface-border)] px-3 py-3 text-center">#</div>
            <div className="border-r border-[color:var(--surface-border)] px-3 py-3">{referenceColumnLabel}</div>
            {showAudioReferenceColumn ? <div className="border-r border-[color:var(--surface-border)] px-3 py-3">Audio Reference</div> : null}
            {showPromptColumn ? <div className="border-r border-[color:var(--surface-border)] px-3 py-3">{promptColumnLabel}</div> : null}
            {showOutputsColumn ? <div className="border-r border-[color:var(--surface-border)] px-3 py-3">Outputs</div> : null}
            {showPoseColumn ? (
              <div className="border-r border-[color:var(--surface-border)] px-3 py-3">{isPoseMultiplierWorkspaceLayout ? "Pose Multiplier" : "Pose"}</div>
            ) : null}
            {showUpscaleColumn ? (
              <div className="border-r border-[color:var(--surface-border)] px-3 py-3">Upscale</div>
            ) : null}
            {showFaceSwapColumn ? (
              <div className="border-r border-[color:var(--surface-border)] px-3 py-3">Face Swap</div>
            ) : null}
            <div className="border-r border-[color:var(--surface-border)] px-3 py-3">Status</div>
            <div className={cx("px-3 py-3 text-center", denseLayout && "xl:-translate-x-1")}>Remove</div>
          </div>

          {board.rows.map((row) => {
            const previewSrc = row.reference?.asset?.url || row.reference?.assetUrl || row.reference?.uploadUrl || null;
            const audioReference = row.audioReference ?? null;
            const audioReferenceUrl = audioReference?.asset?.url || audioReference?.assetUrl || audioReference?.uploadUrl || null;
            const promptLockedByAudioReference = showAudioReferenceColumn && Boolean(audioReference);
            const awaitingOutput = !row.outputAssets.length;
            const awaitingPoseOutput = !row.poseOutputAssets.length;
            const awaitingFaceSwapOutput = !row.faceSwapOutputAssets.length;
            const poseMultiplierEnabled = board.settings.poseMultiplierEnabled;
            const hasPoseOutputs = row.poseOutputAssets.length > 0;
            const hasFaceSwapOutputs = row.faceSwapOutputAssets.length > 0;
            const poseRowActive = poseMultiplierEnabled || row.poseMultiplier > 1 || hasPoseOutputs;
            const faceSwapEnabled = isFaceSwapWorkspaceLayout || row.faceSwap;
            const faceSwapRowActive = faceSwapEnabled || hasFaceSwapOutputs;
            const poseColumnSkipped = showPoseColumn && !isPoseMultiplierWorkspaceLayout && !poseRowActive;
            const faceSwapColumnSkipped = showFaceSwapColumn && !isFaceSwapWorkspaceLayout && !faceSwapRowActive;
            const upscaleColumnSkipped = showUpscaleColumn && !row.upscale;
            return (
              <div
                key={row.id}
                className={cx("grid min-h-[224px] border-b border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] transition hover:bg-[color:var(--surface-card)]", gridColumns)}
              >
                <div className="flex items-start justify-center border-r border-[color:var(--surface-border)] px-3 py-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-xs font-semibold text-[color:var(--text-muted)]">
                    {row.orderIndex + 1}
                  </span>
                </div>

                <div className={cellClass}>
                  {referenceColumnLocked ? (
                    <div className="relative flex h-full min-h-[188px] items-center justify-center overflow-hidden rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-3 text-center shadow-[inset_0_0_36px_color-mix(in_srgb,var(--text-strong)_4%,transparent)]">
                      <div className="absolute -inset-8 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--text-strong)_10%,transparent),color-mix(in_srgb,var(--text-strong)_3%,transparent)_42%,transparent_72%)] blur-2xl" />
                      <div className="absolute inset-0 bg-[color:var(--surface-card)]/30 backdrop-blur-md" />
                      <div className="relative inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] shadow-[var(--shadow-soft)]">
                        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 20 20">
                          <path
                            fill="currentColor"
                            d="M6.5 8V6.5a3.5 3.5 0 1 1 7 0V8h.5a1.5 1.5 0 0 1 1.5 1.5V16A1.5 1.5 0 0 1 14 17.5H6A1.5 1.5 0 0 1 4.5 16V9.5A1.5 1.5 0 0 1 6 8h.5Zm1.5 0h4V6.5a2 2 0 1 0-4 0V8Z"
                          />
                        </svg>
                        Locked
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cx(
                        "workspace-row-image-shell flex h-full min-h-[188px] flex-col rounded-xl border p-3",
                        effectiveAutoPromptImage && "workspace-row-image-shell--auto",
                        effectiveAutoPromptImage ? autoSurfaceClass : "border-[color:var(--surface-border)] bg-[color:var(--surface-card)]",
                      )}
                    >
                      <div
                        className={cx(
                          "workspace-row-image-preview relative mb-3 flex items-center justify-center overflow-hidden rounded-lg border text-center",
                          isVideoReference
                            ? "mx-auto aspect-[9/16] w-full max-w-[122px] flex-none rounded-2xl px-3 py-4 shadow-[var(--shadow-soft)]"
                            : cx(
                                "mx-auto w-full flex-none px-4 py-5 shadow-[var(--shadow-soft)]",
                                isFaceSwapWorkspaceLayout ? "aspect-[3/4] max-w-[190px]" : "aspect-[4/5] max-w-[172px]",
                              ),
                          effectiveAutoPromptImage && "workspace-row-image-preview--auto",
                          effectiveAutoPromptImage ? "border-[#5f8628] bg-[#2f4513]" : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]",
                        )}
                      >
                        {effectiveAutoPromptImage ? (
                          <div className="workspace-row-reference-auto-card relative flex h-full w-full flex-col overflow-hidden rounded-[inherit] px-3 py-3 text-left text-[#f4ffd8]">
                            <div className="relative z-10 flex items-center justify-between gap-2">
                              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[#c7ff27]/25 bg-[#c7ff27]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#f4ffd8]">
                                <svg aria-hidden="true" className="size-3 flex-none" viewBox="0 0 20 20">
                                  <path
                                    d="M9.1 2.4a.9.9 0 0 1 1.8 0l.16 1.26a4.5 4.5 0 0 0 3.88 3.88l1.26.16a.9.9 0 0 1 0 1.8l-1.26.16a4.5 4.5 0 0 0-3.88 3.88l-.16 1.26a.9.9 0 0 1-1.8 0l-.16-1.26a4.5 4.5 0 0 0-3.88-3.88L3.8 9.5a.9.9 0 0 1 0-1.8l1.26-.16a4.5 4.5 0 0 0 3.88-3.88L9.1 2.4Z"
                                    fill="currentColor"
                                  />
                                </svg>
                                <span className="truncate">{autoReferenceTitle}</span>
                              </span>
                              <span className="workspace-auto-prompt-live-dot flex-none" aria-hidden="true" />
                            </div>

                            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 text-center">
                              <span className="workspace-row-reference-auto-icon inline-flex size-14 items-center justify-center rounded-2xl border border-[#c7ff27]/22 bg-[#c7ff27]/12 text-[#f4ffd8] shadow-[inset_0_1px_0_rgba(244,255,216,0.18)]">
                                {isVideoReference ? (
                                  <svg aria-hidden="true" className="size-7" viewBox="0 0 24 24">
                                    <path
                                      d="M5 6.5A2.5 2.5 0 0 1 7.5 4h6A2.5 2.5 0 0 1 16 6.5v11A2.5 2.5 0 0 1 13.5 20h-6A2.5 2.5 0 0 1 5 17.5v-11Zm11 3.25 3.67-2.1A.9.9 0 0 1 21 8.43v7.14a.9.9 0 0 1-1.33.78L16 14.25v-4.5Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                ) : (
                                  <svg aria-hidden="true" className="size-7" viewBox="0 0 24 24">
                                    <path
                                      d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7a2.5 2.5 0 0 1 2.5-2.5Zm0 1.5A1 1 0 0 0 5.5 7v7.8l3.36-3.36a1.75 1.75 0 0 1 2.48 0l1.16 1.16.86-.86a1.75 1.75 0 0 1 2.48 0l2.66 2.66V7a1 1 0 0 0-1-1h-11Zm3.5 4.25a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                )}
                              </span>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b4d37a]">{autoReferenceKindLabel}</p>
                            </div>

                            <div className="relative z-10 flex items-center justify-between gap-2 border-t border-[#c7ff27]/14 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#b4d37a]">
                              <span>Live</span>
                              <span className="h-px flex-1 bg-[#c7ff27]/16" />
                              <span>Ready</span>
                            </div>
                          </div>
                        ) : previewSrc ? (
                          isVideoReference ? (
                            <>
                              <video className="absolute inset-0 h-full w-full object-cover" muted playsInline preload="metadata" src={previewSrc} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
                              <button
                                aria-label={`Preview ${row.reference?.label || referenceCopy.selectedLabel}`}
                                className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 text-white transition hover:bg-black/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                                onClick={() => setVideoPreview({ src: previewSrc, label: row.reference?.label || referenceCopy.selectedLabel, error: null })}
                                title="Preview video"
                                type="button"
                              >
                                <span className="inline-flex size-14 items-center justify-center rounded-full border border-white/18 bg-black/48 text-white shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-md transition hover:scale-105 hover:border-lime-200/55 hover:bg-lime-300/16 hover:text-lime-100">
                                  <svg aria-hidden="true" className="ml-0.5 size-6" viewBox="0 0 24 24">
                                    <path d="M8.5 5.8v12.4L18.5 12 8.5 5.8Z" fill="currentColor" />
                                  </svg>
                                </span>
                              </button>
                              <div className="relative mt-auto flex w-full flex-col items-center gap-2 self-end">
                                <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{row.reference?.label || referenceCopy.selectedLabel}</p>
                                <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-100/80">
                                  {row.reference?.sourceType === "ASSET" ? "Gallery" : "Local upload"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <img alt={row.reference?.label || row.label} className="absolute inset-0 h-full w-full object-cover" src={previewSrc} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                              <div className="relative mt-auto flex w-full flex-col items-center gap-2 self-end">
                                <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{row.reference?.label || referenceCopy.selectedLabel}</p>
                                <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-100/80">
                                  {row.reference?.sourceType === "ASSET" ? "Gallery" : "Local upload"}
                                </span>
                              </div>
                            </>
                          )
                        ) : (
                          <div
                            className={cx(
                              "workspace-row-image-label flex flex-col items-center justify-center gap-3 text-center",
                              "text-[color:var(--text-muted)]",
                            )}
                          >
                            <span
                              className={cx(
                                "inline-flex size-14 items-center justify-center rounded-2xl border transition",
                                "border-[color:var(--surface-border)] bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
                              )}
                            >
                              {isVideoReference ? (
                                <svg aria-hidden="true" className="size-7" viewBox="0 0 24 24">
                                  <path
                                    d="M5 6.5A2.5 2.5 0 0 1 7.5 4h6A2.5 2.5 0 0 1 16 6.5v11A2.5 2.5 0 0 1 13.5 20h-6A2.5 2.5 0 0 1 5 17.5v-11Zm11 3.25 3.67-2.1A.9.9 0 0 1 21 8.43v7.14a.9.9 0 0 1-1.33.78L16 14.25v-4.5Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              ) : (
                                <svg aria-hidden="true" className="size-7" viewBox="0 0 24 24">
                                  <path
                                    d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7a2.5 2.5 0 0 1 2.5-2.5Zm0 1.5A1 1 0 0 0 5.5 7v7.8l3.36-3.36a1.75 1.75 0 0 1 2.48 0l1.16 1.16.86-.86a1.75 1.75 0 0 1 2.48 0l2.66 2.66V7a1 1 0 0 0-1-1h-11Zm3.5 4.25a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              )}
                            </span>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                              {referenceCopy.emptyLabel}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="mt-auto grid gap-2">
                        <label
                          className={cx(
                            theme.buttonSecondary + " h-9 rounded-lg border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-0 text-center text-xs text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                            effectiveAutoPromptImage ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                          )}
                        >
                          {referenceCopy.uploadLabel}
                          <input
                            className="hidden"
                            accept={referenceCopy.accept}
                            disabled={effectiveAutoPromptImage}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file && !effectiveAutoPromptImage) {
                                void onUploadReference(row, file);
                              }
                              event.target.value = "";
                            }}
                            type="file"
                          />
                        </label>
                        <button
                          className={theme.buttonSecondary + " h-9 rounded-lg border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-0 text-xs text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]"}
                          disabled={effectiveAutoPromptImage}
                          onClick={() => onPickReference(row)}
                          type="button"
                        >
                          {referenceCopy.pickLabel}
                        </button>
                        {row.reference ? (
                          <button
                            className={theme.buttonDanger + " rounded-lg px-3 py-2 text-xs"}
                            disabled={effectiveAutoPromptImage}
                            onClick={() => void onCommitRow({ rowId: row.id, clearReference: true })}
                            type="button"
                          >
                            {referenceCopy.clearLabel}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {showAudioReferenceColumn ? (
                  <div className={cellClass}>
                    <div
                      className={cx(
                        "relative flex h-full min-h-[188px] flex-col rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-3 transition",
                        audioReferenceLocked && "pointer-events-none opacity-55 blur-[1px]",
                      )}
                    >
                      <div className="mb-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-5 text-center">
                        <span
                          className={cx(
                            "inline-flex size-14 items-center justify-center rounded-2xl border transition",
                            audioReferenceUrl
                              ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                              : "border-[color:var(--surface-border)] bg-[color:var(--surface-card)] text-[color:var(--text-muted)]",
                          )}
                        >
                          <svg aria-hidden="true" className="size-7" viewBox="0 0 24 24">
                            <path
                              d="M4 14.5v-5m4 8v-11m4 14v-17m4 14v-11m4 8v-5"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeWidth="2"
                            />
                          </svg>
                        </span>
                        {audioReferenceUrl ? (
                          <>
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{audioReference?.label || "Audio reference"}</p>
                            <span className="rounded-full border border-lime-300/15 bg-lime-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-100/80">
                              {audioReference?.sourceType === "ASSET" ? "Gallery" : "Local upload"}
                            </span>
                          </>
                        ) : (
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Add audio</p>
                        )}
                      </div>
                      <div className="mt-auto grid gap-2">
                        <label className={theme.buttonSecondary + " h-9 cursor-pointer rounded-lg border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-0 text-center text-xs text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]"}>
                          Upload audio
                          <input
                            className="hidden"
                            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.webm"
                            disabled={audioReferenceLocked}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file && !audioReferenceLocked) {
                                void onUploadAudioReference(row, file);
                              }
                              event.target.value = "";
                            }}
                            type="file"
                          />
                        </label>
                        <button
                          className={theme.buttonSecondary + " h-9 rounded-lg border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-0 text-xs text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]"}
                          disabled={audioReferenceLocked}
                          onClick={() => onPickAudioReference(row)}
                          type="button"
                        >
                          Pick from Gallery
                        </button>
                        {audioReference ? (
                          <button
                            className={theme.buttonDanger + " rounded-lg px-3 py-2 text-xs"}
                            disabled={audioReferenceLocked}
                            onClick={() => void onCommitRow({ rowId: row.id, clearAudioReference: true })}
                            type="button"
                          >
                            Clear audio
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {showPromptColumn ? (
                  <div className={cellClass}>
                    <div
                      className={cx(
                        "workspace-row-prompt-shell h-full rounded-xl border p-3",
                        board.settings.autoPromptGen && "workspace-row-prompt-shell--auto",
                        board.settings.autoPromptGen ? autoSurfaceClass : "border-white/8 bg-[#202020]",
                        promptLockedByAudioReference && "pointer-events-none opacity-55 blur-[1px]",
                      )}
                    >
                      {board.settings.autoPromptGen ? (
                        <div className="workspace-row-prompt-auto-card relative flex h-full min-h-[188px] w-full items-center justify-center overflow-hidden rounded-lg border border-[#79a82c]/60 p-3 text-[#f4ffd8]">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#f4ffd8]/45" />
                          <span className="pointer-events-none absolute right-3 top-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-[#c7ff27]/25 bg-[#c7ff27]/12 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#f4ffd8] shadow-[inset_0_1px_0_rgba(244,255,216,0.18),0_8px_18px_rgba(0,0,0,0.18)]">
                            <svg aria-hidden="true" className="size-3.5 flex-none" viewBox="0 0 20 20">
                              <path
                                d="M9.1 2.4a.9.9 0 0 1 1.8 0l.16 1.26a4.5 4.5 0 0 0 3.88 3.88l1.26.16a.9.9 0 0 1 0 1.8l-1.26.16a4.5 4.5 0 0 0-3.88 3.88l-.16 1.26a.9.9 0 0 1-1.8 0l-.16-1.26a4.5 4.5 0 0 0-3.88-3.88L3.8 9.5a.9.9 0 0 1 0-1.8l1.26-.16a4.5 4.5 0 0 0 3.88-3.88L9.1 2.4Zm6.34 11.04a.65.65 0 0 1 1.12 0l.36.64.64.36a.65.65 0 0 1 0 1.12l-.64.36-.36.64a.65.65 0 0 1-1.12 0l-.36-.64-.64-.36a.65.65 0 0 1 0-1.12l.64-.36.36-.64Z"
                                fill="currentColor"
                              />
                            </svg>
                            <span className="truncate">Auto Prompt</span>
                            <span className="workspace-auto-prompt-live-dot ml-0.5 flex-none scale-75" aria-hidden="true" />
                          </span>
                          <svg aria-hidden="true" className="pointer-events-none size-12 text-[#f4ffd8]/30" viewBox="0 0 20 20">
                            <path
                              d="M9.1 2.4a.9.9 0 0 1 1.8 0l.16 1.26a4.5 4.5 0 0 0 3.88 3.88l1.26.16a.9.9 0 0 1 0 1.8l-1.26.16a4.5 4.5 0 0 0-3.88 3.88l-.16 1.26a.9.9 0 0 1-1.8 0l-.16-1.26a4.5 4.5 0 0 0-3.88-3.88L3.8 9.5a.9.9 0 0 1 0-1.8l1.26-.16a4.5 4.5 0 0 0 3.88-3.88L9.1 2.4Zm6.34 11.04a.65.65 0 0 1 1.12 0l.36.64.64.36a.65.65 0 0 1 0 1.12l-.64.36-.36.64a.65.65 0 0 1-1.12 0l-.36-.64-.64-.36a.65.65 0 0 1 0-1.12l.64-.36.36-.64Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="relative h-full min-h-[188px]">
                          <button
                            className="group/improve absolute right-3 top-3 z-[70] inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-2.5 text-[11px] font-semibold text-[color:var(--text-main)] shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={promptLockedByAudioReference || !(promptDrafts[row.id] ?? row.prompt).trim() || Boolean(improvingPromptRowId)}
                            onClick={() => handleImproveRowPrompt(row)}
                            title={`Improve this prompt without turning on Auto Prompt. Cost: ${formatCreditCost(IMPROVE_PROMPT_CREDITS)} credits.`}
                            type="button"
                          >
                            <svg aria-hidden="true" className="size-3.5" viewBox="0 0 20 20">
                              <path
                                d="M10.9 2.9c.08-.48.76-.48.84 0l.18 1.1a5.28 5.28 0 0 0 4.36 4.36l1.1.18c.48.08.48.76 0 .84l-1.1.18a5.28 5.28 0 0 0-4.36 4.36l-.18 1.1c-.08.48-.76.48-.84 0l-.18-1.1a5.28 5.28 0 0 0-4.36-4.36l-1.1-.18c-.48-.08-.48-.76 0-.84l1.1-.18A5.28 5.28 0 0 0 10.72 4l.18-1.1Z"
                                fill="currentColor"
                              />
                              <path
                                d="M4.72 12.75c.06-.3.48-.3.54 0l.08.39a2.4 2.4 0 0 0 1.9 1.9l.39.08c.3.06.3.48 0 .54l-.39.08a2.4 2.4 0 0 0-1.9 1.9l-.08.39c-.06.3-.48.3-.54 0l-.08-.39a2.4 2.4 0 0 0-1.9-1.9l-.39-.08c-.3-.06-.3-.48 0-.54l.39-.08a2.4 2.4 0 0 0 1.9-1.9l.08-.39Z"
                                fill="currentColor"
                              />
                            </svg>
                            {improvingPromptRowId === row.id ? "Improving" : "Improve prompt"}
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute bottom-[calc(100%+0.375rem)] right-0 z-[100] whitespace-nowrap rounded-lg border border-[#c7ff27]/45 bg-[#4d7311] px-2.5 py-1.5 text-[10px] font-extrabold text-[#f4ffd8] opacity-0 shadow-[0_14px_30px_rgba(0,0,0,0.42)] ring-1 ring-black/20 transition group-hover/improve:opacity-100"
                            >
                              Cost: {formatCreditCost(IMPROVE_PROMPT_CREDITS)} credits
                            </span>
                          </button>
                          <textarea
                            className="workspace-row-prompt-input h-full min-h-[188px] w-full resize-none rounded-lg border border-white/8 bg-[#222222] px-3 pb-2 pt-12 text-sm leading-6 text-white outline-none transition placeholder:text-white/34 focus:border-white/14 focus:bg-[#262626]"
                            disabled={promptLockedByAudioReference}
                            onBlur={(event) => handlePromptCommit(row, event.target.value)}
                            onChange={(event) => handlePromptDraftChange(row.id, event.target.value)}
                            placeholder="Describe the job prompt for this influencer row"
                            value={promptDrafts[row.id] ?? row.prompt}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {showOutputsColumn ? <div className={cellClass}>{renderOutputGrid(row, awaitingOutput, false, row.outputAssets, "Output")}</div> : null}

                {showPoseColumn ? (
                  <div className={cellClass}>
                    {poseColumnSkipped ? (
                      <div className={skippedPanelClass}>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--text-strong)_8%,transparent),transparent_62%)] opacity-70" />
                        <div className="relative z-10 blur-[1px]">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Multiplier</p>
                          <div className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-semibold opacity-55">
                            Off
                          </div>
                        </div>
                        <div className={skippedBadgeClass}>
                          Skipped
                        </div>
                      </div>
                    ) : (
                      <div className={stackedControlPanelClass}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">Multiplier</p>
                        <div
                          className={cx(
                            "inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                            poseRowActive
                              ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0]"
                              : "border-white/8 bg-[#222222] text-white/62",
                          )}
                        >
                          {poseRowActive ? (
                            <>
                              <span>{row.poseMultiplier}x</span>
                              {board.settings.posePromptMode === "AUTO" ? <span className="workspace-auto-prompt-live-dot" aria-hidden="true" /> : null}
                            </>
                          ) : (
                            "Off"
                          )}
                        </div>
                        {isPoseMultiplierWorkspaceLayout ? (
                          renderOutputGrid(row, awaitingPoseOutput, true, row.poseOutputAssets.length ? row.poseOutputAssets : row.outputAssets, "Pose Multiplier")
                        ) : poseRowActive ? (
                          renderOutputGrid(row, awaitingPoseOutput, true, row.poseOutputAssets, "Pose Multiplier")
                        ) : awaitingOutput ? (
                          <div className={pendingJobClass}>Pending</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                {showUpscaleColumn ? (
                  <div className={cellClass}>
                    {upscaleColumnSkipped ? (
                      <div className={skippedPanelClass}>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--text-strong)_8%,transparent),transparent_62%)] opacity-70" />
                        <div className="relative z-10 blur-[1px]">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Upscale</p>
                          <div className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-semibold opacity-55">
                            Off
                          </div>
                        </div>
                        <div className={skippedBadgeClass}>
                          Skipped
                        </div>
                      </div>
                    ) : (
                      <div className={stackedControlPanelClass}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">Upscale</p>
                        <button
                          className={cx(
                            "inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
                            row.upscale
                              ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0] hover:bg-[#395119]"
                              : "border-white/8 bg-[#222222] text-white/62 hover:bg-[#2a2a2a]",
                          )}
                          onClick={() => void onCommitRow({ rowId: row.id, upscale: !row.upscale })}
                          type="button"
                        >
                          {row.upscale ? "On" : "Off"}
                        </button>
                        {awaitingOutput ? (
                          <div className={pendingJobClass}>
                            Pending
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                {showFaceSwapColumn ? (
                  <div className={cellClass}>
                    {faceSwapColumnSkipped ? (
                      <div className={skippedPanelClass}>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--text-strong)_8%,transparent),transparent_62%)] opacity-70" />
                        <div className="relative z-10 blur-[1px]">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Swap</p>
                          <div className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 py-2 text-sm font-semibold opacity-55">
                            Off
                          </div>
                        </div>
                        <div className={skippedBadgeClass}>
                          Skipped
                        </div>
                      </div>
                    ) : (
                      <div className={stackedControlPanelClass}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">Swap</p>
                        <button
                          className={cx(
                            "inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
                            faceSwapEnabled
                              ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0] hover:bg-[#395119]"
                              : "border-white/8 bg-[#222222] text-white/62 hover:bg-[#2a2a2a]",
                          )}
                          disabled={isFaceSwapWorkspaceLayout}
                          onClick={() => {
                            if (!isFaceSwapWorkspaceLayout) {
                              void onCommitRow({ rowId: row.id, faceSwap: !row.faceSwap });
                            }
                          }}
                          type="button"
                        >
                          {faceSwapEnabled ? "On" : "Off"}
                        </button>
                        {faceSwapRowActive ? (
                          renderOutputGrid(row, awaitingFaceSwapOutput, true, row.faceSwapOutputAssets, "Face Swap")
                        ) : !isPoseMultiplierWorkspaceLayout && awaitingOutput ? (
                          <div className={pendingJobClass}>Pending</div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className={cellClass}>
                  <div className={cx(panelClass, "space-y-3")}>
                    <span className={cx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]", statusClass(row.status))}>
                      {row.status}
                    </span>
                    <p className="line-clamp-3 text-sm leading-6 text-white/60">{row.errorMessage || "No row-level errors"}</p>
                    {row.lastRunAt ? (
                      <p className="text-xs leading-5 text-white/34">
                        {new Date(row.lastRunAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start justify-center px-3 py-3">
                  <button
                    aria-label={`Remove row ${row.orderIndex + 1}`}
                    className="group inline-grid size-9 place-items-center rounded-xl border border-rose-400/18 bg-rose-400/[0.06] text-rose-200/80 transition hover:border-rose-300/35 hover:bg-rose-400/14 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35"
                    onClick={() => void onDeleteRow(row.id)}
                    title="Remove row"
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4 transition group-hover:scale-110" viewBox="0 0 20 20">
                      <path
                        d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {outputPreview ? (
        <div
          aria-label="Output batch preview"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050505]/92 p-3 backdrop-blur-xl sm:p-4"
          onClick={() => setOutputPreview(null)}
          role="dialog"
        >
          <div
            className="relative flex h-[min(96vh,940px)] w-[min(98vw,1240px)] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#090909] shadow-[0_34px_120px_rgba(0,0,0,0.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(199,255,39,0.08),transparent_34%),radial-gradient(circle_at_18%_88%,rgba(255,255,255,0.05),transparent_32%)]" />
            <div className="relative z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-black/36 px-4 py-3 backdrop-blur-xl">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">{outputPreview.columnLabel}</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {outputPreview.rowLabel} · {outputPreview.assets.length} files
                </p>
              </div>
              <button
                aria-label="Close output preview"
                className="inline-grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/68 transition hover:bg-white/[0.1] hover:text-white"
                onClick={() => setOutputPreview(null)}
                type="button"
              >
                <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                  <path
                    d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            {selectedOutputPreviewAsset ? (
              <>
                <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/18 p-4 sm:p-7">
                  {outputPreview.assets.length > 1 ? (
                    <>
                      <button
                        aria-label="Previous output"
                        className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/38 text-white/72 shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:grid"
                        onClick={() => selectAdjacentOutputPreviewAsset(-1)}
                        type="button"
                      >
                        <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                          <path d="M12.7 4.3a.75.75 0 0 1 0 1.06L8.06 10l4.64 4.64a.75.75 0 1 1-1.06 1.06l-5.17-5.17a.75.75 0 0 1 0-1.06l5.17-5.17a.75.75 0 0 1 1.06 0Z" fill="currentColor" />
                        </svg>
                      </button>
                      <button
                        aria-label="Next output"
                        className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/38 text-white/72 shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:grid"
                        onClick={() => selectAdjacentOutputPreviewAsset(1)}
                        type="button"
                      >
                        <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                          <path d="M7.3 4.3a.75.75 0 0 1 1.06 0l5.17 5.17a.75.75 0 0 1 0 1.06L8.36 15.7a.75.75 0 1 1-1.06-1.06L11.94 10 7.3 5.36a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                        </svg>
                      </button>
                    </>
                  ) : null}
                  {renderOutputPreviewMain(selectedOutputPreviewAsset)}
                </div>
                {outputPreview.assets.length > 1 ? (
                  <div className="relative z-20 border-t border-white/10 bg-black/42 px-3 py-3 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-full justify-center">
                      <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.045] p-2 shadow-[0_16px_50px_rgba(0,0,0,0.34)]">
                        {outputPreview.assets.map((asset, index) => renderOutputPreviewThumb(asset, index, asset.id === selectedOutputPreviewAsset.id))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {videoPreview ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/74 p-4 backdrop-blur-md"
          onClick={() => setVideoPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video preview"
        >
          <div
            className="w-[min(92vw,860px)] overflow-hidden rounded-2xl border border-white/12 bg-[#151515] shadow-[0_28px_90px_rgba(0,0,0,0.52)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">Video reference</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{videoPreview.label}</p>
              </div>
              <button
                aria-label="Close video preview"
                className="inline-grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/68 transition hover:bg-white/[0.1] hover:text-white"
                onClick={() => setVideoPreview(null)}
                type="button"
              >
                <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                  <path
                    d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <div className="bg-black">
              {videoPreview.error ? (
                <div className="border-b border-rose-300/18 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
                  {videoPreview.error}
                </div>
              ) : null}
              <video
                autoPlay
                className="max-h-[76vh] w-full bg-black object-contain"
                controls
                onError={() =>
                  setVideoPreview((current) =>
                    current
                      ? {
                          ...current,
                          error:
                            "This uploaded reference is not playable as a standalone browser video. The plugin likely captured a streaming fragment instead of the full video file.",
                        }
                      : current,
                  )
                }
                playsInline
                preload="auto"
                src={videoPreview.src}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/48">
              <span className="truncate">Source: {videoPreview.src}</span>
              <a className="font-semibold text-lime-100/80 transition hover:text-lime-100" href={videoPreview.src} rel="noreferrer" target="_blank">
                Open file
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
        <button className={theme.buttonSecondary + " rounded-lg border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-2 text-xs text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]"} disabled={board.rows.length >= 8} onClick={() => void onAddRow()} type="button">
          + Add Row
        </button>
      </div>
    </section>
  );
}
