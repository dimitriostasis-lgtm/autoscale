import { useState } from "react";

import { cx } from "../../lib/cx";
import type { ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../../types";
import { theme } from "../../styles/theme";
import { PosePromptSettingsModal } from "./PosePromptSettingsModal";

interface WorkspaceGridProps {
  board: WorkspaceBoard;
  onCommitRow: (input: {
    rowId: string;
    label?: string;
    prompt?: string;
    poseMultiplier?: number;
    posePromptTemplates?: string[] | null;
    faceSwap?: boolean;
    reference?: ReferenceSelection;
    clearReference?: boolean;
    clearPosePromptTemplates?: boolean;
  }) => Promise<void> | void;
  onUploadReference: (row: WorkspaceRow, file: File) => Promise<void> | void;
  onPickReference: (row: WorkspaceRow) => void;
  onDeleteRow: (rowId: string) => Promise<void> | void;
  onAddRow: () => Promise<void> | void;
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

export function WorkspaceGrid({ board, onCommitRow, onUploadReference, onPickReference, onDeleteRow, onAddRow }: WorkspaceGridProps) {
  const [posePromptSettingsRowId, setPosePromptSettingsRowId] = useState<string | null>(null);
  const autoSurfaceClass = "border-[#4e6b22] bg-[#314513]";
  const autoMessageClass = "text-[#dcf6a0]";
  const gridColumns = "grid-cols-[56px_repeat(7,minmax(0,1fr))]";
  const cellClass = "border-r border-white/8 px-3 py-3";
  const panelClass = "h-full rounded-xl border border-white/8 bg-[#202020] p-3";
  const posePromptSettingsVisible = board.settings.posePromptMode === "CUSTOM" && board.settings.poseMultiplierEnabled;
  const visiblePosePromptCount = Math.max(1, Math.min(4, board.settings.poseMultiplier));
  const activePosePromptRow = board.rows.find((row) => row.id === posePromptSettingsRowId) || null;
  const activePosePromptTemplates = activePosePromptRow?.posePromptTemplates || board.settings.posePromptTemplates;
  const sharedPosePromptTemplates = board.settings.posePromptTemplates;

  return (
    <section className="h-full overflow-hidden bg-[#171717]">
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="min-w-[1536px]">
          <div className={cx("grid border-b border-white/8 bg-[#212121] text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42", gridColumns)}>
            <div className="border-r border-white/8 px-3 py-3 text-center">#</div>
            <div className="border-r border-white/8 px-3 py-3">Reference</div>
            <div className="border-r border-white/8 px-3 py-3">Prompt</div>
            <div className="border-r border-white/8 px-3 py-3">Outputs</div>
            <div className="border-r border-white/8 px-3 py-3">Pose</div>
            <div className="border-r border-white/8 px-3 py-3">Face Swap</div>
            <div className="border-r border-white/8 px-3 py-3">Status</div>
            <div className="px-3 py-3">Actions</div>
          </div>

          {board.rows.map((row) => {
            const previewSrc = row.reference?.asset?.url || row.reference?.assetUrl || row.reference?.uploadUrl || null;
            const awaitingOutput = !row.outputAssets.length;
            const poseMultiplierEnabled = board.settings.poseMultiplierEnabled;
            return (
              <div
                key={row.id}
                className={cx("grid min-h-[246px] border-b border-white/6 bg-[#171717] transition hover:bg-[#1c1c1c]", gridColumns)}
              >
                <div className="flex items-start justify-center border-r border-white/8 px-3 py-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#202020] text-xs font-semibold text-white/48">
                    {row.orderIndex + 1}
                  </span>
                </div>

                <div className={cellClass}>
                  <div
                    className={cx(
                      "workspace-row-image-shell flex h-full flex-col rounded-xl border p-3",
                      board.settings.autoPromptImage && "workspace-row-image-shell--auto",
                      board.settings.autoPromptImage ? autoSurfaceClass : "border-white/8 bg-[#202020]",
                    )}
                  >
                    <div
                      className={cx(
                        "workspace-row-image-preview mb-3 aspect-[4/5] overflow-hidden rounded-lg border",
                        board.settings.autoPromptImage && "workspace-row-image-preview--auto",
                        board.settings.autoPromptImage ? "border-[#5f8628] bg-[#2f4513]" : "border-white/8 bg-[#181818]",
                      )}
                    >
                      {previewSrc ? (
                        <img alt={row.reference?.label || row.label} className="h-full w-full object-cover" src={previewSrc} />
                      ) : (
                        <div
                          className={cx(
                            "workspace-row-image-label flex h-full items-center justify-center px-4 text-center text-xs uppercase tracking-[0.24em]",
                            board.settings.autoPromptImage ? autoMessageClass : "text-white/26",
                          )}
                        >
                          {board.settings.autoPromptImage ? "Auto image" : "Row reference"}
                        </div>
                      )}
                    </div>
                    <div className="mt-auto grid gap-2">
                      <label
                        className={cx(
                          theme.buttonSecondary + " h-9 rounded-lg border-white/8 bg-[#2b2b2b] px-3 py-0 text-center text-xs text-white/78 hover:bg-[#323232]",
                          board.settings.autoPromptImage ? "cursor-not-allowed opacity-45" : "cursor-pointer",
                        )}
                      >
                        Upload
                        <input
                          className="hidden"
                          accept="image/*"
                          disabled={board.settings.autoPromptImage}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file && !board.settings.autoPromptImage) {
                              void onUploadReference(row, file);
                            }
                          }}
                          type="file"
                        />
                      </label>
                      <button
                        className={theme.buttonSecondary + " h-9 rounded-lg border-white/8 bg-[#2b2b2b] px-3 py-0 text-xs text-white/78 hover:bg-[#323232]"}
                        disabled={board.settings.autoPromptImage}
                        onClick={() => onPickReference(row)}
                        type="button"
                      >
                        Pick from gallery
                      </button>
                      {row.reference ? (
                        <button
                          className={theme.buttonDanger + " rounded-lg px-3 py-2 text-xs"}
                          disabled={board.settings.autoPromptImage}
                          onClick={() => void onCommitRow({ rowId: row.id, clearReference: true })}
                          type="button"
                        >
                          Clear ref
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={cellClass}>
                  <div
                    className={cx(
                      "workspace-row-prompt-shell h-full rounded-xl border p-3",
                      board.settings.autoPromptGen && "workspace-row-prompt-shell--auto",
                      board.settings.autoPromptGen ? autoSurfaceClass : "border-white/8 bg-[#202020]",
                    )}
                  >
                    <textarea
                      className={cx(
                        "workspace-row-prompt-input h-full min-h-[210px] w-full resize-none rounded-lg border px-3 py-2 text-sm leading-6 outline-none transition",
                        board.settings.autoPromptGen
                          ? "border-[#5f8628] bg-[#2f4513] text-[#dcf6a0] placeholder:text-[#b4d37a]"
                          : "border-white/8 bg-[#222222] text-white placeholder:text-white/34 focus:border-white/14 focus:bg-[#262626]",
                      )}
                      defaultValue={row.prompt}
                      onBlur={(event) => {
                        if (event.target.value !== row.prompt) {
                          void onCommitRow({ rowId: row.id, prompt: event.target.value });
                        }
                      }}
                      placeholder={board.settings.autoPromptGen ? "Auto prompt enabled" : "Describe the job prompt for this influencer row"}
                      readOnly={board.settings.autoPromptGen}
                    />
                  </div>
                </div>

                <div className={cellClass}>
                  <div className="grid h-full min-h-[210px] grid-cols-2 gap-3 rounded-xl border border-white/8 bg-[#202020] p-3">
                    {row.outputAssets.map((asset) => (
                      <div key={asset.id} className="max-h-[92px] overflow-hidden rounded-lg border border-white/8 bg-[#181818]">
                        <img alt={asset.fileName} className="h-full w-full object-cover" src={asset.url} />
                      </div>
                    ))}
                    {awaitingOutput ? (
                      <div className="col-span-full flex min-h-[184px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#1a1a1a] px-4 text-center text-xs uppercase tracking-[0.2em] text-white/28">
                        Awaiting output
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={cellClass}>
                  <div className={cx(panelClass, "flex flex-col justify-between")}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">Multiplier</p>
                    <div
                      className={cx(
                        "mt-3 rounded-lg border px-3 py-2 text-center text-sm font-semibold transition",
                        poseMultiplierEnabled
                          ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0]"
                          : "border-white/8 bg-[#222222] text-white/62",
                      )}
                    >
                      {poseMultiplierEnabled ? `${row.poseMultiplier}x` : "Off"}
                    </div>
                    {awaitingOutput ? (
                      <div className="mt-3 flex min-h-[56px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#1a1a1a] px-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/28">
                        Pending
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={cellClass}>
                  <div className={cx(panelClass, "flex flex-col justify-between")}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">Swap</p>
                    <button
                      className={cx(
                        "mt-3 inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
                        row.faceSwap
                          ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0] hover:bg-[#395119]"
                          : "border-white/8 bg-[#222222] text-white/62 hover:bg-[#2a2a2a]",
                      )}
                      onClick={() => void onCommitRow({ rowId: row.id, faceSwap: !row.faceSwap })}
                      type="button"
                    >
                      {row.faceSwap ? "On" : "Off"}
                    </button>
                    {awaitingOutput ? (
                      <div className="mt-3 flex min-h-[56px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-[#1a1a1a] px-3 text-center text-[10px] uppercase tracking-[0.18em] text-white/28">
                        Pending
                      </div>
                    ) : null}
                  </div>
                </div>

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
                  <button className={theme.buttonDanger + " h-9 rounded-lg px-3 py-0 text-xs"} onClick={() => void onDeleteRow(row.id)} type="button">
                    Del
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/8 bg-[#202020] px-4 py-3">
        <button className={theme.buttonSecondary + " rounded-lg border-white/8 bg-[#2b2b2b] px-3 py-2 text-xs text-white/80 hover:bg-[#323232]"} disabled={board.rows.length >= 8} onClick={() => void onAddRow()} type="button">
          + Add Row
        </button>
      </div>

      <PosePromptSettingsModal
        open={Boolean(activePosePromptRow) && posePromptSettingsVisible}
        templates={activePosePromptTemplates}
        usesSharedDefaults={!activePosePromptRow?.posePromptTemplates}
        visibleCount={visiblePosePromptCount}
        onClose={() => setPosePromptSettingsRowId(null)}
        onResetToShared={
          activePosePromptRow
            ? () => onCommitRow({ rowId: activePosePromptRow.id, clearPosePromptTemplates: true })
            : undefined
        }
        onSave={(nextTemplates) => {
          if (!activePosePromptRow) {
            return;
          }

          const matchesSharedDefaults = nextTemplates.every((template, index) => template === (sharedPosePromptTemplates[index] || ""));

          return matchesSharedDefaults
            ? onCommitRow({ rowId: activePosePromptRow.id, clearPosePromptTemplates: true })
            : onCommitRow({ rowId: activePosePromptRow.id, posePromptTemplates: nextTemplates });
        }}
      />
    </section>
  );
}
