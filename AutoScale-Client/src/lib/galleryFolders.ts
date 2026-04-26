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

export interface StoredCustomGalleryFolder {
  id: string;
  label: string;
  assetIds: string[];
  createdAt: string;
}

export const customFolderGroupId = "custom-folders";
export const defaultGalleryFolderId = "images";

const galleryFolderStorageKeyPrefix = "autoscale-gallery-custom-folders";
const videoAssetPattern = /(?:^|[^a-z0-9])videos?(?:$|[^a-z0-9])/i;
const voiceAssetPattern = /(?:^|[^a-z0-9])(?:voices?|audio)(?:$|[^a-z0-9])/i;

function buildAssetSearchText(asset: GeneratedAsset): string {
  return `${asset.fileName} ${asset.promptSnapshot}`;
}

function matchesVideoAsset(asset: GeneratedAsset): boolean {
  return videoAssetPattern.test(buildAssetSearchText(asset));
}

function matchesVoiceAsset(asset: GeneratedAsset): boolean {
  return voiceAssetPattern.test(buildAssetSearchText(asset));
}

export const galleryFolderGroups: GalleryFolderGroup[] = [
  {
    id: "smart-folders",
    label: "Smart folders",
    items: [
      {
        id: defaultGalleryFolderId,
        label: "Images",
        description: "Generated image outputs for this model.",
        matcher: (asset) => !matchesVideoAsset(asset) && !matchesVoiceAsset(asset),
        source: "smart",
      },
      {
        id: "videos",
        label: "Videos",
        description: "Video generation assets matched from prompt or filename metadata.",
        matcher: matchesVideoAsset,
        source: "smart",
      },
      {
        id: "voices",
        label: "Voices",
        description: "Voice generation assets matched from prompt or filename metadata.",
        matcher: matchesVoiceAsset,
        source: "smart",
      },
    ],
  },
];

export function resolveGalleryFolderStorageKey(slug: string): string {
  return `${galleryFolderStorageKeyPrefix}:${slug}`;
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

  return readStoredCustomFolders(slug).length > 0 ? [...baseGroupIds, customFolderGroupId] : baseGroupIds;
}

export function createCustomFolderId(): string {
  return `custom-folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export function buildGalleryFolderGroups(customFolders: StoredCustomGalleryFolder[]): GalleryFolderGroup[] {
  const customFolderItems = buildCustomFolderItems(customFolders);

  return customFolderItems.length > 0
    ? [...galleryFolderGroups, { id: customFolderGroupId, label: "Custom folders", items: customFolderItems }]
    : galleryFolderGroups;
}
