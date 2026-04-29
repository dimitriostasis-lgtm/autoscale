import { useEffect, useState } from "react";

import { cx } from "../../lib/cx";
import { improvePromptDraft } from "../../lib/promptImprovement";
import type { ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../../types";
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
}: WorkspaceGridProps) {
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [improvingPromptRowId, setImprovingPromptRowId] = useState<string | null>(null);
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
        pickLabel: "Pick video",
        clearLabel: "Clear video",
        accept: "video/*,.mp4,.mov,.m4v,.webm",
      }
    : {
        emptyLabel: "Add image",
        selectedLabel: "Image reference",
        autoLabel: "Auto image",
        uploadLabel: "Upload image",
        pickLabel: "Pick image",
        clearLabel: "Clear image",
        accept: "image/*",
      };
  const autoSurfaceClass = "border-[#4e6b22] bg-[#314513]";
  const controlColumnCount = [showPoseColumn, showUpscaleColumn, showFaceSwapColumn].filter(Boolean).length;
  const showRowControlColumns = controlColumnCount > 0;
  const gridColumns = isFaceSwapWorkspaceLayout
    ? "grid-cols-[56px_minmax(260px,0.9fr)_minmax(180px,0.48fr)_minmax(0,0.7fr)_96px]"
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
      ? "grid-cols-[56px_minmax(240px,0.9fr)_minmax(0,1.35fr)_minmax(0,0.82fr)_96px]"
    : isVideoReference
      ? "grid-cols-[56px_minmax(210px,0.72fr)_minmax(0,1.35fr)_minmax(0,1.05fr)_minmax(0,0.78fr)_96px]"
    : referenceColumnLocked
      ? "grid-cols-[56px_minmax(150px,0.58fr)_minmax(0,1.25fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_96px]"
      : "grid-cols-[56px_repeat(4,minmax(0,1fr))_96px]";
  const minGridWidth = isFaceSwapWorkspaceLayout
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

  const renderOutputGrid = (row: WorkspaceRow, awaitingOutput: boolean, compact = false) => (
    <div className={cx("grid grid-cols-2 gap-3 rounded-xl border border-white/8 bg-[#202020] p-3", compact ? "min-h-[116px] flex-1" : "h-full min-h-[188px]")}>
      {row.outputAssets.map((asset) => (
        <div key={asset.id} className="max-h-[82px] overflow-hidden rounded-lg border border-white/8 bg-[#181818]">
          <img alt={asset.fileName} className="h-full w-full object-cover" src={asset.url} />
        </div>
      ))}
      {awaitingOutput ? (
        <div className={cx("col-span-full flex items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#1a1a1a] px-4 text-center text-xs uppercase tracking-[0.2em] text-white/28", compact ? "min-h-[92px]" : "min-h-[162px]")}>
          Awaiting output
        </div>
      ) : null}
    </div>
  );

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
            <div className="px-3 py-3 text-center">Remove</div>
          </div>

          {board.rows.map((row) => {
            const previewSrc = row.reference?.asset?.url || row.reference?.assetUrl || row.reference?.uploadUrl || null;
            const audioReference = row.audioReference ?? null;
            const audioReferenceUrl = audioReference?.asset?.url || audioReference?.assetUrl || audioReference?.uploadUrl || null;
            const promptLockedByAudioReference = showAudioReferenceColumn && Boolean(audioReference);
            const awaitingOutput = !row.outputAssets.length;
            const poseMultiplierEnabled = board.settings.poseMultiplierEnabled;
            const poseColumnSkipped = showPoseColumn && !isPoseMultiplierWorkspaceLayout && !poseMultiplierEnabled;
            const faceSwapColumnSkipped = showFaceSwapColumn && !isFaceSwapWorkspaceLayout && !row.faceSwap;
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
                          Pick from gallery
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
                        <div className="workspace-row-prompt-auto-card relative flex h-full min-h-[188px] w-full items-center justify-center overflow-hidden rounded-lg border border-[#79a82c]/60 p-4 text-[#f4ffd8]">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#f4ffd8]/45" />
                          <span className="relative inline-flex max-w-full items-center justify-center gap-3 rounded-2xl border border-[#c7ff27]/25 bg-[#c7ff27]/10 px-5 py-4 text-center text-lg font-extrabold uppercase tracking-[0.18em] text-[#f4ffd8] shadow-[inset_0_1px_0_rgba(244,255,216,0.18)]">
                            <svg aria-hidden="true" className="size-6 flex-none" viewBox="0 0 20 20">
                              <path
                                d="M9.1 2.4a.9.9 0 0 1 1.8 0l.16 1.26a4.5 4.5 0 0 0 3.88 3.88l1.26.16a.9.9 0 0 1 0 1.8l-1.26.16a4.5 4.5 0 0 0-3.88 3.88l-.16 1.26a.9.9 0 0 1-1.8 0l-.16-1.26a4.5 4.5 0 0 0-3.88-3.88L3.8 9.5a.9.9 0 0 1 0-1.8l1.26-.16a4.5 4.5 0 0 0 3.88-3.88L9.1 2.4Zm6.34 11.04a.65.65 0 0 1 1.12 0l.36.64.64.36a.65.65 0 0 1 0 1.12l-.64.36-.36.64a.65.65 0 0 1-1.12 0l-.36-.64-.64-.36a.65.65 0 0 1 0-1.12l.64-.36.36-.64Z"
                                fill="currentColor"
                              />
                            </svg>
                            <span>Auto Prompt</span>
                          </span>
                        </div>
                      ) : (
                        <div className="relative h-full min-h-[188px]">
                          <button
                            className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-2.5 text-[11px] font-semibold text-[color:var(--text-main)] shadow-[0_8px_18px_rgba(0,0,0,0.14)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={promptLockedByAudioReference || !(promptDrafts[row.id] ?? row.prompt).trim() || Boolean(improvingPromptRowId)}
                            onClick={() => handleImproveRowPrompt(row)}
                            title="Improve this prompt without turning on Auto Prompt."
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

                {showOutputsColumn ? <div className={cellClass}>{renderOutputGrid(row, awaitingOutput)}</div> : null}

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
                            "inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
                            poseMultiplierEnabled
                              ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0]"
                              : "border-white/8 bg-[#222222] text-white/62",
                          )}
                        >
                          {poseMultiplierEnabled ? `${row.poseMultiplier}x` : "Off"}
                        </div>
                        {isPoseMultiplierWorkspaceLayout ? renderOutputGrid(row, awaitingOutput, true) : awaitingOutput ? (
                          <div className={pendingJobClass}>
                            Pending
                          </div>
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
                            row.faceSwap
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
                          {isFaceSwapWorkspaceLayout || row.faceSwap ? "On" : "Off"}
                        </button>
                        {!isPoseMultiplierWorkspaceLayout && awaitingOutput ? (
                          <div className={pendingJobClass}>
                            Pending
                          </div>
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

      <div className="border-t border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
        <button className={theme.buttonSecondary + " rounded-lg border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-2 text-xs text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]"} disabled={board.rows.length >= 8} onClick={() => void onAddRow()} type="button">
          + Add Row
        </button>
      </div>
    </section>
  );
}
