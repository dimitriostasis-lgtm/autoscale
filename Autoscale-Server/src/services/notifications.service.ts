import { PUBSUB_EVENTS, pubsub } from "../lib/pubsub.js";
import type { GeneratedAsset, StoreData } from "../types/domain.js";

import { presentBoard } from "./presenters.js";

export async function publishBoardUpdate(boardId: string, store: StoreData): Promise<void> {
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    return;
  }

  await pubsub.publish(PUBSUB_EVENTS.BOARD_UPDATED, {
    boardUpdated: presentBoard(board, store),
    boardId,
  });
}

export async function publishAssetCreated(influencerModelId: string, asset: GeneratedAsset): Promise<void> {
  await pubsub.publish(PUBSUB_EVENTS.ASSET_CREATED, {
    assetCreated: asset,
    influencerModelId,
  });
}