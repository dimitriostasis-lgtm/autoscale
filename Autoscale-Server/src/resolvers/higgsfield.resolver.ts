import type { GraphQLContext } from "../types/context.js";

import {
  connectHiggsfieldAccount,
  disconnectHiggsfieldAccount,
  listHiggsfieldAccountConnections,
  refreshHiggsfieldAccountBalance,
} from "../services/higgsfield.service.js";

export const higgsfieldResolvers = {
  Query: {
    higgsfieldAccountConnections: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      listHiggsfieldAccountConnections(context.currentUser),
  },
  Mutation: {
    connectHiggsfieldAccount: async (
      _parent: unknown,
      args: { influencerModelId: string },
      context: GraphQLContext,
    ) => connectHiggsfieldAccount(context.currentUser, args.influencerModelId),
    refreshHiggsfieldAccountBalance: async (
      _parent: unknown,
      args: { influencerModelId: string },
      context: GraphQLContext,
    ) => refreshHiggsfieldAccountBalance(context.currentUser, args.influencerModelId),
    disconnectHiggsfieldAccount: async (
      _parent: unknown,
      args: { influencerModelId: string },
      context: GraphQLContext,
    ) => disconnectHiggsfieldAccount(context.currentUser, args.influencerModelId),
  },
};
