import { useEffect, useState } from "react";

import { cx } from "../../lib/cx";
import type { GeneratedAsset } from "../../types";
import { theme, workerModelLabels } from "../../styles/theme";

interface GalleryMasonryProps {
  assets: GeneratedAsset[];
  selectedIds: string[];
  selectedVisibleCount?: number;
  headerLabel?: string;
  headerDescription?: string;
  activeSafetySection: "SFW" | "NSFW";
  activeImageFilterId: string;
  imageFilterOptions: Array<{ id: string; label: string; count: number }>;
  safetySectionCounts: Record<"SFW" | "NSFW", number>;
  showImageFilters: boolean;
  showSafetyControls: boolean;
  onSelectImageFilter: (filterId: string) => void;
  onSelectSafetySection: (section: "SFW" | "NSFW") => void;
  onToggle: (assetId: string) => void;
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

export function GalleryMasonry({
  assets,
  selectedIds,
  selectedVisibleCount,
  headerLabel,
  headerDescription,
  activeSafetySection,
  activeImageFilterId,
  imageFilterOptions,
  safetySectionCounts,
  showImageFilters,
  showSafetyControls,
  onSelectImageFilter,
  onSelectSafetySection,
  onToggle,
}: GalleryMasonryProps) {
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const previewAsset = previewAssetId ? assets.find((asset) => asset.id === previewAssetId) ?? null : null;
  const segmentContainerClass = "inline-flex rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-1";
  const segmentButtonClass = "inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition";
  const activeSegmentClass = "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)] shadow-[var(--shadow-soft)]";
  const inactiveSegmentClass = "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-main)]";

  function selectAdjacentPreviewAsset(direction: -1 | 1): void {
    setPreviewAssetId((currentId) => {
      if (!currentId || assets.length < 2) {
        return currentId;
      }

      const currentIndex = assets.findIndex((asset) => asset.id === currentId);
      if (currentIndex < 0) {
        return currentId;
      }

      const nextIndex = (currentIndex + direction + assets.length) % assets.length;
      return assets[nextIndex]?.id ?? currentId;
    });
  }

  useEffect(() => {
    if (!previewAssetId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewAssetId(null);
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      selectAdjacentPreviewAsset(event.key === "ArrowRight" ? 1 : -1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [assets, previewAssetId]);

  return (
    <div className="space-y-5">
      <div className={cx(theme.cardStrong, "flex flex-wrap items-center justify-between gap-4 px-5 py-4") + " glass-panel"}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-white/42">Visual gallery</p>
            {showSafetyControls ? (
              <div className={segmentContainerClass}>
                {(["SFW", "NSFW"] as const).map((section) => {
                  const active = activeSafetySection === section;

                  return (
                    <button
                      className={cx(segmentButtonClass, "min-w-16", active ? activeSegmentClass : inactiveSegmentClass)}
                      key={section}
                      onClick={() => onSelectSafetySection(section)}
                      type="button"
                    >
                      <span>{section}</span>
                      <span className={cx("text-[10px]", active ? "text-[color:var(--accent-foreground)] opacity-[0.65]" : "opacity-70")}>{safetySectionCounts[section]}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showImageFilters ? (
              <div className={segmentContainerClass}>
                {imageFilterOptions.map((filter) => {
                  const active = activeImageFilterId === filter.id;

                  return (
                    <button
                      className={cx(segmentButtonClass, active ? activeSegmentClass : inactiveSegmentClass)}
                      key={filter.id}
                      onClick={() => onSelectImageFilter(filter.id)}
                      type="button"
                    >
                      <span>{filter.label}</span>
                      <span className={cx("text-[10px]", active ? "text-[color:var(--accent-foreground)] opacity-[0.65]" : "opacity-70")}>{filter.count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <h2 className="font-display mt-2 text-2xl text-white">{headerLabel || "Tiled model output"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/54">{headerDescription || "Browse generated outputs for this model."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/54">
            {assets.length} assets
          </span>
          <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-lime-100">
            {(selectedVisibleCount ?? selectedIds.length)} selected
          </span>
        </div>
      </div>

      <div className="masonry-columns">
        {assets.map((asset) => {
          const isSelected = selectedIds.includes(asset.id);
          return (
            <article
              key={asset.id}
              className={cx(
                "group mb-4 inline-block w-full overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(14,17,22,0.9)] text-left transition",
                isSelected && "border-lime-300/30 shadow-[0_0_0_1px_rgba(199,255,39,0.2)]",
              )}
            >
              <div className="relative">
                <button
                  aria-label={`View ${asset.fileName}`}
                  className="group/preview relative block w-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
                  onClick={() => setPreviewAssetId(asset.id)}
                  type="button"
                >
                  <img alt={asset.fileName} className="w-full object-cover transition duration-300 hover:scale-[1.015]" src={asset.url} />
                  <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover/preview:bg-black/22 group-hover/preview:opacity-100">
                    <span className="inline-flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/34 text-white shadow-[0_8px_22px_rgba(0,0,0,0.32)] backdrop-blur-[3px]">
                      <ExpandIcon />
                    </span>
                  </span>
                </button>
                <div className="absolute left-4 top-4 z-20 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/72">
                  {workerModelLabels[asset.generationModel] || asset.generationModel.replaceAll("_", " ")}
                </div>
                <button
                  className={cx(
                    "absolute right-4 top-4 z-20 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition",
                    isSelected
                      ? "border-lime-300/35 bg-lime-300/18 text-lime-50 hover:bg-lime-300/24"
                      : "border-white/10 bg-black/50 text-white/72 hover:bg-black/68 hover:text-white",
                  )}
                  onClick={() => onToggle(asset.id)}
                  type="button"
                >
                  {isSelected ? "Selected" : "Select"}
                </button>
              </div>
              <button className="block w-full space-y-3 p-4 text-left" onClick={() => onToggle(asset.id)} type="button">
                <div className="flex items-center justify-between gap-4">
                  <p className="truncate text-sm font-semibold text-white">{asset.fileName}</p>
                  <span className="text-xs uppercase tracking-[0.16em] text-white/40">{asset.quantity}x</span>
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-white/58">{asset.promptSnapshot}</p>
                {asset.failureLabel ? (
                  <span className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    {asset.failureLabel}
                  </span>
                ) : null}
              </button>
            </article>
          );
        })}
      </div>

      {previewAsset ? (
        <div
          aria-label="Gallery image preview"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[#050505]/92 p-3 backdrop-blur-xl sm:p-4"
          onClick={() => setPreviewAssetId(null)}
          role="dialog"
        >
          <div
            className="relative flex h-[min(96vh,940px)] w-[min(98vw,1240px)] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#090909] shadow-[0_34px_120px_rgba(0,0,0,0.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(199,255,39,0.08),transparent_34%),radial-gradient(circle_at_18%_88%,rgba(255,255,255,0.05),transparent_32%)]" />
            <div className="relative z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-black/36 px-4 py-3 backdrop-blur-xl">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                  {workerModelLabels[previewAsset.generationModel] || previewAsset.generationModel.replaceAll("_", " ")}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{previewAsset.fileName}</p>
              </div>
              <button
                aria-label="Close gallery image preview"
                className="inline-grid size-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/68 transition hover:bg-white/[0.1] hover:text-white"
                onClick={() => setPreviewAssetId(null)}
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
            <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/18 p-4 sm:p-7">
              {assets.length > 1 ? (
                <>
                  <button
                    aria-label="Previous gallery image"
                    className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/38 text-white/72 shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:grid"
                    onClick={() => selectAdjacentPreviewAsset(-1)}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                      <path d="M12.7 4.3a.75.75 0 0 1 0 1.06L8.06 10l4.64 4.64a.75.75 0 1 1-1.06 1.06l-5.17-5.17a.75.75 0 0 1 0-1.06l5.17-5.17a.75.75 0 0 1 1.06 0Z" fill="currentColor" />
                    </svg>
                  </button>
                  <button
                    aria-label="Next gallery image"
                    className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/38 text-white/72 shadow-[0_12px_30px_rgba(0,0,0,0.38)] backdrop-blur-md transition hover:bg-white/10 hover:text-white sm:grid"
                    onClick={() => selectAdjacentPreviewAsset(1)}
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                      <path d="M7.3 4.3a.75.75 0 0 1 1.06 0l5.17 5.17a.75.75 0 0 1 0 1.06L8.36 15.7a.75.75 0 1 1-1.06-1.06L11.94 10 7.3 5.36a.75.75 0 0 1 0-1.06Z" fill="currentColor" />
                    </svg>
                  </button>
                </>
              ) : null}
              <img
                alt={previewAsset.fileName}
                className="max-h-full max-w-full rounded-2xl border border-white/10 bg-black/20 object-contain shadow-[0_24px_90px_rgba(0,0,0,0.52)]"
                src={previewAsset.url}
              />
            </div>
            {assets.length > 1 ? (
              <div className="relative z-20 border-t border-white/10 bg-black/42 px-3 py-3 backdrop-blur-xl">
                <div className="mx-auto flex max-w-full justify-center">
                  <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.045] p-2 shadow-[0_16px_50px_rgba(0,0,0,0.34)]">
                    {assets.map((asset, index) => {
                      const active = asset.id === previewAsset.id;

                      return (
                        <button
                          key={asset.id}
                          aria-label={`View ${asset.fileName}`}
                          className={cx(
                            "relative h-16 w-16 flex-none overflow-hidden rounded-xl border bg-[#181818] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70",
                            active ? "scale-[1.04] border-lime-300/70 opacity-100 shadow-[0_0_0_1px_rgba(199,255,39,0.35),0_12px_28px_rgba(0,0,0,0.36)]" : "border-white/10 opacity-64 hover:border-white/24 hover:opacity-100",
                          )}
                          onClick={() => setPreviewAssetId(asset.id)}
                          type="button"
                        >
                          <img alt="" className="h-full w-full object-cover" src={asset.url} />
                          <span className="absolute left-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/62 px-1 text-[10px] font-bold text-white/86">
                            {index + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
