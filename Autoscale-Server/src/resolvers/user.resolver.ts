import type { GraphQLContext } from "../types/context.js";
import type { Role } from "../types/domain.js";

import {
  clearPlatformNotifications,
  createAgency,
  createUser,
  deleteAgency,
  deleteUser,
  listAgencies,
  listPlatformNotifications,
  listUsers,
  renameAgency,
  renameUser,
  requestBillingFollowUp,
  resetUserPassword,
  setUserActive,
  setUserModelAccess,
  updateAgencyBillingSettings,
  updateManagerPermissions,
  updateUserOrganization,
  updateUserRole,
} from "../services/user.service.js";
import type { AgencyBillingSettings } from "../types/domain.js";

export const userResolvers = {
  Query: {
    agencies: async (_parent: unknown, _args: unknown, context: GraphQLContext) => listAgencies(context.currentUser),
    platformNotifications: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      listPlatformNotifications(context.currentUser),
    users: async (_parent: unknown, _args: unknown, context: GraphQLContext) => listUsers(context.currentUser),
  },
  Mutation: {
    createAgency: async (_parent: unknown, args: { name: string }, context: GraphQLContext) =>
      createAgency(context.currentUser, args.name),
    renameAgency: async (
      _parent: unknown,
      args: { agencyId: string; name: string },
      context: GraphQLContext,
    ) => renameAgency(context.currentUser, args.agencyId, args.name),
    deleteAgency: async (_parent: unknown, args: { agencyId: string }, context: GraphQLContext) =>
      deleteAgency(context.currentUser, args.agencyId),
    updateAgencyBillingSettings: async (
      _parent: unknown,
      args: { agencyId: string; input: AgencyBillingSettings },
      context: GraphQLContext,
    ) => updateAgencyBillingSettings(context.currentUser, args.agencyId, args.input),
    clearPlatformNotifications: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      clearPlatformNotifications(context.currentUser),
    requestBillingFollowUp: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      requestBillingFollowUp(context.currentUser),
    createUser: async (
      _parent: unknown,
      args: { input: { name: string; email: string; password: string; role: Role; agencyId?: string | null } },
      context: GraphQLContext,
    ) => createUser(context.currentUser, args.input),
    renameUser: async (
      _parent: unknown,
      args: { userId: string; name: string },
      context: GraphQLContext,
    ) => renameUser(context.currentUser, args.userId, args.name),
    updateUserRole: async (
      _parent: unknown,
      args: { userId: string; role: Role },
      context: GraphQLContext,
    ) => updateUserRole(context.currentUser, args.userId, args.role),
    updateUserOrganization: async (
      _parent: unknown,
      args: { userId: string; input: { agencyId?: string | null } },
      context: GraphQLContext,
    ) => updateUserOrganization(context.currentUser, args.userId, args.input),
    updateManagerPermissions: async (
      _parent: unknown,
      args: {
        userId: string;
        input: {
          canSuspendUsers: boolean;
          canDeleteUsers: boolean;
          canResetPasswords: boolean;
          canManageAssignments: boolean;
          canManageCredits: boolean;
        };
      },
      context: GraphQLContext,
    ) => updateManagerPermissions(context.currentUser, args.userId, args.input),
    resetUserPassword: async (_parent: unknown, args: { userId: string }, context: GraphQLContext) =>
      resetUserPassword(context.currentUser, args.userId),
    setUserActive: async (
      _parent: unknown,
      args: { userId: string; isActive: boolean },
      context: GraphQLContext,
    ) => setUserActive(context.currentUser, args.userId, args.isActive),
    deleteUser: async (_parent: unknown, args: { userId: string }, context: GraphQLContext) =>
      deleteUser(context.currentUser, args.userId),
    setUserModelAccess: async (
      _parent: unknown,
      args: { userId: string; influencerModelIds: string[] },
      context: GraphQLContext,
    ) => setUserModelAccess(context.currentUser, args.userId, args.influencerModelIds),
  },
};
