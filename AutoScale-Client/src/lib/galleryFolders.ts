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
const galleryModeMetadata: Record<string, { label: string; description: string }> = {
  base: { label: "Base Outputs", description: "Base generation outputs before optional workflow stages." },
  multipose: { label: "Pose Multiplier", description: "Generated pose multiplier outputs." },
  face_swap: { label: "Face Swap", description: "Generated face-swap outputs." },
  upscale: { label: "Upscale", description: "Generated upscale outputs." },
  inpaint: { label: "Inpaint", description: "Generated inpaint or masking outputs." },
  video: { label: "Video Outputs", description: "Generated video outputs." },
  voice: { label: "Voice Outputs", description: "Generated voice or audio outputs." },
};

function buildAssetSearchText(asset: GeneratedAsset): string {
  return `${asset.fileName} ${asset.promptSnapshot}`;
}

export function matchesVideoAsset(asset: GeneratedAsset): boolean {
  if (asset.mediaKind === "video") {
    return true;
  }

  return videoAssetPattern.test(buildAssetSearchText(asset)) || videoAssetExtensionPattern.test(asset.fileName);
}

export function matchesVoiceAsset(asset: GeneratedAsset): boolean {
  if (asset.mediaKind === "voice") {
    return true;
  }

  return voiceAssetPattern.test(buildAssetSearchText(asset)) || audioAssetExtensionPattern.test(asset.fileName);
}

export function matchesImageAsset(asset: GeneratedAsset): boolean {
  if (asset.mediaKind === "image") {
    return true;
  }

  return !matchesVideoAsset(asset) && !matchesVoiceAsset(asset);
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function assetGalleryMode(asset: GeneratedAsset): string {
  if (typeof asset.galleryMode === "string" && asset.galleryMode.trim()) {
    return asset.galleryMode;
  }

  if (asset.workflowStage === "face_swap") {
    return "face_swap";
  }

  if (asset.workflowStage === "multipose") {
    return "multipose";
  }

  if (matchesVideoAsset(asset)) {
    return "video";
  }

  if (matchesVoiceAsset(asset)) {
    return "voice";
  }

  return "base";
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

export function buildDynamicGalleryFolderGroups(assets: GeneratedAsset[]): GalleryFolderGroup[] {
  const galleryModes = Array.from(new Set(assets.map(assetGalleryMode))).filter(Boolean);
  const generationModels = Array.from(new Set(assets.map((asset) => asset.generationModel).filter(Boolean))).sort();
  const modeItems = galleryModes.flatMap((mode) => {
    const metadata = galleryModeMetadata[mode] ?? {
      label: humanizeIdentifier(mode),
      description: `Generated outputs stored in ${humanizeIdentifier(mode)} mode.`,
    };

    return [{
      id: `mode:${mode}`,
      label: metadata.label,
      description: metadata.description,
      matcher: (asset: GeneratedAsset) => assetGalleryMode(asset) === mode,
      source: "smart" as const,
    }];
  });
  const modelItems = generationModels.map((generationModel) => ({
    id: `worker-model:${generationModel}`,
    label: humanizeIdentifier(generationModel),
    description: `Generated outputs from ${humanizeIdentifier(generationModel)}.`,
    matcher: (asset: GeneratedAsset) => asset.generationModel === generationModel,
    source: "smart" as const,
  }));

  return [
    ...(modeItems.length ? [{ id: "workflow-modes", label: "Workflow modes", items: modeItems }] : []),
    ...(modelItems.length ? [{ id: "worker-models", label: "Worker models", items: modelItems }] : []),
  ];
}

export function buildGalleryFolderGroups(
  customFolders: StoredCustomGalleryFolder[],
  customGroups: StoredCustomGalleryGroup[] = [],
  dynamicGroups: GalleryFolderGroup[] = [],
): GalleryFolderGroup[] {
  const customFolderGroups = [
    { id: customFolderGroupId, label: customFolderGroupLabel, createdAt: new Date(0).toISOString() },
    ...customGroups,
  ].flatMap((group) => {
    const customFolderItems = buildCustomFolderItems(customFolders.filter((folder) => folder.groupId === group.id));

    return customFolderItems.length > 0 || customGroups.some((customGroup) => customGroup.id === group.id)
      ? [{ id: group.id, label: group.label, items: customFolderItems }]
      : [];
  });

  const baseGroups = [...galleryFolderGroups, ...dynamicGroups];

  return customFolderGroups.length > 0 ? [...baseGroups, ...customFolderGroups] : baseGroups;
}
