import type { GeneratedAsset } from "../types";

export type FolderMatcher = (asset: GeneratedAsset) => boolean;

export type GalleryFolderSource = "smart" | "custom";

export interface GalleryFolderItem {
  id: string;
  label: string;
  description: string;
  matcher: FolderMatcher;
  source: GalleryFolderSource;
}

export interface GalleryFolderGroup {
  id: string;
  label: string;
  items: GalleryFolderItem[];
}

export interface StoredCustomGalleryGroup {
  id: string;
  label: string;
  createdAt: string;
}

export interface StoredCustomGalleryFolder {
  id: string;
  groupId: string;
  label: string;
  assetIds: string[];
  createdAt: string;
}

export const customFolderGroupId = "custom-folders";
export const customFolderGroupLabel = "Custom folders";
export const allMediaFolderId = "all";
export const defaultGalleryFolderId = "images";
export const videoFolderId = "videos";
export const voiceFolderId = "voices";
export const faceSwapFolderId = "face-swaps";
export const inpaintFolderId = "inpaint";
export const multiPoseFolderId = "multi-pose";

const galleryFolderStorageKeyPrefix = "autoscale-gallery-custom-folders";
const galleryFolderGroupStorageKeyPrefix = "autoscale-gallery-custom-folder-groups";
const videoAssetPattern = /(?:^|[^a-z0-9])videos?(?:$|[^a-z0-9])/i;
const videoAssetExtensionPattern = /\.(?:mp4|mov|m4v|webm)$/i;
const voiceAssetPattern = /(?:^|[^a-z0-9])(?:voices?|audio)(?:$|[^a-z0-9])/i;
const audioAssetExtensionPattern = /\.(?:mp3|wav|m4a|aac|ogg|oga|flac|webm)$/i;

function buildAssetSearchText(asset: GeneratedAsset): string {
  return `${asset.fileName} ${asset.promptSnapshot}`;
}

export function matchesVideoAsset(asset: GeneratedAsset): boolean {
  return videoAssetPattern.test(buildAssetSearchText(asset)) || videoAssetExtensionPattern.test(asset.fileName);
}

export function matchesVoiceAsset(asset: GeneratedAsset): boolean {
  return voiceAssetPattern.test(buildAssetSearchText(asset)) || audioAssetExtensionPattern.test(asset.fileName);
}

function matchesImageAsset(asset: GeneratedAsset): boolean {
  return !matchesVideoAsset(asset) && !matchesVoiceAsset(asset);
}

export const galleryFolderGroups: GalleryFolderGroup[] = [
  {
    id: "media-folders",
    label: "Media folders",
    items: [
      {
        id: allMediaFolderId,
        label: "All",
        description: "All generated media for this model.",
        matcher: () => true,
        source: "smart",
      },
      {
        id: defaultGalleryFolderId,
        label: "Images",
        description: "Generated image outputs for this model.",
        matcher: matchesImageAsset,
        source: "smart",
      },
      {
        id: videoFolderId,
        label: "Videos",
        description: "Video generation assets matched from prompt or filename metadata.",
        matcher: matchesVideoAsset,
        source: "smart",
      },
      {
        id: voiceFolderId,
        label: "Voice Notes",
        description: "Voice-note generation assets matched from prompt or filename metadata.",
        matcher: matchesVoiceAsset,
        source: "smart",
      },
    ],
  },
];

export function resolveGalleryFolderStorageKey(slug: string): string {
  return `${galleryFolderStorageKeyPrefix}:${slug}`;
}

export function resolveGalleryFolderGroupStorageKey(slug: string): string {
  return `${galleryFolderGroupStorageKeyPrefix}:${slug}`;
}

export function readStoredCustomFolderGroups(slug: string): StoredCustomGalleryGroup[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(resolveGalleryFolderGroupStorageKey(slug));
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const candidate = entry as Partial<StoredCustomGalleryGroup>;
      if (typeof candidate.id !== "string" || typeof candidate.label !== "string") {
        return [];
      }

      if (candidate.id === customFolderGroupId) {
        return [];
      }

      return [
        {
          id: candidate.id,
          label: candidate.label,
          createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function readStoredCustomFolders(slug: string): StoredCustomGalleryFolder[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(resolveGalleryFolderStorageKey(slug));
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const candidate = entry as Partial<StoredCustomGalleryFolder>;
      if (typeof candidate.id !== "string" || typeof candidate.label !== "string" || !Array.isArray(candidate.assetIds)) {
        return [];
      }

      const assetIds = candidate.assetIds.filter((assetId): assetId is string => typeof assetId === "string");

      return [
        {
          id: candidate.id,
          groupId: typeof candidate.groupId === "string" ? candidate.groupId : customFolderGroupId,
          label: candidate.label,
          assetIds: Array.from(new Set(assetIds)),
          createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function resolveInitialExpandedGroupIds(slug: string): string[] {
  const baseGroupIds = galleryFolderGroups.map((group) => group.id);
  const customGroupIds = readStoredCustomFolderGroups(slug).map((group) => group.id);
  const customFolders = readStoredCustomFolders(slug);

  return customFolders.length > 0 || customGroupIds.length > 0 ? [...baseGroupIds, customFolderGroupId, ...customGroupIds] : baseGroupIds;
}

export function createCustomFolderId(): string {
  return `custom-folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCustomFolderGroupId(): string {
  return `custom-folder-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildCustomFolderItems(customFolders: StoredCustomGalleryFolder[]): GalleryFolderItem[] {
  return customFolders.map((folder) => {
    const assetIdSet = new Set(folder.assetIds);
    const savedImageCount = folder.assetIds.length;

    return {
      id: folder.id,
      label: folder.label,
      description:
        savedImageCount === 0
          ? "Empty custom folder ready for saved image selections."
          : `${savedImageCount} saved image${savedImageCount === 1 ? "" : "s"}.`,
      matcher: (asset) => assetIdSet.has(asset.id),
      source: "custom",
    };
  });
}

export function buildFolderCounts(assets: GeneratedAsset[], folderGroups: GalleryFolderGroup[]) {
  const entries = folderGroups.flatMap((group) => group.items.map((item) => [item.id, assets.filter(item.matcher).length] as const));
  return new Map(entries);
}

export function findFolder(folderId: string, folderGroups: GalleryFolderGroup[]): GalleryFolderItem | null {
  return folderGroups.flatMap((group) => group.items).find((item) => item.id === folderId) ?? null;
}

export function buildGalleryFolderGroups(customFolders: StoredCustomGalleryFolder[], customGroups: StoredCustomGalleryGroup[] = []): GalleryFolderGroup[] {
  const customFolderGroups = [
    { id: customFolderGroupId, label: customFolderGroupLabel, createdAt: new Date(0).toISOString() },
    ...customGroups,
  ].flatMap((group) => {
    const customFolderItems = buildCustomFolderItems(customFolders.filter((folder) => folder.groupId === group.id));

    return customFolderItems.length > 0 || customGroups.some((customGroup) => customGroup.id === group.id)
      ? [{ id: group.id, label: group.label, items: customFolderItems }]
      : [];
  });

  return customFolderGroups.length > 0 ? [...galleryFolderGroups, ...customFolderGroups] : galleryFolderGroups;
}
