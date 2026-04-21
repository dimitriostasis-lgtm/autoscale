import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const PUBSUB_EVENTS = {
  BOARD_UPDATED: "BOARD_UPDATED",
  ASSET_CREATED: "ASSET_CREATED",
} as const;