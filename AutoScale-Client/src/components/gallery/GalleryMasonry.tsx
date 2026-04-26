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
  const segmentContainerClass = "inline-flex rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-1";
  const segmentButtonClass = "inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition";
  const activeSegmentClass = "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)] shadow-[var(--shadow-soft)]";
  const inactiveSegmentClass = "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-main)]";

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
            <button
              key={asset.id}
              className={cx(
                "group mb-4 inline-block w-full overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(14,17,22,0.9)] text-left transition",
                isSelected && "border-lime-300/30 shadow-[0_0_0_1px_rgba(199,255,39,0.2)]",
              )}
              onClick={() => onToggle(asset.id)}
              type="button"
            >
              <div className="relative">
                <img alt={asset.fileName} className="w-full object-cover transition duration-300 group-hover:scale-[1.015]" src={asset.url} />
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/72">
                  {workerModelLabels[asset.generationModel] || asset.generationModel.replaceAll("_", " ")}
                </div>
              </div>
              <div className="space-y-3 p-4">
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
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}