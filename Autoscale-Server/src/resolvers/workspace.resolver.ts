import { filterAsyncIterable } from "../lib/filter-async-iterable.js";
import { PUBSUB_EVENTS, pubsub } from "../lib/pubsub.js";
import type { GraphQLContext } from "../types/context.js";
import type { ReferenceSelection } from "../types/domain.js";

import {
  addBoardRow,
  clearBoard,
  createBoard,
  deleteBoard,
  deleteBoardRow,
  ensureBoard,
  getWorkspaceBoard,
  renameBoard,
  runBoard,
  updateBoardRow,
  updateBoardSettings,
} from "../services/workspace.service.js";

export const workspaceResolvers = {
  Query: {
    workspaceBoard: async (_parent: unknown, args: { boardId: string }, context: GraphQLContext) =>
      getWorkspaceBoard(context.currentUser, args.boardId),
  },
  Mutation: {
    ensureBoard: async (_parent: unknown, args: { influencerModelId: string }, context: GraphQLContext) =>
      ensureBoard(context.currentUser, args.influencerModelId),
    createBoard: async (
      _parent: unknown,
      args: { influencerModelId: string; name?: string | null },
      context: GraphQLContext,
    ) => createBoard(context.currentUser, args.influencerModelId, args.name || undefined),
    renameBoard: async (_parent: unknown, args: { boardId: string; name: string }, context: GraphQLContext) =>
      renameBoard(context.currentUser, args.boardId, args.name),
    deleteBoard: async (_parent: unknown, args: { boardId: string }, context: GraphQLContext) =>
      deleteBoard(context.currentUser, args.boardId),
    addBoardRow: async (_parent: unknown, args: { boardId: string }, context: GraphQLContext) =>
      addBoardRow(context.currentUser, args.boardId),
    deleteBoardRow: async (
      _parent: unknown,
      args: { boardId: string; rowId: string },
      context: GraphQLContext,
    ) => deleteBoardRow(context.currentUser, args.boardId, args.rowId),
    updateBoardRow: async (
      _parent: unknown,
      args: {
        input: {
          boardId: string;
          rowId: string;
          label?: string | null;
          prompt?: string | null;
          poseMultiplier?: number | null;
          faceSwap?: boolean | null;
          reference?: ReferenceSelection | null;
          clearReference?: boolean | null;
        };
      },
      context: GraphQLContext,
    ) => updateBoardRow(context.currentUser, args.input),
    updateBoardSettings: async (
      _parent: unknown,
      args: {
        boardId: string;
        input: {
          generationModel: string;
          resolution: string;
          aspectRatio: string;
          quantity: number;
          poseMultiplierEnabled: boolean;
          poseMultiplier: number;
          faceSwap: boolean;
          autoPromptGen: boolean;
          autoPromptImage: boolean;
          posePromptMode: string;
          posePromptTemplate: string;
          globalReferences: ReferenceSelection[];
        };
      },
      context: GraphQLContext,
    ) => updateBoardSettings(context.currentUser, args.boardId, args.input),
    clearBoard: async (_parent: unknown, args: { boardId: string }, context: GraphQLContext) =>
      clearBoard(context.currentUser, args.boardId),
    runBoard: async (_parent: unknown, args: { boardId: string }, context: GraphQLContext) =>
      runBoard(context.currentUser, args.boardId),
  },
  Subscription: {
    boardUpdated: {
      subscribe: (_parent: unknown, args: { boardId: string }) =>
        filterAsyncIterable(
          pubsub.asyncIterableIterator(PUBSUB_EVENTS.BOARD_UPDATED) as AsyncIterable<{ boardId: string; boardUpdated: unknown }>,
          async (payload: { boardId: string }) => payload.boardId === args.boardId,
        ),
      resolve: (payload: { boardUpdated: unknown }) => payload.boardUpdated,
    },
    assetCreated: {
      subscribe: (_parent: unknown, args: { influencerModelId: string }) =>
        filterAsyncIterable(
          pubsub.asyncIterableIterator(PUBSUB_EVENTS.ASSET_CREATED) as AsyncIterable<{
            influencerModelId: string;
            assetCreated: unknown;
          }>,
          async (payload: { influencerModelId: string }) => payload.influencerModelId === args.influencerModelId,
        ),
      resolve: (payload: { assetCreated: unknown }) => payload.assetCreated,
    },
  },
};