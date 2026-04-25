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

const galleryFolderStorageKeyPrefix = "autoscale-gallery-custom-folders";

export const galleryFolderGroups: GalleryFolderGroup[] = [
  {
    id: "smart-folders",
    label: "Smart folders",
    items: [
      {
        id: "all-outputs",
        label: "All Outputs",
        description: "Every generated asset in this model gallery.",
        matcher: () => true,
        source: "smart",
      },
      {
        id: "face-swaps",
        label: "Face Swaps",
        description: "Assets that look like face-swap runs based on prompt or filename metadata.",
        matcher: (asset) => /face\s*swap|faceswap|swap/i.test(`${asset.fileName} ${asset.promptSnapshot}`),
        source: "smart",
      },
      {
        id: "multi-images",
        label: "Multi Images",
        description: "Runs that requested more than one image per prompt.",
        matcher: (asset) => asset.quantity > 1,
        source: "smart",
      },
      {
        id: "single-frames",
        label: "Single Frames",
        description: "One-image generations for cleaner browsing.",
        matcher: (asset) => asset.quantity === 1,
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
