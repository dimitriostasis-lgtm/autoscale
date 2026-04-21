import { cx } from "../../lib/cx";
import type { ReferenceSelection, WorkspaceBoard, WorkspaceRow } from "../../types";
import { theme } from "../../styles/theme";

interface WorkspaceGridProps {
  board: WorkspaceBoard;
  onCommitRow: (input: {
    rowId: string;
    label?: string;
    prompt?: string;
    reference?: ReferenceSelection;
    clearReference?: boolean;
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
  return (
    <section className={cx(theme.cardStrong, "overflow-hidden") + " glass-panel"}>
      <div className="overflow-x-auto">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[90px_1.6fr_1fr_1.2fr_0.9fr_80px] border-b border-white/8 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/42">
            <div>Row</div>
            <div>Prompt</div>
            <div>Reference</div>
            <div>Generated Output</div>
            <div>Status</div>
            <div />
          </div>

          {board.rows.map((row) => {
            const previewSrc = row.reference?.asset?.url || row.reference?.assetUrl || row.reference?.uploadUrl || null;
            return (
              <div
                key={row.id}
                className="grid grid-cols-[90px_1.6fr_1fr_1.2fr_0.9fr_80px] gap-0 border-b border-white/6 px-4 py-4 transition hover:bg-white/[0.02]"
              >
                <div className="pr-4">
                  <input
                    className={theme.input + " px-3 py-2 text-center"}
                    defaultValue={row.label}
                    onBlur={(event) => {
                      if (event.target.value !== row.label) {
                        void onCommitRow({ rowId: row.id, label: event.target.value });
                      }
                    }}
                  />
                </div>

                <div className="pr-4">
                  <textarea
                    className={theme.input + " min-h-[148px] resize-none leading-6"}
                    defaultValue={row.prompt}
                    onBlur={(event) => {
                      if (event.target.value !== row.prompt) {
                        void onCommitRow({ rowId: row.id, prompt: event.target.value });
                      }
                    }}
                    placeholder="Describe the job prompt for this influencer row"
                  />
                </div>

                <div className="pr-4">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-3">
                    <div className="mb-3 aspect-[4/5] overflow-hidden rounded-2xl border border-white/8 bg-black/20">
                      {previewSrc ? (
                        <img alt={row.reference?.label || row.label} className="h-full w-full object-cover" src={previewSrc} />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-xs uppercase tracking-[0.24em] text-white/26">
                          Row reference
                        </div>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <label className={theme.buttonSecondary + " cursor-pointer text-center"}>
                        Upload
                        <input
                          className="hidden"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void onUploadReference(row, file);
                            }
                          }}
                          type="file"
                        />
                      </label>
                      <button className={theme.buttonSecondary} onClick={() => onPickReference(row)} type="button">
                        Pick from gallery
                      </button>
                      {row.reference ? (
                        <button
                          className={theme.buttonDanger}
                          onClick={() => void onCommitRow({ rowId: row.id, clearReference: true })}
                          type="button"
                        >
                          Clear ref
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="pr-4">
                  <div className="grid min-h-[148px] grid-cols-2 gap-3 rounded-[24px] border border-white/8 bg-black/16 p-3">
                    {row.outputAssets.map((asset) => (
                      <div key={asset.id} className="overflow-hidden rounded-2xl border border-white/8 bg-black/30">
                        <img alt={asset.fileName} className="aspect-[3/4] h-full w-full object-cover" src={asset.url} />
                      </div>
                    ))}
                    {!row.outputAssets.length ? (
                      <div className="col-span-full flex min-h-[132px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center text-xs uppercase tracking-[0.2em] text-white/28">
                        Awaiting output
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="pr-4">
                  <div className="space-y-3 rounded-[24px] border border-white/8 bg-black/16 p-4">
                    <span className={cx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]", statusClass(row.status))}>
                      {row.status}
                    </span>
                    <p className="text-sm leading-6 text-white/60">{row.errorMessage || "No row-level errors"}</p>
                    {row.lastRunAt ? (
                      <p className="text-xs uppercase tracking-[0.16em] text-white/34">
                        {new Date(row.lastRunAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start justify-end">
                  <button className={theme.buttonDanger + " px-3 py-2"} onClick={() => void onDeleteRow(row.id)} type="button">
                    Del
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/8 px-4 py-4">
        <button className={theme.buttonSecondary} disabled={board.rows.length >= 8} onClick={() => void onAddRow()} type="button">
          + Add Row
        </button>
      </div>
    </section>
  );
}