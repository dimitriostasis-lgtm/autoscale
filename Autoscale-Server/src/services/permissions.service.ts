import { DEFAULT_MANAGER_PERMISSIONS } from "../types/domain.js";
import type {
  AuthUser,
  GeneratedAsset,
  InfluencerModel,
  ManagerPermissions,
  StoreData,
  StoredUser,
  UserAccessScope,
  WorkspaceBoard,
} from "../types/domain.js";

export const MAX_BOARD_ROWS = 8;

export function requireAuthenticatedUser(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export function isPlatformAdmin(user: Pick<AuthUser, "role">): boolean {
  return user.role === "PLATFORM_ADMIN";
}

export function isAgencyAdmin(user: Pick<AuthUser, "role">): boolean {
  return user.role === "AGENCY_ADMIN";
}

export function isAgencyManager(user: Pick<AuthUser, "role">): boolean {
  return user.role === "AGENCY_MANAGER";
}

export function isElevated(user: AuthUser): boolean {
  return isPlatformAdmin(user) || isAgencyAdmin(user);
}

export function canAccessAccountConsole(user: Pick<AuthUser, "role">): boolean {
  return isPlatformAdmin(user) || isAgencyAdmin(user) || isAgencyManager(user);
}

export function getUserAccessScope(user: Pick<AuthUser, "role">): UserAccessScope {
  if (isPlatformAdmin(user)) {
    return "PLATFORM_ADMIN_ACCESS";
  }

  if (isAgencyAdmin(user)) {
    return "AGENCY_ADMIN_ACCESS";
  }

  if (isAgencyManager(user)) {
    return "AGENCY_MANAGER_ACCESS";
  }

  return "DIRECT_ASSIGNMENT";
}

export function canManageAccounts(user: AuthUser): boolean {
  return isPlatformAdmin(user);
}

function getStoredViewer(store: StoreData, viewer: AuthUser): StoredUser | null {
  return store.users.find((entry) => entry.id === viewer.id) || null;
}

function getManagerPermissions(user: Pick<AuthUser, "role" | "managerPermissions">): ManagerPermissions {
  return {
    canSuspendUsers: user.managerPermissions?.canSuspendUsers ?? DEFAULT_MANAGER_PERMISSIONS.canSuspendUsers,
    canDeleteUsers: user.managerPermissions?.canDeleteUsers ?? DEFAULT_MANAGER_PERMISSIONS.canDeleteUsers,
    canResetPasswords: user.managerPermissions?.canResetPasswords ?? DEFAULT_MANAGER_PERMISSIONS.canResetPasswords,
    canManageAssignments: user.managerPermissions?.canManageAssignments ?? DEFAULT_MANAGER_PERMISSIONS.canManageAssignments,
    canManageCredits: user.managerPermissions?.canManageCredits ?? DEFAULT_MANAGER_PERMISSIONS.canManageCredits,
  };
}

function resolveViewerPermissions(store: StoreData, viewer: AuthUser): ManagerPermissions {
  const storedViewer = getStoredViewer(store, viewer);
  return getManagerPermissions(storedViewer || viewer);
}

export function getUserAgencyIds(user: Pick<AuthUser, "agencyId">): string[] {
  return user.agencyId ? [user.agencyId] : [];
}

function isWithinViewerAgencyScope(
  viewer: Pick<AuthUser, "agencyId">,
  targetUser: Pick<StoredUser, "agencyId">,
): boolean {
  return Boolean(targetUser.agencyId && getUserAgencyIds(viewer).includes(targetUser.agencyId));
}

export function canManageAssignments(store: StoreData, user: AuthUser): boolean {
  if (isPlatformAdmin(user) || isAgencyAdmin(user)) {
    return true;
  }

  if (isAgencyManager(user)) {
    return resolveViewerPermissions(store, user).canManageAssignments;
  }

  return false;
}

export function canViewUserRecord(viewer: AuthUser, targetUser: StoredUser): boolean {
  if (isPlatformAdmin(viewer)) {
    return true;
  }

  if (isAgencyAdmin(viewer)) {
    return isWithinViewerAgencyScope(viewer, targetUser) && !isPlatformAdmin(targetUser);
  }

  if (isAgencyManager(viewer)) {
    return viewer.id === targetUser.id || (isWithinViewerAgencyScope(viewer, targetUser) && targetUser.role === "USER");
  }

  return viewer.id === targetUser.id;
}

export function canManageScopedUser(
  store: StoreData,
  viewer: AuthUser,
  targetUser: StoredUser,
  action: "rename" | "change-role" | "suspend" | "delete" | "reset-password" | "manage-assignments" | "configure-manager-permissions" = "rename",
): boolean {
  if (isPlatformAdmin(viewer)) {
    if (targetUser.id === viewer.id) {
      return action === "rename";
    }

    return true;
  }

  if (isAgencyAdmin(viewer)) {
    if (!isWithinViewerAgencyScope(viewer, targetUser) || targetUser.id === viewer.id) {
      return false;
    }

    if (action === "configure-manager-permissions") {
      return targetUser.role === "AGENCY_MANAGER";
    }

    if (action === "change-role") {
      return targetUser.role === "USER" || targetUser.role === "AGENCY_MANAGER";
    }

    return targetUser.role === "USER" || targetUser.role === "AGENCY_MANAGER";
  }

  if (isAgencyManager(viewer)) {
    if (!isWithinViewerAgencyScope(viewer, targetUser) || targetUser.id === viewer.id || targetUser.role !== "USER") {
      return false;
    }

    const permissions = resolveViewerPermissions(store, viewer);
    if (action === "suspend") {
      return permissions.canSuspendUsers;
    }

    if (action === "delete") {
      return permissions.canDeleteUsers;
    }

    if (action === "reset-password") {
      return permissions.canResetPasswords;
    }

    if (action === "manage-assignments") {
      return permissions.canManageAssignments;
    }

    return false;
  }

  return false;
}

export function canDeleteTargetUser(store: StoreData, viewer: AuthUser, targetUser: StoredUser): boolean {
  return canManageScopedUser(store, viewer, targetUser, "delete");
}

function canViewAgencyContentOwner(store: StoreData, viewer: AuthUser, ownerId: string): boolean {
  if (isPlatformAdmin(viewer)) {
    return true;
  }

  const owner = store.users.find((entry) => entry.id === ownerId);
  if (!owner) {
    return false;
  }

  if (isAgencyAdmin(viewer)) {
    return isWithinViewerAgencyScope(viewer, owner) && !isPlatformAdmin(owner);
  }

  if (isAgencyManager(viewer)) {
    return isWithinViewerAgencyScope(viewer, owner) && !isPlatformAdmin(owner);
  }

  return owner.id === viewer.id;
}

export function getAgencyAccessibleInfluencerIds(store: StoreData, agencyId: string | null | undefined): Set<string> {
  if (!agencyId) {
    return new Set();
  }

  return getAgencyAccessibleInfluencerIdsForMany(store, [agencyId]);
}

export function getAgencyAccessibleInfluencerIdsForMany(store: StoreData, agencyIds: string[]): Set<string> {
  if (!agencyIds.length) {
    return new Set();
  }

  const scopedAgencyIds = new Set(agencyIds);

  return new Set(
    store.influencerModels
      .filter((model) => model.isActive && model.agencyIds.some((agencyId) => scopedAgencyIds.has(agencyId)))
      .map((model) => model.id),
  );
}

export function getAccessibleInfluencerIds(store: StoreData, user: AuthUser): Set<string> {
  if (isPlatformAdmin(user)) {
    return new Set(store.influencerModels.map((model) => model.id));
  }

  if (isAgencyAdmin(user)) {
    return getAgencyAccessibleInfluencerIdsForMany(store, getUserAgencyIds(user));
  }

  const agencyAccessibleIds = getAgencyAccessibleInfluencerIdsForMany(store, getUserAgencyIds(user));

  return new Set(
    store.modelAccess
      .filter((assignment) => assignment.userId === user.id && agencyAccessibleIds.has(assignment.influencerModelId))
      .map((assignment) => assignment.influencerModelId),
  );
}

export function filterVisibleUsers(store: StoreData, user: AuthUser): StoredUser[] {
  return store.users.filter((targetUser) => canViewUserRecord(user, targetUser));
}

export function assertInfluencerAccess(store: StoreData, user: AuthUser, influencerModelId: string): InfluencerModel {
  const model = store.influencerModels.find((entry) => entry.id === influencerModelId);
  if (!model) {
    throw new Error("Influencer model not found");
  }

  if (!getAccessibleInfluencerIds(store, user).has(influencerModelId)) {
    throw new Error("Forbidden");
  }

  return model;
}

export function assertBoardAccess(store: StoreData, user: AuthUser, boardId: string): WorkspaceBoard {
  const board = store.boards.find((entry) => entry.id === boardId);
  if (!board) {
    throw new Error("Board not found");
  }

  const accessibleIds = getAccessibleInfluencerIds(store, user);
  if (!accessibleIds.has(board.influencerModelId)) {
    throw new Error("Forbidden");
  }

  if (!canViewAgencyContentOwner(store, user, board.ownerId)) {
    throw new Error("Forbidden");
  }

  return board;
}

export function assertBoardEdit(store: StoreData, user: AuthUser, boardId: string): WorkspaceBoard {
  const board = assertBoardAccess(store, user, boardId);
  if (!isPlatformAdmin(user) && !isAgencyAdmin(user) && board.ownerId !== user.id) {
    throw new Error("Only the board owner or an authorized admin can edit this board");
  }
  return board;
}

export function filterBoardsForUser(store: StoreData, user: AuthUser, boards: WorkspaceBoard[]): WorkspaceBoard[] {
  const accessibleIds = getAccessibleInfluencerIds(store, user);
  return boards.filter((board) => {
    if (!accessibleIds.has(board.influencerModelId)) {
      return false;
    }
    return canViewAgencyContentOwner(store, user, board.ownerId);
  });
}

export function filterAssetsForUser(store: StoreData, user: AuthUser, assets: GeneratedAsset[]): GeneratedAsset[] {
  const accessibleIds = getAccessibleInfluencerIds(store, user);
  return assets.filter((asset) => {
    if (!accessibleIds.has(asset.influencerModelId)) {
      return false;
    }
    const board = store.boards.find((entry) => entry.id === asset.boardId);
    return board ? canViewAgencyContentOwner(store, user, board.ownerId) : false;
  });
}