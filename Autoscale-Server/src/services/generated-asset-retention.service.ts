import fs from "node:fs/promises";
import path from "node:path";

import { updateStore } from "../lib/store.js";
import { getStorageRoot, toAbsoluteStoragePath } from "../lib/storage.js";
import type { GeneratedAsset, ReferenceSelection, StoreData, WorkspaceBoard, WorkspaceRow } from "../types/domain.js";

const GENERATED_ASSET_RETENTION_DAYS = 7;
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const GENERATED_ROOT_SEGMENT = "generated";

let retentionTimer: NodeJS.Timeout | null = null;
let retentionRun: Promise<GeneratedAssetRetentionResult> | null = null;

export interface GeneratedAssetRetentionResult {
  expiredAssetCount: number;
  deletedFileCount: number;
  failedFileCount: number;
}

function retentionCutoffMs(now = Date.now()): number {
  return now - GENERATED_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

function isGeneratedAssetPath(filePath: string): boolean {
  return filePath.replace(/\\/g, "/").split("/")[0] === GENERATED_ROOT_SEGMENT;
}

function isExpiredGeneratedAsset(asset: GeneratedAsset, cutoffMs: number): boolean {
  const createdAtMs = Date.parse(asset.createdAt);
  return asset.mediaKind === "image" && Number.isFinite(createdAtMs) && createdAtMs < cutoffMs && isGeneratedAssetPath(asset.filePath);
}

function clearExpiredReference(selection: ReferenceSelection | null, expiredIds: Set<string>): ReferenceSelection | null {
  if (!selection?.assetId || !expiredIds.has(selection.assetId)) {
    return selection;
  }

  return {
    ...selection,
    sourceType: "UPLOAD",
    assetId: null,
    assetUrl: null,
  };
}

function removeExpiredIds(ids: string[], expiredIds: Set<string>): string[] {
  return ids.filter((assetId) => !expiredIds.has(assetId));
}

function cleanExpiredAssetReferences(store: StoreData, expiredIds: Set<string>): StoreData {
  return {
    ...store,
    assets: store.assets.filter((asset) => !expiredIds.has(asset.id)),
    boards: store.boards.map((board): WorkspaceBoard => ({
      ...board,
      settings: {
        ...board.settings,
        globalReferences: board.settings.globalReferences.map((selection) => clearExpiredReference(selection, expiredIds) ?? selection),
      },
      rows: board.rows.map((row): WorkspaceRow => ({
        ...row,
        reference: clearExpiredReference(row.reference, expiredIds),
        audioReference: clearExpiredReference(row.audioReference, expiredIds),
        outputAssetIds: removeExpiredIds(row.outputAssetIds, expiredIds),
        poseOutputAssetIds: removeExpiredIds(row.poseOutputAssetIds, expiredIds),
        faceSwapOutputAssetIds: removeExpiredIds(row.faceSwapOutputAssetIds, expiredIds),
      })),
    })),
  };
}

function resolveGeneratedStoragePath(relativePath: string): string | null {
  if (!isGeneratedAssetPath(relativePath)) {
    return null;
  }

  const storageRoot = path.resolve(getStorageRoot());
  const absolutePath = path.resolve(toAbsoluteStoragePath(relativePath));

  if (absolutePath === storageRoot || !absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    return null;
  }

  return absolutePath;
}

async function removeEmptyGeneratedDirectories(startFilePath: string): Promise<void> {
  const generatedRoot = path.resolve(getStorageRoot(), GENERATED_ROOT_SEGMENT);
  let currentDirectory = path.dirname(startFilePath);

  while (currentDirectory.startsWith(`${generatedRoot}${path.sep}`)) {
    try {
      await fs.rmdir(currentDirectory);
    } catch {
      return;
    }

    currentDirectory = path.dirname(currentDirectory);
  }
}

async function deleteGeneratedAssetFile(asset: GeneratedAsset): Promise<boolean> {
  const absolutePath = resolveGeneratedStoragePath(asset.filePath);

  if (!absolutePath) {
    return false;
  }

  try {
    await fs.rm(absolutePath, { force: true });
    await removeEmptyGeneratedDirectories(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function cleanupExpiredGeneratedAssets(): Promise<GeneratedAssetRetentionResult> {
  const cutoffMs = retentionCutoffMs();
  let expiredAssets: GeneratedAsset[] = [];

  await updateStore((store) => {
    expiredAssets = store.assets.filter((asset) => isExpiredGeneratedAsset(asset, cutoffMs));

    if (!expiredAssets.length) {
      return store;
    }

    return cleanExpiredAssetReferences(store, new Set(expiredAssets.map((asset) => asset.id)));
  });

  const deleteResults = await Promise.allSettled(expiredAssets.map((asset) => deleteGeneratedAssetFile(asset)));
  const deletedFileCount = deleteResults.filter((result) => result.status === "fulfilled" && result.value).length;
  const failedFileCount = deleteResults.filter((result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value)).length;

  return {
    expiredAssetCount: expiredAssets.length,
    deletedFileCount,
    failedFileCount,
  };
}

export function runGeneratedAssetRetention(): Promise<GeneratedAssetRetentionResult> {
  if (!retentionRun) {
    retentionRun = cleanupExpiredGeneratedAssets().finally(() => {
      retentionRun = null;
    });
  }

  return retentionRun;
}

export function startGeneratedAssetRetention(): void {
  if (retentionTimer) {
    return;
  }

  void runGeneratedAssetRetention()
    .then((result) => {
      if (result.expiredAssetCount > 0) {
        console.log(
          `Generated asset retention removed ${result.expiredAssetCount} asset record(s) and ${result.deletedFileCount} file(s).`,
        );
      }
      if (result.failedFileCount > 0) {
        console.warn(`Generated asset retention could not delete ${result.failedFileCount} file(s).`);
      }
    })
    .catch((error) => {
      console.warn("Generated asset retention failed during startup.", error);
    });

  retentionTimer = setInterval(() => {
    void runGeneratedAssetRetention().catch((error) => {
      console.warn("Generated asset retention failed.", error);
    });
  }, RETENTION_INTERVAL_MS);

  retentionTimer.unref();
}
