import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { cx } from "../../lib/cx";
import {
  buildFolderCounts,
  buildGalleryFolderGroups,
  defaultGalleryFolderId,
  findFolder,
  matchesImageAsset,
  matchesVideoAsset,
  matchesVoiceAsset,
  readStoredCustomFolderGroups,
  readStoredCustomFolders,
  videoFolderId,
  voiceFolderId,
} from "../../lib/galleryFolders";
import type { GeneratedAsset } from "../../types";
import { theme } from "../../styles/theme";

interface ImagePickerModalProps {
  open: boolean;
  slug: string;
  assets: GeneratedAsset[];
  variant?: "image" | "video" | "audio";
  onClose: () => void;
  onSelect: (asset: GeneratedAsset) => void;
}

export function ImagePickerModal({ open, slug, assets, variant = "image", onClose, onSelect }: ImagePickerModalProps) {
  const [query, setQuery] = useState("");
  const defaultFolderId = variant === "audio" ? voiceFolderId : variant === "video" ? videoFolderId : defaultGalleryFolderId;
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId);
  const [customFolderGroups, setCustomFolderGroups] = useState(() => readStoredCustomFolderGroups(slug));
  const [customFolders, setCustomFolders] = useState(() => readStoredCustomFolders(slug));
  const deferredQuery = useDeferredValue(query);
  const allFolderGroups = useMemo(() => buildGalleryFolderGroups(customFolders, customFolderGroups), [customFolderGroups, customFolders]);
  const folderGroups = useMemo(() => {
    const allowedMediaFolderId = variant === "audio" ? voiceFolderId : variant === "video" ? videoFolderId : defaultGalleryFolderId;

    return allFolderGroups.flatMap((group) => {
      if (group.id === "media-folders") {
        const items = group.items.filter((item) => item.id === allowedMediaFolderId);

        return items.length ? [{ ...group, items }] : [];
      }

      return variant === "image" ? [group] : [];
    });
  }, [allFolderGroups, variant]);
  const selectedFolder = useMemo(
    () => findFolder(selectedFolderId, folderGroups) ?? findFolder(defaultFolderId, folderGroups),
    [defaultFolderId, folderGroups, selectedFolderId],
  );
  const selectableAssets = useMemo(
    () => {
      if (variant === "audio") {
        return assets.filter(matchesVoiceAsset);
      }
      if (variant === "video") {
        return assets.filter(matchesVideoAsset);
      }
      return assets.filter(matchesImageAsset);
    },
    [assets, variant],
  );
  const folderCounts = useMemo(() => buildFolderCounts(selectableAssets, folderGroups), [selectableAssets, folderGroups]);
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
    setQuery("");
  }, [defaultFolderId, open, slug]);

  if (!open) {
    return null;
  }

  const search = deferredQuery.trim().toLowerCase();
  const folderAssets = selectedFolder ? selectableAssets.filter(selectedFolder.matcher) : selectableAssets;
  const filteredAssets = folderAssets.filter((asset) => {
    if (!search) {
      return true;
    }
    return `${asset.fileName} ${asset.promptSnapshot}`.toLowerCase().includes(search);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md">
      <div className={cx(theme.cardStrong, "flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden p-5") + " glass-panel"}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/42">{copy.eyebrow}</p>
            <h3 className="font-display mt-2 text-2xl text-white">{copy.title}</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              className={theme.input + " min-w-[260px]"}
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className={theme.buttonSecondary} onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="mt-5 grid flex-1 gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/8 bg-white/[0.02] p-3 sm:col-span-2 xl:col-span-1">
            {folderGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">{group.label}</p>
                {group.items.length > 0 ? (
                  group.items.map((item) => {
                    const active = item.id === selectedFolder?.id;

                    return (
                      <button
                        key={item.id}
                        className={cx(
                          "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                          active
                            ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                            : "border-white/8 bg-[#262626] text-white/70 hover:bg-[#2e2e2e]",
                        )}
                        onClick={() => setSelectedFolderId(item.id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-white">{item.label}</span>
                          <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white/54">
                            {folderCounts.get(item.id) ?? 0}
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

          <div className="grid min-h-0 gap-4 overflow-y-auto sm:col-span-2 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
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
  );
}
