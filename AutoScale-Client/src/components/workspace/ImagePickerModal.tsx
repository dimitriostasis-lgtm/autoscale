import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { cx } from "../../lib/cx";
import {
  buildFolderCounts,
  buildGalleryFolderGroups,
  allMediaFolderId,
  defaultGalleryFolderId,
  faceSwapFolderId,
  findFolder,
  inpaintFolderId,
  matchesVideoAsset,
  matchesVoiceAsset,
  multiPoseFolderId,
  readStoredCustomFolderGroups,
  readStoredCustomFolders,
  videoFolderId,
  voiceFolderId,
} from "../../lib/galleryFolders";
import type { GalleryFolderItem } from "../../lib/galleryFolders";
import type { GeneratedAsset, WorkspaceBoard } from "../../types";
import { theme } from "../../styles/theme";

type PickerVariant = "image" | "video" | "audio";
type PickerMediaKind = "image" | "video" | "voice";
type GallerySafetySection = "SFW" | "NSFW";
type GalleryImageFilterId = "all-images" | typeof faceSwapFolderId | typeof inpaintFolderId | typeof multiPoseFolderId;

interface GalleryAssetMode {
  kind: PickerMediaKind;
  safety: GallerySafetySection;
}

interface GalleryAssetRowSignals {
  faceSwap: boolean;
  poseMultiplier: number;
}

const galleryFolderMediaKindById: Record<string, PickerMediaKind> = {
  [defaultGalleryFolderId]: "image",
  [videoFolderId]: "video",
  [voiceFolderId]: "voice",
};
const allImagesFilterId = "all-images";
const imageFilterMetadata: Array<{ id: GalleryImageFilterId; label: string; description: string }> = [
  { id: allImagesFilterId, label: "All", description: "All generated image outputs in this safety section." },
  { id: faceSwapFolderId, label: "Face Swap", description: "Generated image outputs from face-swap rows or metadata." },
  { id: inpaintFolderId, label: "Inpaint", description: "Generated image outputs from inpaint or masking workflows." },
  { id: multiPoseFolderId, label: "Multi Pose", description: "Pose-multiplied generated image outputs." },
];
const galleryBoardPrefixes: Array<{ prefix: string; mode: GalleryAssetMode }> = [
  { prefix: "__autoscale_workspace_nsfw__:", mode: { kind: "image", safety: "NSFW" } },
  { prefix: "__autoscale_workspace_video_sfw__:", mode: { kind: "video", safety: "SFW" } },
  { prefix: "__autoscale_workspace_video_nsfw__:", mode: { kind: "video", safety: "NSFW" } },
  { prefix: "__autoscale_workspace_voice_sfw__:", mode: { kind: "voice", safety: "SFW" } },
  { prefix: "__autoscale_workspace_voice_nsfw__:", mode: { kind: "voice", safety: "NSFW" } },
];
const faceSwapAssetPattern = /face\s*swap|faceswap|swap/i;
const inpaintAssetPattern = /inpaint|inpainting/i;

function resolveBoardGalleryMode(boardName: string): GalleryAssetMode {
  const prefixedMode = galleryBoardPrefixes.find((entry) => boardName.startsWith(entry.prefix));

  return prefixedMode?.mode ?? { kind: "image", safety: "SFW" };
}

function targetMediaKindForVariant(variant: PickerVariant): PickerMediaKind {
  return variant === "audio" ? "voice" : variant;
}

function resolveAssetGalleryMode(asset: GeneratedAsset, assetModesByBoardId: Map<string, GalleryAssetMode>): GalleryAssetMode {
  const boardMode = assetModesByBoardId.get(asset.boardId);

  if (boardMode && boardMode.kind !== "image") {
    return boardMode;
  }

  if (matchesVideoAsset(asset)) {
    return { kind: "video", safety: boardMode?.safety ?? "SFW" };
  }

  if (matchesVoiceAsset(asset)) {
    return { kind: "voice", safety: boardMode?.safety ?? "SFW" };
  }

  return boardMode ?? { kind: "image", safety: "SFW" };
}

function buildAssetSearchText(asset: GeneratedAsset): string {
  return `${asset.fileName} ${asset.promptSnapshot}`;
}

function matchesSpecialImageFilter(
  asset: GeneratedAsset,
  folderId: GalleryImageFilterId,
  assetModesByBoardId: Map<string, GalleryAssetMode>,
  assetRowSignalsById: Map<string, GalleryAssetRowSignals>,
): boolean {
  if (folderId === allImagesFilterId) {
    return true;
  }

  if (resolveAssetGalleryMode(asset, assetModesByBoardId).kind !== "image") {
    return false;
  }

  const rowSignals = assetRowSignalsById.get(asset.id);

  if (folderId === faceSwapFolderId) {
    return Boolean(rowSignals?.faceSwap) || faceSwapAssetPattern.test(buildAssetSearchText(asset));
  }

  if (folderId === inpaintFolderId) {
    return inpaintAssetPattern.test(buildAssetSearchText(asset));
  }

  if (folderId === multiPoseFolderId) {
    return (rowSignals?.poseMultiplier ?? 1) > 1 || asset.quantity > 1;
  }

  return false;
}

function allowedMediaFolderForVariant(variant: PickerVariant): string {
  if (variant === "audio") {
    return voiceFolderId;
  }
  if (variant === "video") {
    return videoFolderId;
  }
  return defaultGalleryFolderId;
}

function canSelectFolderForVariant(item: GalleryFolderItem, variant: PickerVariant): boolean {
  if (item.source === "custom") {
    return variant === "image";
  }

  return item.id === allowedMediaFolderForVariant(variant);
}

function lockedFolderTitle(variant: PickerVariant): string {
  if (variant === "audio") {
    return "Only Voice Notes can be selected for audio references.";
  }
  if (variant === "video") {
    return "Only Videos can be selected for video references.";
  }
  return "Only Images can be selected for image references.";
}

interface ImagePickerModalProps {
  open: boolean;
  slug: string;
  assets: GeneratedAsset[];
  boards?: WorkspaceBoard[];
  variant?: PickerVariant;
  onClose: () => void;
  onSelect: (asset: GeneratedAsset) => void;
}

export function ImagePickerModal({ open, slug, assets, boards = [], variant = "image", onClose, onSelect }: ImagePickerModalProps) {
  const [query, setQuery] = useState("");
  const [selectedSafetySection, setSelectedSafetySection] = useState<GallerySafetySection>("SFW");
  const [selectedImageFilterId, setSelectedImageFilterId] = useState<GalleryImageFilterId>(allImagesFilterId);
  const defaultFolderId = allowedMediaFolderForVariant(variant);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId);
  const [customFolderGroups, setCustomFolderGroups] = useState(() => readStoredCustomFolderGroups(slug));
  const [customFolders, setCustomFolders] = useState(() => readStoredCustomFolders(slug));
  const deferredQuery = useDeferredValue(query);
  const folderGroups = useMemo(() => buildGalleryFolderGroups(customFolders, customFolderGroups), [customFolderGroups, customFolders]);
  const assetModesByBoardId = useMemo(() => new Map(boards.map((board) => [board.id, resolveBoardGalleryMode(board.name)] as const)), [boards]);
  const assetRowSignalsById = useMemo(() => {
    const entries = boards.flatMap((board) =>
      board.rows.flatMap((row) =>
        row.outputAssets.map((asset) => [asset.id, { faceSwap: row.faceSwap, poseMultiplier: row.poseMultiplier }] as const),
      ),
    );

    return new Map(entries);
  }, [boards]);
  const selectedFolder = useMemo(
    () => {
      const candidate = findFolder(selectedFolderId, folderGroups);

      return candidate && canSelectFolderForVariant(candidate, variant) ? candidate : findFolder(defaultFolderId, folderGroups);
    },
    [defaultFolderId, folderGroups, selectedFolderId, variant],
  );
  const selectableAssets = useMemo(
    () => assets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).kind === targetMediaKindForVariant(variant)),
    [assetModesByBoardId, assets, variant],
  );
  const folderCounts = useMemo(() => {
    const counts = buildFolderCounts(assets, folderGroups);

    counts.set(allMediaFolderId, assets.length);
    for (const [folderId, mediaKind] of Object.entries(galleryFolderMediaKindById)) {
      counts.set(folderId, assets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).kind === mediaKind).length);
    }

    return counts;
  }, [assetModesByBoardId, assets, folderGroups]);
  const copy =
    variant === "audio"
      ? {
          eyebrow: "Audio Reference Gallery",
          title: "Select an existing audio reference",
          searchPlaceholder: "Search audio filenames or prompts",
          emptyMessage: "No audio references match this folder or search yet.",
        }
      : variant === "video"
        ? {
            eyebrow: "Video Reference Gallery",
            title: "Select an existing video reference",
            searchPlaceholder: "Search video filenames or prompts",
            emptyMessage: "No video references match this folder or search yet.",
          }
      : {
          eyebrow: "Reference Gallery",
          title: "Select an existing generated image",
          searchPlaceholder: "Search prompts or filenames",
          emptyMessage: "No generated images match this folder or search yet.",
        };

  useEffect(() => {
    if (!open) {
      return;
    }

    setCustomFolderGroups(readStoredCustomFolderGroups(slug));
    setCustomFolders(readStoredCustomFolders(slug));
    setSelectedFolderId(defaultFolderId);
    setSelectedSafetySection("SFW");
    setSelectedImageFilterId(allImagesFilterId);
    setQuery("");
  }, [defaultFolderId, open, slug]);

  if (!open) {
    return null;
  }

  const search = deferredQuery.trim().toLowerCase();
  const selectedFolderIsMediaRoot = selectedFolder?.id === allowedMediaFolderForVariant(variant);
  const folderAssets = selectedFolderIsMediaRoot ? selectableAssets : selectedFolder ? selectableAssets.filter(selectedFolder.matcher) : selectableAssets;
  const showSafetyControls = selectedFolderIsMediaRoot && variant !== "audio";
  const showImageFilters = selectedFolderIsMediaRoot && variant === "image";
  const safetySectionCounts: Record<GallerySafetySection, number> = {
    SFW: folderAssets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).safety === "SFW").length,
    NSFW: folderAssets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).safety === "NSFW").length,
  };
  const safetyFilteredAssets = showSafetyControls
    ? folderAssets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).safety === selectedSafetySection)
    : folderAssets;
  const imageFilterOptions = imageFilterMetadata.map((filter) => ({
    id: filter.id,
    label: filter.label,
    count:
      filter.id === allImagesFilterId
        ? safetyFilteredAssets.length
        : safetyFilteredAssets.filter((asset) => matchesSpecialImageFilter(asset, filter.id, assetModesByBoardId, assetRowSignalsById)).length,
  }));
  const imageFilteredAssets =
    showImageFilters && selectedImageFilterId !== allImagesFilterId
      ? safetyFilteredAssets.filter((asset) => matchesSpecialImageFilter(asset, selectedImageFilterId, assetModesByBoardId, assetRowSignalsById))
      : safetyFilteredAssets;
  const activeImageFilter = imageFilterMetadata.find((filter) => filter.id === selectedImageFilterId) ?? imageFilterMetadata[0];
  const filteredAssets = imageFilteredAssets.filter((asset) => {
    if (!search) {
      return true;
    }
    return `${asset.fileName} ${asset.promptSnapshot}`.toLowerCase().includes(search);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-2 py-3 backdrop-blur-md sm:px-4 sm:py-6">
      <div className={cx(theme.cardStrong, "flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden p-3 sm:max-h-[90vh] sm:p-5") + " glass-panel"}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.24em] text-white/42">{copy.eyebrow}</p>
            <h3 className="font-display mt-2 text-2xl text-white">{copy.title}</h3>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <input
              className={theme.input + " w-full min-w-0 sm:min-w-[260px]"}
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className={theme.buttonSecondary} onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 grid flex-1 gap-4 overflow-y-auto sm:mt-5 sm:grid-cols-2 xl:grid-cols-4">
          <aside className="flex max-h-[34dvh] min-h-[12rem] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/8 bg-white/[0.02] p-3 sm:col-span-2 sm:max-h-none sm:min-h-0 xl:col-span-1">
            {folderGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38 sm:text-[10px]">{group.label}</p>
                {group.items.length > 0 ? (
                  group.items.map((item) => {
                    const active = item.id === selectedFolder?.id;
                    const locked = !canSelectFolderForVariant(item, variant);

                    return (
                      <button
                        key={item.id}
                        aria-disabled={locked}
                        className={cx(
                          "min-h-14 w-full rounded-xl border px-3.5 py-3 text-left transition-colors sm:min-h-0 sm:px-3 sm:py-2.5",
                          active
                            ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                            : locked
                              ? "cursor-not-allowed border-white/8 bg-[#202020] text-white/34 opacity-70"
                              : "border-white/8 bg-[#262626] text-white/70 hover:bg-[#2e2e2e]",
                        )}
                        onClick={() => {
                          if (!locked) {
                            setSelectedFolderId(item.id);
                          }
                        }}
                        title={locked ? lockedFolderTitle(variant) : undefined}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={cx("truncate text-base font-semibold sm:text-sm", locked ? "text-white/42" : "text-white")}>{item.label}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className={cx("rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold sm:px-2 sm:py-0.5 sm:text-[10px]", locked ? "text-white/34" : "text-white/54")}>
                              {folderCounts.get(item.id) ?? 0}
                            </span>
                            {locked ? (
                              <span className="grid size-5 place-items-center rounded-full border border-white/10 bg-black/20 text-white/34" aria-hidden="true">
                                <svg className="size-3" viewBox="0 0 20 20">
                                  <path
                                    d="M5.5 8.5V7A4.5 4.5 0 0 1 14.5 7v1.5h.25A1.75 1.75 0 0 1 16.5 10.25v5A1.75 1.75 0 0 1 14.75 17h-9.5A1.75 1.75 0 0 1 3.5 15.25v-5A1.75 1.75 0 0 1 5.25 8.5h.25ZM7 8.5h6V7a3 3 0 1 0-6 0v1.5Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-3 text-xs leading-5 text-white/44">
                    No folders in this group yet.
                  </div>
                )}
              </div>
            ))}
          </aside>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto sm:col-span-2 xl:col-span-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 sm:px-4">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">{selectedFolder?.label ?? "Gallery"}</p>
                  <p className="mt-1 text-sm leading-5 text-white/58">
                    {showImageFilters ? activeImageFilter.description : selectedFolder?.description ?? copy.title}
                  </p>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
                  {showSafetyControls ? (
                    <div className="grid w-full grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 sm:inline-flex sm:w-auto sm:rounded-full">
                      {(["SFW", "NSFW"] as const).map((section) => {
                        const active = selectedSafetySection === section;

                        return (
                          <button
                            className={cx(
                              "inline-flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition sm:h-7 sm:min-w-16 sm:rounded-full",
                              active ? "bg-lime-300 text-black shadow-[0_10px_24px_rgba(0,0,0,0.22)]" : "text-white/52 hover:bg-white/[0.06] hover:text-white/82",
                            )}
                            key={section}
                            onClick={() => setSelectedSafetySection(section)}
                            type="button"
                          >
                            <span>{section}</span>
                            <span className={cx("text-[10px]", active ? "text-black/60" : "text-white/44")}>{safetySectionCounts[section]}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {showImageFilters ? (
                    <div className="flex w-full min-w-0 overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-1 sm:w-auto sm:max-w-full sm:rounded-full">
                      {imageFilterOptions.map((filter) => {
                        const active = selectedImageFilterId === filter.id;

                        return (
                          <button
                            className={cx(
                              "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition sm:h-7 sm:rounded-full",
                              active ? "bg-lime-300 text-black shadow-[0_10px_24px_rgba(0,0,0,0.22)]" : "text-white/52 hover:bg-white/[0.06] hover:text-white/82",
                            )}
                            key={filter.id}
                            onClick={() => setSelectedImageFilterId(filter.id)}
                            type="button"
                          >
                            <span>{filter.label}</span>
                            <span className={cx("text-[10px]", active ? "text-black/60" : "text-white/44")}>{filter.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => (
              <button
                key={asset.id}
                className="group flex flex-col overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] text-left transition hover:border-lime-300/25 hover:bg-white/[0.05]"
                onClick={() => onSelect(asset)}
                type="button"
              >
                {variant === "audio" ? (
                  <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 bg-black/30 px-5 text-center">
                    <span className="inline-flex size-16 items-center justify-center rounded-2xl border border-lime-300/16 bg-lime-300/10 text-lime-100 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
                      <svg aria-hidden="true" className="size-8" viewBox="0 0 24 24">
                        <path
                          d="M4 14.5v-5m4 8v-11m4 14v-17m4 14v-11m4 8v-5"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeWidth="2"
                        />
                      </svg>
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
                      Audio reference
                    </span>
                  </div>
                ) : variant === "video" ? (
                  <div className="relative aspect-[3/4] overflow-hidden bg-black/30">
                    <video className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" muted playsInline preload="metadata" src={asset.url} />
                    <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur-md">
                      Video reference
                    </span>
                  </div>
                ) : (
                  <div className="aspect-[3/4] overflow-hidden bg-black/30">
                    <img alt={asset.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={asset.url} />
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-white">{asset.fileName}</p>
                  <p className="line-clamp-3 text-xs leading-6 text-white/58">{asset.promptSnapshot}</p>
                </div>
              </button>
            ))}
            {!filteredAssets.length ? (
              <div className="col-span-full flex items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/48">
                {copy.emptyMessage}
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
