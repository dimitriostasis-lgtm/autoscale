import type { GraphQLContext } from "../types/context.js";

import { getCurrentProfile, loginUser, logoutUser } from "../services/auth.service.js";

export const authResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => getCurrentProfile(context.currentUser),
  },
  Mutation: {
    login: async (
      _parent: unknown,
      args: { email: string; password: string },
      context: GraphQLContext,
    ) => loginUser(args.email, args.password, context.res),
    logout: async (_parent: unknown, _args: unknown, context: GraphQLContext) => logoutUser(context.res),
  },
};