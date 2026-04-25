import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@apollo/client/react";

import { GalleryMasonry } from "../components/gallery/GalleryMasonry";
import { InfluencerAvatar } from "../components/model/InfluencerAvatar";
import {
  buildFolderCounts,
  buildGalleryFolderGroups,
  createCustomFolderId,
  customFolderGroupId,
  findFolder,
  readStoredCustomFolders,
  resolveGalleryFolderStorageKey,
  resolveInitialExpandedGroupIds,
} from "../lib/galleryFolders";
import { INFLUENCER_MODEL_QUERY, MODEL_ASSETS_QUERY } from "../queries/model";
import { theme } from "../styles/theme";
import type { GeneratedAsset, InfluencerModel } from "../types";
import type { StoredCustomGalleryFolder } from "../lib/galleryFolders";

interface ModelGalleryPageProps {
  slug: string;
}

export function ModelGalleryPage({ slug }: ModelGalleryPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("all-outputs");
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(() => resolveInitialExpandedGroupIds(slug));
  const [customFolders, setCustomFolders] = useState<StoredCustomGalleryFolder[]>(() => readStoredCustomFolders(slug));
  const [pendingCustomFolderName, setPendingCustomFolderName] = useState("");
  const [customFolderFeedback, setCustomFolderFeedback] = useState<string | null>(null);
  const customFoldersLoadedForSlugRef = useRef(slug);
  const { data: modelData, loading: modelLoading } = useQuery<{ influencerModel: InfluencerModel | null }>(INFLUENCER_MODEL_QUERY, {
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });

  const model = modelData?.influencerModel ?? null;

  const { data: assetsData } = useQuery<{ modelAssets: GeneratedAsset[] }>(MODEL_ASSETS_QUERY, {
    skip: !model?.id,
    variables: { influencerModelId: model?.id || "", limit: 180 },
    fetchPolicy: "cache-and-network",
  });

  const assets = useMemo(() => assetsData?.modelAssets ?? [], [assetsData]);
  const availableAssetIds = useMemo(() => new Set(assets.map((asset) => asset.id)), [assets]);
  const folderGroups = useMemo(() => buildGalleryFolderGroups(customFolders), [customFolders]);
  const folderCounts = useMemo(() => buildFolderCounts(assets, folderGroups), [assets, folderGroups]);
  const selectedFolder = useMemo(
    () => findFolder(selectedFolderId, folderGroups) ?? findFolder("all-outputs", folderGroups),
    [folderGroups, selectedFolderId],
  );
  const filteredAssets = useMemo(() => (selectedFolder ? assets.filter(selectedFolder.matcher) : assets), [assets, selectedFolder]);
  const trimmedCustomFolderName = pendingCustomFolderName.trim();

  const selectedCount = useMemo(
    () => selectedIds.filter((id) => filteredAssets.some((asset) => asset.id === id)).length,
    [filteredAssets, selectedIds],
  );

  useEffect(() => {
    const nextCustomFolders = readStoredCustomFolders(slug);
    customFoldersLoadedForSlugRef.current = slug;
    setCustomFolders(nextCustomFolders);
    setSelectedIds([]);
    setSelectedFolderId("all-outputs");
    setExpandedGroupIds(resolveInitialExpandedGroupIds(slug));
    setPendingCustomFolderName("");
    setCustomFolderFeedback(null);
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined" || customFoldersLoadedForSlugRef.current !== slug) {
      return;
    }

    window.localStorage.setItem(resolveGalleryFolderStorageKey(slug), JSON.stringify(customFolders));
  }, [customFolders, slug]);

  function handleCreateCustomFolder() {
    if (!trimmedCustomFolderName) {
      setCustomFolderFeedback("Enter a folder name first.");
      return;
    }

    const duplicateFolder = customFolders.some(
      (folder) => folder.label.trim().toLocaleLowerCase() === trimmedCustomFolderName.toLocaleLowerCase(),
    );

    if (duplicateFolder) {
      setCustomFolderFeedback("A custom folder with that name already exists.");
      return;
    }

    const nextFolder: StoredCustomGalleryFolder = {
      id: createCustomFolderId(),
      label: trimmedCustomFolderName,
      assetIds: Array.from(new Set(selectedIds.filter((assetId) => availableAssetIds.has(assetId)))),
      createdAt: new Date().toISOString(),
    };

    setCustomFolders((current) => [nextFolder, ...current]);
    setExpandedGroupIds((current) => (current.includes(customFolderGroupId) ? current : [...current, customFolderGroupId]));
    setSelectedFolderId(nextFolder.id);
    setPendingCustomFolderName("");
    setCustomFolderFeedback(
      nextFolder.assetIds.length > 0
        ? `Created ${nextFolder.label} with ${nextFolder.assetIds.length} saved image${nextFolder.assetIds.length === 1 ? "" : "s"}.`
        : `Created empty folder ${nextFolder.label}.`,
    );
  }

  if (modelLoading && !model) {
    return <div className="h-[60vh] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />;
  }

  if (!model) {
    return <div className={theme.cardStrong + " glass-panel p-10 text-white/58"}>This gallery is not available.</div>;
  }

  return (
    <div className="space-y-5">
      <section className={theme.cardStrong + " glass-panel p-6 sm:p-7"}>
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">Higgsfield-style gallery</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <InfluencerAvatar model={model} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-4xl text-white">{model.name} gallery</h1>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">{model.handle}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
                This visual surface is intentionally built to expand into masking, inpainting, multi-select workflows, and bulk actions later. The current implementation keeps selection state and tile-level metadata without blocking those future features.
              </p>
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/68">
            {assets.length} generated images
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={theme.cardStrong + " glass-panel overflow-hidden"}>
          <div className="border-b border-white/8 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/42">Folders</p>
            <h2 className="font-display mt-2 text-2xl text-white">Gallery rail</h2>
            <p className="mt-2 text-sm leading-6 text-white/54">Expand a group, then jump into a smart folder like face swaps or multi-image runs.</p>
          </div>

          <div className="space-y-3 px-4 py-4">
            {folderGroups.map((group) => {
              const expanded = expandedGroupIds.includes(group.id);
              return (
                <div key={group.id} className="rounded-2xl border border-white/8 bg-white/[0.02]">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() =>
                      setExpandedGroupIds((current) =>
                        current.includes(group.id) ? current.filter((entry) => entry !== group.id) : [...current, group.id],
                      )
                    }
                    type="button"
                  >
                    <span className="text-sm font-semibold text-white">{group.label}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-white/40">{expanded ? "Hide" : "Show"}</span>
                  </button>

                  {expanded ? (
                    <div className="space-y-2 border-t border-white/8 px-3 py-3">
                      {group.items.map((item) => {
                        const active = item.id === selectedFolderId;
                        return (
                          <button
                            key={item.id}
                            className={
                              "w-full rounded-xl border px-3 py-3 text-left transition " +
                              (active
                                ? "border-lime-300/20 bg-lime-300/10 text-lime-100"
                                : "border-white/8 bg-[#262626] text-white/72 hover:bg-[#2e2e2e]")
                            }
                            onClick={() => setSelectedFolderId(item.id)}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-white">{item.label}</span>
                              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/56">
                                {folderCounts.get(item.id) ?? 0}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-white/48">{item.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/8 px-4 py-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Custom folder</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    Name a new gallery folder. Any currently selected images will be saved into it automatically.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/56">
                  {selectedIds.length} selected
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <input
                  className={theme.input}
                  maxLength={48}
                  onChange={(event) => setPendingCustomFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateCustomFolder();
                    }
                  }}
                  placeholder="Type a custom folder name"
                  value={pendingCustomFolderName}
                />
                <button
                  className={theme.buttonPrimary + " w-full"}
                  disabled={!trimmedCustomFolderName}
                  onClick={handleCreateCustomFolder}
                  type="button"
                >
                  Create folder
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/48">
                {customFolderFeedback || "You can create an empty folder now, or save the images you already selected into it."}
              </p>
            </div>
          </div>
        </aside>

        <GalleryMasonry
          assets={filteredAssets}
          headerLabel={selectedFolder?.label ?? "All Outputs"}
          headerDescription={selectedFolder?.description ?? "Every generated asset in this model gallery."}
          onToggle={(assetId) =>
            setSelectedIds((current) => (current.includes(assetId) ? current.filter((entry) => entry !== assetId) : [...current, assetId]))
          }
          selectedIds={selectedIds}
          selectedVisibleCount={selectedCount}
        />
      </section>
    </div>
  );
}
