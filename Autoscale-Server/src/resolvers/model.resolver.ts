import type { GraphQLContext } from "../types/context.js";

import {
  createInfluencerModel,
  deleteInfluencerModel,
  getInfluencerModel,
  listInfluencerModels,
  listModelAssets,
  setInfluencerModelAgencyAccess,
  updateInfluencerModelProfile,
} from "../services/model.service.js";

export const modelResolvers = {
  Query: {
    influencerModels: async (
      _parent: unknown,
      args: { includeInactive?: boolean },
      context: GraphQLContext,
    ) => listInfluencerModels(context.currentUser, { includeInactive: args.includeInactive }),
    influencerModel: async (_parent: unknown, args: { slug: string }, context: GraphQLContext) =>
      getInfluencerModel(context.currentUser, args.slug),
    modelAssets: async (
      _parent: unknown,
      args: { influencerModelId: string; limit?: number },
      context: GraphQLContext,
    ) => listModelAssets(context.currentUser, args.influencerModelId, args.limit),
  },
  Mutation: {
    createInfluencerModel: async (
      _parent: unknown,
      args: {
        input: {
          name: string;
          handle: string;
          description?: string | null;
          avatarImageUrl?: string | null;
          allowedGenerationModels: string[];
          defaults: {
            generationModel: string;
            resolution: string;
            aspectRatio: string;
            quantity: number;
            promptPrefix: string;
          };
        };
      },
      context: GraphQLContext,
    ) => createInfluencerModel(context.currentUser, args.input),
    updateInfluencerModelProfile: async (
      _parent: unknown,
      args: {
        influencerModelId: string;
        input: {
          name: string;
          handle: string;
          description?: string | null;
          avatarImageUrl?: string | null;
        };
      },
      context: GraphQLContext,
    ) => updateInfluencerModelProfile(context.currentUser, args.influencerModelId, args.input),
    deleteInfluencerModel: async (
      _parent: unknown,
      args: { influencerModelId: string },
      context: GraphQLContext,
    ) => deleteInfluencerModel(context.currentUser, args.influencerModelId),
    setInfluencerModelAgencyAccess: async (
      _parent: unknown,
      args: { influencerModelId: string; agencyIds: string[] },
      context: GraphQLContext,
    ) => setInfluencerModelAgencyAccess(context.currentUser, args.influencerModelId, args.agencyIds),
  },
};