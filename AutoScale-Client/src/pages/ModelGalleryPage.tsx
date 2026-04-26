import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useQuery } from "@apollo/client/react";

import { GalleryMasonry } from "../components/gallery/GalleryMasonry";
import { InfluencerAvatar } from "../components/model/InfluencerAvatar";
import {
  buildFolderCounts,
  buildGalleryFolderGroups,
  createCustomFolderId,
  createCustomFolderGroupId,
  customFolderGroupId,
  defaultGalleryFolderId,
  faceSwapFolderId,
  findFolder,
  inpaintFolderId,
  multiPoseFolderId,
  readStoredCustomFolderGroups,
  readStoredCustomFolders,
  resolveGalleryFolderGroupStorageKey,
  resolveGalleryFolderStorageKey,
  resolveInitialExpandedGroupIds,
} from "../lib/galleryFolders";
import { INFLUENCER_MODEL_QUERY, MODEL_ASSETS_QUERY } from "../queries/model";
import { theme } from "../styles/theme";
import type { GeneratedAsset, InfluencerModel } from "../types";
import type { GalleryFolderSource, StoredCustomGalleryFolder, StoredCustomGalleryGroup } from "../lib/galleryFolders";

type GalleryMediaKind = "image" | "video" | "voice";
type GallerySafetySection = "SFW" | "NSFW";
type GalleryImageFilterId = "all-images" | typeof faceSwapFolderId | typeof inpaintFolderId | typeof multiPoseFolderId;
type RailActionKind = "group" | "folder";

interface RailActionTarget {
  kind: RailActionKind;
  id: string;
  label: string;
  source?: GalleryFolderSource;
}

interface RailActionMenu extends RailActionTarget {
  mode: "menu" | "confirm-delete" | "confirm-empty";
}

interface GalleryAssetMode {
  kind: GalleryMediaKind;
  safety: GallerySafetySection;
}

interface GalleryAssetRowSignals {
  faceSwap: boolean;
  poseMultiplier: number;
}

const galleryFolderMediaKindById: Record<string, GalleryMediaKind> = {
  [defaultGalleryFolderId]: "image",
  videos: "video",
  voices: "voice",
};
const allImagesFilterId = "all-images";
const imageFilterMetadata: Array<{ id: GalleryImageFilterId; label: string; headerLabel: string; description: string }> = [
  {
    id: allImagesFilterId,
    label: "All",
    headerLabel: "Images",
    description: "Generated image outputs for this model.",
  },
  {
    id: faceSwapFolderId,
    label: "Face Swap",
    headerLabel: "Face Swap",
    description: "Generated image outputs from face-swap rows or metadata.",
  },
  {
    id: inpaintFolderId,
    label: "Inpaint",
    headerLabel: "Inpaint",
    description: "Generated image outputs from inpaint or masking workflows.",
  },
  {
    id: multiPoseFolderId,
    label: "Multi Pose",
    headerLabel: "Multi Pose",
    description: "Pose-multiplied generated image outputs.",
  },
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

function resolveAssetGalleryMode(asset: GeneratedAsset, assetModesByBoardId: Map<string, GalleryAssetMode>): GalleryAssetMode {
  return assetModesByBoardId.get(asset.boardId) ?? { kind: "image", safety: "SFW" };
}

function buildAssetSearchText(asset: GeneratedAsset): string {
  return `${asset.fileName} ${asset.promptSnapshot}`;
}

function matchesSpecialImageFilter(
  asset: GeneratedAsset,
  folderId: string,
  assetModesByBoardId: Map<string, GalleryAssetMode>,
  assetRowSignalsById: Map<string, GalleryAssetRowSignals>,
): boolean {
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

interface ModelGalleryPageProps {
  slug: string;
}

export function ModelGalleryPage({ slug }: ModelGalleryPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultGalleryFolderId);
  const [selectedSafetySection, setSelectedSafetySection] = useState<GallerySafetySection>("SFW");
  const [selectedImageFilterId, setSelectedImageFilterId] = useState<GalleryImageFilterId>(allImagesFilterId);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(() => resolveInitialExpandedGroupIds(slug));
  const [customFolderGroups, setCustomFolderGroups] = useState<StoredCustomGalleryGroup[]>(() => readStoredCustomFolderGroups(slug));
  const [customFolders, setCustomFolders] = useState<StoredCustomGalleryFolder[]>(() => readStoredCustomFolders(slug));
  const [pendingCustomGroupName, setPendingCustomGroupName] = useState("");
  const [pendingFolderNamesByGroupId, setPendingFolderNamesByGroupId] = useState<Record<string, string>>({});
  const [customFolderFeedback, setCustomFolderFeedback] = useState<string | null>(null);
  const [railActionMenu, setRailActionMenu] = useState<RailActionMenu | null>(null);
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
  const folderGroups = useMemo(() => buildGalleryFolderGroups(customFolders, customFolderGroups), [customFolderGroups, customFolders]);
  const assetModesByBoardId = useMemo(() => {
    return new Map((model?.boards ?? []).map((board) => [board.id, resolveBoardGalleryMode(board.name)] as const));
  }, [model?.boards]);
  const assetRowSignalsById = useMemo(() => {
    const entries = (model?.boards ?? []).flatMap((board) =>
      board.rows.flatMap((row) =>
        row.outputAssets.map((asset) => [asset.id, { faceSwap: row.faceSwap, poseMultiplier: row.poseMultiplier }] as const),
      ),
    );

    return new Map(entries);
  }, [model?.boards]);
  const folderCounts = useMemo(() => {
    const counts = buildFolderCounts(assets, folderGroups);

    for (const [folderId, mediaKind] of Object.entries(galleryFolderMediaKindById)) {
      counts.set(folderId, assets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).kind === mediaKind).length);
    }

    return counts;
  }, [assets, assetModesByBoardId, folderGroups]);
  const selectedFolder = useMemo(
    () => findFolder(selectedFolderId, folderGroups) ?? findFolder(defaultGalleryFolderId, folderGroups),
    [folderGroups, selectedFolderId],
  );
  const selectedMediaKind = galleryFolderMediaKindById[selectedFolderId] ?? null;
  const folderAssets = useMemo(() => {
    const selectedMediaKind = galleryFolderMediaKindById[selectedFolderId];

    if (selectedMediaKind) {
      return assets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).kind === selectedMediaKind);
    }

    return selectedFolder ? assets.filter(selectedFolder.matcher) : assets;
  }, [assets, assetModesByBoardId, selectedFolder, selectedFolderId]);
  const showSafetyControls = selectedMediaKind !== "voice";
  const safetySectionCounts = useMemo(
    () => ({
      SFW: folderAssets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).safety === "SFW").length,
      NSFW: folderAssets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).safety === "NSFW").length,
    }),
    [assetModesByBoardId, folderAssets],
  );
  const safetyFilteredAssets = useMemo(
    () => (showSafetyControls ? folderAssets.filter((asset) => resolveAssetGalleryMode(asset, assetModesByBoardId).safety === selectedSafetySection) : folderAssets),
    [assetModesByBoardId, folderAssets, selectedSafetySection, showSafetyControls],
  );
  const imageFilterOptions = useMemo(
    () =>
      imageFilterMetadata.map((filter) => ({
        id: filter.id,
        label: filter.label,
        count:
          filter.id === allImagesFilterId
            ? safetyFilteredAssets.length
            : safetyFilteredAssets.filter((asset) => matchesSpecialImageFilter(asset, filter.id, assetModesByBoardId, assetRowSignalsById)).length,
      })),
    [assetModesByBoardId, assetRowSignalsById, safetyFilteredAssets],
  );
  const filteredAssets = useMemo(
    () =>
      selectedMediaKind === "image" && selectedImageFilterId !== allImagesFilterId
        ? safetyFilteredAssets.filter((asset) => matchesSpecialImageFilter(asset, selectedImageFilterId, assetModesByBoardId, assetRowSignalsById))
        : safetyFilteredAssets,
    [assetModesByBoardId, assetRowSignalsById, safetyFilteredAssets, selectedImageFilterId, selectedMediaKind],
  );
  const activeImageFilter = imageFilterMetadata.find((filter) => filter.id === selectedImageFilterId) ?? imageFilterMetadata[0];
  const galleryHeaderLabel = selectedMediaKind === "image" ? activeImageFilter.headerLabel : selectedFolder?.label ?? "Images";
  const galleryHeaderDescription = selectedMediaKind === "image" ? activeImageFilter.description : selectedFolder?.description ?? "Generated image outputs for this model.";
  const trimmedCustomGroupName = pendingCustomGroupName.trim();

  const selectedCount = useMemo(
    () => selectedIds.filter((id) => filteredAssets.some((asset) => asset.id === id)).length,
    [filteredAssets, selectedIds],
  );

  useEffect(() => {
    const nextCustomFolderGroups = readStoredCustomFolderGroups(slug);
    const nextCustomFolders = readStoredCustomFolders(slug);
    customFoldersLoadedForSlugRef.current = slug;
    setCustomFolderGroups(nextCustomFolderGroups);
    setCustomFolders(nextCustomFolders);
    setSelectedIds([]);
    setSelectedFolderId(defaultGalleryFolderId);
    setSelectedSafetySection("SFW");
    setSelectedImageFilterId(allImagesFilterId);
    setExpandedGroupIds(resolveInitialExpandedGroupIds(slug));
    setPendingCustomGroupName("");
    setPendingFolderNamesByGroupId({});
    setCustomFolderFeedback(null);
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined" || customFoldersLoadedForSlugRef.current !== slug) {
      return;
    }

    window.localStorage.setItem(resolveGalleryFolderStorageKey(slug), JSON.stringify(customFolders));
  }, [customFolders, slug]);

  useEffect(() => {
    if (typeof window === "undefined" || customFoldersLoadedForSlugRef.current !== slug) {
      return;
    }

    window.localStorage.setItem(resolveGalleryFolderGroupStorageKey(slug), JSON.stringify(customFolderGroups));
  }, [customFolderGroups, slug]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function closeRailActionMenu() {
      setRailActionMenu(null);
    }

    function closeRailActionMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRailActionMenu(null);
      }
    }

    window.addEventListener("click", closeRailActionMenu);
    window.addEventListener("keydown", closeRailActionMenuOnEscape);
    return () => {
      window.removeEventListener("click", closeRailActionMenu);
      window.removeEventListener("keydown", closeRailActionMenuOnEscape);
    };
  }, []);

  function openRailActionMenu(event: MouseEvent, nextTarget: RailActionTarget) {
    event.preventDefault();
    event.stopPropagation();
    setRailActionMenu((current) =>
      current?.kind === nextTarget.kind && current.id === nextTarget.id && current.mode === "menu"
        ? null
        : { ...nextTarget, mode: "menu" },
    );
  }

  function openRailConfirmation(action: RailActionTarget, mode: "confirm-delete" | "confirm-empty") {
    setRailActionMenu({ ...action, mode });
  }

  function handleDeleteRailAction(action: RailActionTarget) {
    setRailActionMenu(null);
    if (action.kind === "group") {
      handleDeleteCustomGroup(action.id, action.label);
      return;
    }

    handleDeleteCustomFolder(action.id, action.label);
  }

  function handleSendFolder(folderId: string, folderLabel: string, destination: "Fanvue" | "Google Drive") {
    const savedAssetCount = customFolders.find((folder) => folder.id === folderId)?.assetIds.length ?? folderCounts.get(folderId) ?? 0;
    setRailActionMenu(null);
    setCustomFolderFeedback(
      `${folderLabel} is ready to send to ${destination} with ${savedAssetCount} asset${savedAssetCount === 1 ? "" : "s"}.`,
    );
  }

  function handleEmptyCustomFolder(folderId: string, folderLabel: string) {
    const targetFolder = customFolders.find((folder) => folder.id === folderId);
    if (!targetFolder) {
      return;
    }

    setRailActionMenu(null);
    setCustomFolders((current) => current.map((folder) => (folder.id === folderId ? { ...folder, assetIds: [] } : folder)));
    setCustomFolderFeedback(`Emptied folder ${folderLabel}. Generated assets were not deleted.`);
  }

  function handleCreateCustomGroup() {
    if (!trimmedCustomGroupName) {
      setCustomFolderFeedback("Enter a group name first.");
      return;
    }

    const duplicateGroup = customFolderGroups.some((group) => group.label.trim().toLocaleLowerCase() === trimmedCustomGroupName.toLocaleLowerCase());

    if (duplicateGroup) {
      setCustomFolderFeedback("A folder group with that name already exists.");
      return;
    }

    const nextGroup: StoredCustomGalleryGroup = {
      id: createCustomFolderGroupId(),
      label: trimmedCustomGroupName,
      createdAt: new Date().toISOString(),
    };

    setCustomFolderGroups((current) => [...current, nextGroup]);
    setExpandedGroupIds((current) => (current.includes(nextGroup.id) ? current : [...current, nextGroup.id]));
    setPendingCustomGroupName("");
    setCustomFolderFeedback(`Created group ${nextGroup.label}. Add folders inside it.`);
  }

  function handleCreateCustomFolder(groupId: string, groupLabel: string) {
    const trimmedCustomFolderName = (pendingFolderNamesByGroupId[groupId] ?? "").trim();

    if (!trimmedCustomFolderName) {
      setCustomFolderFeedback("Enter a folder name first.");
      return;
    }

    const duplicateFolder = customFolders.some(
      (folder) => folder.groupId === groupId && folder.label.trim().toLocaleLowerCase() === trimmedCustomFolderName.toLocaleLowerCase(),
    );

    if (duplicateFolder) {
      setCustomFolderFeedback(`A folder with that name already exists in ${groupLabel}.`);
      return;
    }

    const nextFolder: StoredCustomGalleryFolder = {
      id: createCustomFolderId(),
      groupId,
      label: trimmedCustomFolderName,
      assetIds: Array.from(new Set(selectedIds.filter((assetId) => availableAssetIds.has(assetId)))),
      createdAt: new Date().toISOString(),
    };

    setCustomFolders((current) => [nextFolder, ...current]);
    setExpandedGroupIds((current) => (current.includes(groupId) ? current : [...current, groupId]));
    setSelectedFolderId(nextFolder.id);
    setPendingFolderNamesByGroupId((current) => ({ ...current, [groupId]: "" }));
    setCustomFolderFeedback(
      nextFolder.assetIds.length > 0
        ? `Created ${nextFolder.label} in ${groupLabel} with ${nextFolder.assetIds.length} saved image${nextFolder.assetIds.length === 1 ? "" : "s"}.`
        : `Created empty folder ${nextFolder.label} in ${groupLabel}.`,
    );
  }

  function handleDeleteCustomFolder(folderId: string, folderLabel: string) {
    const targetFolder = customFolders.find((folder) => folder.id === folderId);
    if (!targetFolder) {
      return;
    }

    setCustomFolders((current) => current.filter((folder) => folder.id !== folderId));
    if (selectedFolderId === folderId) {
      setSelectedFolderId(defaultGalleryFolderId);
    }
    setCustomFolderFeedback(`Deleted folder ${folderLabel}.`);
  }

  function handleDeleteCustomGroup(groupId: string, groupLabel: string) {
    const targetGroup = customFolderGroups.find((group) => group.id === groupId);
    if (!targetGroup) {
      return;
    }

    const groupFolders = customFolders.filter((folder) => folder.groupId === groupId);
    const deletedFolderIds = new Set(groupFolders.map((folder) => folder.id));
    setCustomFolderGroups((current) => current.filter((group) => group.id !== groupId));
    setCustomFolders((current) => current.filter((folder) => folder.groupId !== groupId));
    setExpandedGroupIds((current) => current.filter((entry) => entry !== groupId));
    setPendingFolderNamesByGroupId((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[groupId];
      return nextDrafts;
    });
    if (deletedFolderIds.has(selectedFolderId)) {
      setSelectedFolderId(defaultGalleryFolderId);
    }
    setCustomFolderFeedback(`Deleted group ${groupLabel}.`);
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
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">Model-isolated gallery</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <InfluencerAvatar model={model} size="lg" />
            <div className="min-w-0">
              <h1 className="font-display text-4xl text-white">{model.name} gallery</h1>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">{model.handle}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
                This visual surface is intentionally built to expand into masking, multi-select workflows, and bulk actions later. The current implementation keeps selection state and tile-level metadata without blocking those future features.
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
          <div className="border-b border-[color:var(--surface-border)] px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Folders</p>
            <h2 className="font-display mt-2 text-2xl text-[color:var(--text-strong)]">Gallery rail</h2>
          </div>

          <div className="space-y-3 px-4 py-4">
            {folderGroups.map((group) => {
              const expanded = expandedGroupIds.includes(group.id);
              const canDeleteGroup = customFolderGroups.some((customGroup) => customGroup.id === group.id);
              const canCreateFoldersInGroup = group.id === customFolderGroupId || canDeleteGroup;
              const pendingFolderNameForGroup = pendingFolderNamesByGroupId[group.id] ?? "";
              const groupMenuOpen = railActionMenu?.kind === "group" && railActionMenu.id === group.id;
              const groupConfirmOpen = groupMenuOpen && railActionMenu?.mode === "confirm-delete";
              const groupAction: RailActionTarget = { kind: "group", id: group.id, label: group.label };

              return (
                <div key={group.id} className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]">
                  <div
                    className="relative flex items-center gap-2 px-3 py-2.5"
                    onContextMenu={canDeleteGroup ? (event) => openRailActionMenu(event, groupAction) : undefined}
                  >
                    <button
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-1.5 py-1 text-left transition hover:bg-[color:var(--surface-soft-hover)]"
                      onClick={() =>
                        setExpandedGroupIds((current) =>
                          current.includes(group.id) ? current.filter((entry) => entry !== group.id) : [...current, group.id],
                        )
                      }
                      type="button"
                    >
                      <span className="truncate text-sm font-semibold text-[color:var(--text-strong)]">{group.label}</span>
                      <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                        <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-2 py-0.5">{group.items.length}</span>
                        <span>{expanded ? "v" : ">"}</span>
                      </span>
                    </button>
                    {canDeleteGroup ? (
                      <button
                        aria-expanded={groupMenuOpen}
                        aria-haspopup="menu"
                        aria-label={`${group.label} actions`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] text-xs font-bold text-[color:var(--text-muted)] opacity-70 transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-main)] hover:opacity-100"
                        onClick={(event) => openRailActionMenu(event, groupAction)}
                        type="button"
                      >
                        ...
                      </button>
                    ) : null}
                    {groupMenuOpen ? (
                      <div
                        className="absolute right-3 top-11 z-30 w-56 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-1.5 shadow-[var(--shadow-card)]"
                        onClick={(event) => event.stopPropagation()}
                        role="menu"
                      >
                        {groupConfirmOpen ? (
                          <div className="space-y-2 p-2">
                            <div>
                              <p className="text-xs font-semibold text-[color:var(--text-strong)]">Delete {group.label}?</p>
                              <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-muted)]">
                                Removes this group and its custom folders. Generated assets stay in the gallery.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                className="rounded-lg border border-[color:var(--surface-border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)]"
                                onClick={() => setRailActionMenu({ ...groupAction, mode: "menu" })}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-1.5 text-xs font-semibold text-[color:var(--danger-text)] transition hover:bg-[color:var(--danger-bg-hover)]"
                                onClick={() => handleDeleteRailAction(groupAction)}
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--danger-text)] transition hover:bg-[color:var(--danger-bg-hover)]"
                            onClick={() => openRailConfirmation(groupAction, "confirm-delete")}
                            role="menuitem"
                            type="button"
                          >
                            Delete group
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {expanded ? (
                    <div className="space-y-2 border-t border-[color:var(--surface-border)] px-2.5 py-2.5">
                      {group.items.length > 0 ? (
                        group.items.map((item) => {
                          const active = item.id === selectedFolderId;
                          const isCustomFolder = item.source === "custom";
                          const canOpenItemMenu = item.source === "custom";
                          const itemMenuOpen = railActionMenu?.kind === "folder" && railActionMenu.id === item.id;
                          const itemDeleteConfirmOpen = itemMenuOpen && railActionMenu?.mode === "confirm-delete";
                          const itemEmptyConfirmOpen = itemMenuOpen && railActionMenu?.mode === "confirm-empty";
                          const itemAction: RailActionTarget = { kind: "folder", id: item.id, label: item.label, source: item.source };

                          return (
                            <div
                              key={item.id}
                              className={
                                "relative w-full rounded-xl border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition " +
                                (active
                                  ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)]"
                                  : "border-[color:var(--surface-border)] bg-[color:var(--surface-card)] hover:bg-[color:var(--surface-soft-hover)]")
                              }
                              onContextMenu={canOpenItemMenu ? (event) => openRailActionMenu(event, itemAction) : undefined}
                            >
                              <div className="flex items-stretch gap-2">
                                <button className="min-w-0 flex-1 px-3 py-2.5 text-left" onClick={() => setSelectedFolderId(item.id)} type="button">
                                  <div className="flex items-center gap-3">
                                    <span className="truncate text-sm font-semibold text-[color:var(--text-strong)]">{item.label}</span>
                                  </div>
                                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[color:var(--text-muted)]">{item.description}</p>
                                </button>
                                <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-1.5 border-l border-[color:var(--surface-border)] py-2 pr-2">
                                  <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                                    {folderCounts.get(item.id) ?? 0}
                                  </span>
                                  {canOpenItemMenu ? (
                                    <button
                                      aria-expanded={itemMenuOpen}
                                      aria-haspopup="menu"
                                      aria-label={`${item.label} actions`}
                                      className="inline-flex h-6 w-8 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-xs font-bold leading-none text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-main)]"
                                      onClick={(event) => openRailActionMenu(event, itemAction)}
                                      type="button"
                                    >
                                      ...
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {itemMenuOpen ? (
                                <div
                                  className="absolute right-2 top-14 z-30 w-56 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-1.5 shadow-[var(--shadow-card)]"
                                  onClick={(event) => event.stopPropagation()}
                                  role="menu"
                                >
                                  {itemDeleteConfirmOpen ? (
                                    <div className="space-y-2 p-2">
                                      <div>
                                        <p className="text-xs font-semibold text-[color:var(--text-strong)]">Delete {item.label}?</p>
                                        <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-muted)]">
                                          {isCustomFolder
                                            ? "Removes this custom folder only. Generated assets stay in the gallery."
                                            : "This is a built-in media folder, so it stays in the rail. Generated assets stay in the gallery."}
                                        </p>
                                      </div>
                                      <div className={isCustomFolder ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
                                        <button
                                          className="rounded-lg border border-[color:var(--surface-border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)]"
                                          onClick={() => setRailActionMenu({ ...itemAction, mode: "menu" })}
                                          type="button"
                                        >
                                          {isCustomFolder ? "Cancel" : "Back"}
                                        </button>
                                        {isCustomFolder ? (
                                          <button
                                            className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-1.5 text-xs font-semibold text-[color:var(--danger-text)] transition hover:bg-[color:var(--danger-bg-hover)]"
                                            onClick={() => handleDeleteRailAction(itemAction)}
                                            type="button"
                                          >
                                            Delete
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : itemEmptyConfirmOpen ? (
                                    <div className="space-y-2 p-2">
                                      <div>
                                        <p className="text-xs font-semibold text-[color:var(--text-strong)]">Empty {item.label}?</p>
                                        <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-muted)]">
                                          {isCustomFolder
                                            ? "Removes saved items from this custom folder only. Generated assets stay in the gallery."
                                            : "This is a built-in media folder, so it cannot be emptied from the rail. Generated assets stay in the gallery."}
                                        </p>
                                      </div>
                                      <div className={isCustomFolder ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
                                        <button
                                          className="rounded-lg border border-[color:var(--surface-border)] px-2 py-1.5 text-xs font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)]"
                                          onClick={() => setRailActionMenu({ ...itemAction, mode: "menu" })}
                                          type="button"
                                        >
                                          {isCustomFolder ? "Cancel" : "Back"}
                                        </button>
                                        {isCustomFolder ? (
                                          <button
                                            className="rounded-lg border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] px-2 py-1.5 text-xs font-semibold text-[color:var(--danger-text)] transition hover:bg-[color:var(--danger-bg-hover)]"
                                            onClick={() => handleEmptyCustomFolder(item.id, item.label)}
                                            type="button"
                                          >
                                            Empty
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <button
                                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)]"
                                        onClick={() => handleSendFolder(item.id, item.label, "Fanvue")}
                                        role="menuitem"
                                        type="button"
                                      >
                                        Send to Fanvue
                                      </button>
                                      <button
                                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)]"
                                        onClick={() => handleSendFolder(item.id, item.label, "Google Drive")}
                                        role="menuitem"
                                        type="button"
                                      >
                                        Send to Google Drive
                                      </button>
                                      <div className="my-1 border-t border-[color:var(--surface-border)]" />
                                      <button
                                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)]"
                                        onClick={() => openRailConfirmation(itemAction, "confirm-empty")}
                                        role="menuitem"
                                        type="button"
                                      >
                                        Empty folder
                                      </button>
                                      <button
                                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--danger-text)] transition hover:bg-[color:var(--danger-bg-hover)]"
                                        onClick={() => openRailConfirmation(itemAction, "confirm-delete")}
                                        role="menuitem"
                                        type="button"
                                      >
                                        Delete folder
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <p className="rounded-xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
                          No folders in this group yet.
                        </p>
                      )}
                      {canCreateFoldersInGroup ? (
                        <div className="rounded-xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-2">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_64px]">
                            <input
                              className="h-9 w-full rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-3 text-xs text-[color:var(--text-main)] outline-none transition placeholder:text-[color:var(--text-disabled)] focus:border-[color:var(--focus-ring)] focus:bg-[color:var(--surface-soft-hover)]"
                              maxLength={48}
                              onChange={(event) =>
                                setPendingFolderNamesByGroupId((current) => ({ ...current, [group.id]: event.target.value }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleCreateCustomFolder(group.id, group.label);
                                }
                              }}
                              placeholder="New folder"
                              value={pendingFolderNameForGroup}
                            />
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-lg bg-[color:var(--accent-main)] px-3 text-xs font-bold text-[color:var(--accent-foreground)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                              disabled={!pendingFolderNameForGroup.trim()}
                              onClick={() => handleCreateCustomFolder(group.id, group.label)}
                              type="button"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="border-t border-[color:var(--surface-border)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Custom groups</p>
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                {customFolderGroups.length} group{customFolderGroups.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_72px]">
              <input
                className="h-10 w-full rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-sm text-[color:var(--text-main)] outline-none transition placeholder:text-[color:var(--text-disabled)] focus:border-[color:var(--focus-ring)] focus:bg-[color:var(--surface-soft-hover)]"
                maxLength={48}
                onChange={(event) => setPendingCustomGroupName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreateCustomGroup();
                  }
                }}
                placeholder="New group"
                value={pendingCustomGroupName}
              />
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-xs font-semibold text-[color:var(--text-main)] transition hover:bg-[color:var(--surface-soft-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!trimmedCustomGroupName}
                onClick={handleCreateCustomGroup}
                type="button"
              >
                Add
              </button>
            </div>
            {customFolderFeedback ? <p className="mt-3 text-xs leading-5 text-[color:var(--text-muted)]">{customFolderFeedback}</p> : null}
          </div>
        </aside>

        <GalleryMasonry
          assets={filteredAssets}
          activeImageFilterId={selectedImageFilterId}
          activeSafetySection={selectedSafetySection}
          headerLabel={galleryHeaderLabel}
          headerDescription={galleryHeaderDescription}
          imageFilterOptions={imageFilterOptions}
          onSelectImageFilter={(filterId) => setSelectedImageFilterId(filterId as GalleryImageFilterId)}
          onSelectSafetySection={setSelectedSafetySection}
          onToggle={(assetId) =>
            setSelectedIds((current) => (current.includes(assetId) ? current.filter((entry) => entry !== assetId) : [...current, assetId]))
          }
          safetySectionCounts={safetySectionCounts}
          selectedIds={selectedIds}
          selectedVisibleCount={selectedCount}
          showImageFilters={selectedMediaKind === "image"}
          showSafetyControls={showSafetyControls}
        />
      </section>
    </div>
  );
}
