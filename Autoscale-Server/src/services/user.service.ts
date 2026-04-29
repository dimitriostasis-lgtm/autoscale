import { randomBytes, randomUUID } from "node:crypto";

import {
  DEFAULT_AGENCY_BILLING_SETTINGS,
  DEFAULT_MANAGER_PERMISSIONS,
  normalizeAgencyBillingSettings,
} from "../types/domain.js";
import { hashPassword } from "../lib/auth.js";
import { readStore, updateStore } from "../lib/store.js";
import type { AgencyBillingSettings, AuthUser, ManagerPermissions, PlatformNotification, Role, StoreData, StoredUser } from "../types/domain.js";

import {
  canAccessAccountConsole,
  canDeleteTargetUser,
  getAgencyAccessibleInfluencerIdsForMany,
  getUserAgencyIds,
  canManageAccounts,
  canManageAssignments,
  canManageScopedUser,
  filterVisibleUsers,
  isAgencyAdmin,
  isPlatformAdmin,
  requireAuthenticatedUser,
} from "./permissions.service.js";
import { presentAgency, presentUser } from "./presenters.js";

const roleRank: Record<Role, number> = {
  PLATFORM_ADMIN: 0,
  AGENCY_ADMIN: 1,
  AGENCY_MANAGER: 2,
  USER: 3,
};

function assertConsoleAccess(viewer: AuthUser): void {
  if (!canAccessAccountConsole(viewer)) {
    throw new Error("Access denied");
  }
}

function assertPlatformAdmin(viewer: AuthUser): void {
  if (!canManageAccounts(viewer)) {
    throw new Error("Platform admin access required");
  }
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeHandle(value: string): string {
  const trimmed = value.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : "";
}

function normalizeUrlList(values: string[], limit: number): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function normalizeManagerPermissions(value: Partial<ManagerPermissions> | null | undefined): ManagerPermissions {
  return {
    canSuspendUsers: value?.canSuspendUsers ?? DEFAULT_MANAGER_PERMISSIONS.canSuspendUsers,
    canDeleteUsers: value?.canDeleteUsers ?? DEFAULT_MANAGER_PERMISSIONS.canDeleteUsers,
    canResetPasswords: value?.canResetPasswords ?? DEFAULT_MANAGER_PERMISSIONS.canResetPasswords,
    canManageAssignments: value?.canManageAssignments ?? DEFAULT_MANAGER_PERMISSIONS.canManageAssignments,
    canManageCredits: value?.canManageCredits ?? DEFAULT_MANAGER_PERMISSIONS.canManageCredits,
  };
}

function slugifyAgencyName(name: string): string {
  return normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function assertValidScopedAgency(role: Role, agencyId: string | null | undefined): string | null {
  if (role === "PLATFORM_ADMIN") {
    return null;
  }

  if (!agencyId) {
    throw new Error("Agency assignment is required for agency-scoped roles");
  }

  return agencyId;
}

function createTemporaryPassword(): string {
  return `AS-${randomBytes(4).toString("hex")}-${randomBytes(3).toString("hex")}`;
}

function assertAgencyAdminCreateRole(viewer: AuthUser, role: Role, agencyId: string | null): void {
  if (!isAgencyAdmin(viewer)) {
    throw new Error("You do not have permission to create this account");
  }

  if (!viewer.agencyId || viewer.agencyId !== agencyId) {
    throw new Error("Agency admins can only create accounts in their own agency");
  }

  if (role !== "USER" && role !== "AGENCY_MANAGER") {
    throw new Error("Agency admins can only create users and managers");
  }
}

function isRoleAssignableByAgencyAdmin(role: Role): boolean {
  return role === "USER" || role === "AGENCY_MANAGER";
}

function defaultManagerPermissionsForRole(role: Role, current?: Partial<ManagerPermissions> | null): ManagerPermissions | null {
  return role === "AGENCY_MANAGER" ? normalizeManagerPermissions(current) : null;
}

function normalizeManagerAgencyIds(agencies: StoreData["agencies"], primaryAgencyId: string | null): string[] {
  if (!primaryAgencyId) {
    return [];
  }

  const validAgencyIds = new Set(agencies.map((agency) => agency.id));
  return validAgencyIds.has(primaryAgencyId) ? [primaryAgencyId] : [];
}

function removeUsersFromStore(store: StoreData, userIds: string[]): void {
  if (!userIds.length) {
    return;
  }

  const removedUserIds = new Set(userIds);
  const removedBoardIds = new Set(
    store.boards.filter((board) => removedUserIds.has(board.ownerId)).map((board) => board.id),
  );

  store.users = store.users.filter((entry) => !removedUserIds.has(entry.id));
  store.modelAccess = store.modelAccess.filter(
    (assignment) => !removedUserIds.has(assignment.userId) && !removedUserIds.has(assignment.grantedById),
  );
  store.boards = store.boards.filter((board) => !removedUserIds.has(board.ownerId));
  store.assets = store.assets.filter(
    (asset) => !removedUserIds.has(asset.createdById) && !removedBoardIds.has(asset.boardId),
  );
}

export async function listUsers(currentUser: AuthUser | null) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertConsoleAccess(viewer);
  const store = await readStore();

  return filterVisibleUsers(store, viewer)
    .sort((left, right) => {
      const leftAgency = store.agencies.find((agency) => agency.id === left.agencyId)?.name || "";
      const rightAgency = store.agencies.find((agency) => agency.id === right.agencyId)?.name || "";

      return leftAgency.localeCompare(rightAgency) || roleRank[left.role] - roleRank[right.role] || left.name.localeCompare(right.name);
    })
    .map((user) => presentUser(user, store));
}

export async function listAgencies(currentUser: AuthUser | null) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertConsoleAccess(viewer);
  const store = await readStore();
  const visibleUsers = filterVisibleUsers(store, viewer);
  const visibleAgencyIds = new Set(visibleUsers.map((user) => user.agencyId).filter(Boolean));
  for (const agencyId of getUserAgencyIds(viewer)) {
    visibleAgencyIds.add(agencyId);
  }

  return store.agencies
    .filter((agency) => isPlatformAdmin(viewer) || visibleAgencyIds.has(agency.id))
    .map((agency) => presentAgency(agency, store, visibleUsers));
}

export async function createAgency(currentUser: AuthUser | null, name: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);

  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error("Agency name is required");
  }

  const store = await updateStore((current) => {
    if (current.agencies.some((agency) => agency.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error("An agency with this name already exists");
    }

    const baseSlug = slugifyAgencyName(normalizedName) || `agency-${randomUUID().slice(0, 8)}`;
    let slug = baseSlug;
    let suffix = 2;

    while (current.agencies.some((agency) => agency.slug === slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    current.agencies.push({
      id: randomUUID(),
      slug,
      name: normalizedName,
      createdAt: new Date().toISOString(),
      billingSettings: { ...DEFAULT_AGENCY_BILLING_SETTINGS },
    });

    return current;
  });

  const agency = [...store.agencies].reverse().find((entry) => entry.name === normalizedName);
  if (!agency) {
    throw new Error("Failed to create agency");
  }

  return presentAgency(agency, store, filterVisibleUsers(store, viewer));
}

function clampAgencyBillingSettings(input: AgencyBillingSettings): AgencyBillingSettings {
  const normalized = normalizeAgencyBillingSettings(input);
  return {
    monthlySubscriptionPrice: Math.min(999999, normalized.monthlySubscriptionPrice),
    includedMonthlyCredits: Math.min(999999, normalized.includedMonthlyCredits),
    aiInfluencerAllowance: Math.min(999, normalized.aiInfluencerAllowance),
    workspaceTabAllowance: Math.min(999, normalized.workspaceTabAllowance),
    parallelRowGenerations: Math.min(999, normalized.parallelRowGenerations),
    teamSeatAllowance: Math.min(999, normalized.teamSeatAllowance),
  };
}

function presentPlatformNotification(notification: PlatformNotification, store: StoreData) {
  const agency = notification.agencyId ? store.agencies.find((entry) => entry.id === notification.agencyId) || null : null;
  const requester = store.users.find((entry) => entry.id === notification.requesterId) || null;

  return {
    ...notification,
    agencyName: agency?.name || null,
    requesterName: requester?.name || "Unknown user",
    requesterEmail: requester?.email || null,
  };
}

export async function listPlatformNotifications(currentUser: AuthUser | null) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);
  const store = await readStore();

  return [...store.platformNotifications]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((notification) => presentPlatformNotification(notification, store));
}

export async function clearPlatformNotifications(currentUser: AuthUser | null) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);

  await updateStore((current) => {
    current.platformNotifications = [];
    return current;
  });

  return true;
}

export async function requestBillingFollowUp(currentUser: AuthUser | null) {
  const viewer = requireAuthenticatedUser(currentUser);
  const timestamp = new Date().toISOString();

  const store = await updateStore((current) => {
    const agency = viewer.agencyId ? current.agencies.find((entry) => entry.id === viewer.agencyId) || null : null;
    const message = `${viewer.name} requested a billing follow-up${agency ? ` for ${agency.name}` : ""}.`;
    current.platformNotifications.unshift({
      id: randomUUID(),
      type: "BILLING_FOLLOW_UP_REQUEST",
      agencyId: agency?.id || null,
      requesterId: viewer.id,
      message,
      createdAt: timestamp,
    });

    return current;
  });

  const notification = store.platformNotifications.find((entry) => entry.createdAt === timestamp && entry.requesterId === viewer.id);
  if (!notification) {
    throw new Error("Failed to create follow-up notification");
  }

  return presentPlatformNotification(notification, store);
}

export async function requestInfluencerDraft(
  currentUser: AuthUser | null,
  input: {
    name: string;
    handle: string;
    prompt: string;
    portraitImageUrls: string[];
  },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  if (!isAgencyAdmin(viewer) || !viewer.agencyId) {
    throw new Error("Agency admin access required");
  }

  const draftInfluencerName = normalizeName(input.name);
  const draftInfluencerHandle = normalizeHandle(input.handle);
  const draftPrompt = input.prompt.trim();
  const draftPortraitUrls = normalizeUrlList(input.portraitImageUrls, 5);

  if (!draftInfluencerName) {
    throw new Error("Influencer name is required");
  }

  if (!draftInfluencerHandle) {
    throw new Error("Influencer handle is required");
  }

  if (draftPortraitUrls.length < 5) {
    throw new Error("Five portrait examples are required");
  }

  const timestamp = new Date().toISOString();

  const store = await updateStore((current) => {
    const agency = current.agencies.find((entry) => entry.id === viewer.agencyId) || null;
    if (!agency) {
      throw new Error("Agency not found");
    }

    current.platformNotifications.unshift({
      id: randomUUID(),
      type: "INFLUENCER_DRAFT_REQUEST",
      agencyId: agency.id,
      requesterId: viewer.id,
      message: `${viewer.name} submitted an influencer draft for ${draftInfluencerName}.`,
      createdAt: timestamp,
      draftInfluencerName,
      draftInfluencerHandle,
      draftPrompt,
      draftPortraitUrls,
    });

    return current;
  });

  const notification = store.platformNotifications.find((entry) => entry.createdAt === timestamp && entry.requesterId === viewer.id);
  if (!notification) {
    throw new Error("Failed to create influencer draft notification");
  }

  return presentPlatformNotification(notification, store);
}

export async function updateAgencyBillingSettings(
  currentUser: AuthUser | null,
  agencyId: string,
  input: AgencyBillingSettings,
) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);
  const nextSettings = clampAgencyBillingSettings(input);

  const store = await updateStore((current) => {
    const agency = current.agencies.find((entry) => entry.id === agencyId);
    if (!agency) {
      throw new Error("Agency not found");
    }

    agency.billingSettings = nextSettings;
    return current;
  });

  const agency = store.agencies.find((entry) => entry.id === agencyId);
  if (!agency) {
    throw new Error("Agency not found");
  }

  return presentAgency(agency, store, filterVisibleUsers(store, viewer));
}

export async function renameAgency(currentUser: AuthUser | null, agencyId: string, name: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);

  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new Error("Agency name is required");
  }

  const store = await updateStore((current) => {
    const agency = current.agencies.find((entry) => entry.id === agencyId);
    if (!agency) {
      throw new Error("Agency not found");
    }

    if (current.agencies.some((entry) => entry.id !== agencyId && entry.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error("An agency with this name already exists");
    }

    agency.name = normalizedName;
    return current;
  });

  const agency = store.agencies.find((entry) => entry.id === agencyId);
  if (!agency) {
    throw new Error("Agency not found");
  }

  return presentAgency(agency, store, filterVisibleUsers(store, viewer));
}

export async function deleteAgency(currentUser: AuthUser | null, agencyId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);

  await updateStore((current) => {
    const agency = current.agencies.find((entry) => entry.id === agencyId);
    if (!agency) {
      throw new Error("Agency not found");
    }

    const members = current.users.filter((user) => user.agencyId === agencyId && user.role !== "PLATFORM_ADMIN");
    const retainedPlatformAdmins = current.users.filter(
      (user) => user.agencyId === agencyId && user.role === "PLATFORM_ADMIN",
    );
    const removedUserIds = members.map((user) => user.id);

    removeUsersFromStore(current, removedUserIds);
    for (const admin of retainedPlatformAdmins) {
      admin.agencyId = null;
    }
    for (const user of current.users) {
      if (user.role !== "AGENCY_MANAGER") {
        continue;
      }

      user.managedAgencyIds = user.agencyId && user.agencyId !== agencyId ? [user.agencyId] : [];
    }
    for (const model of current.influencerModels) {
      model.agencyIds = model.agencyIds.filter((modelAgencyId) => modelAgencyId !== agencyId);
    }

    current.agencies = current.agencies.filter((entry) => entry.id !== agencyId);
    return current;
  });

  return true;
}

export async function createUser(
  currentUser: AuthUser | null,
  input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    agencyId?: string | null;
    managerPermissions?: ManagerPermissions | null;
    influencerModelIds?: string[] | null;
  },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertConsoleAccess(viewer);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = normalizeName(input.name);

  if (!normalizedName) {
    throw new Error("Account name is required");
  }

  const store = await updateStore(async (current) => {
    if (current.users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
      throw new Error("An account with this email already exists");
    }

    const nextAgencyId = assertValidScopedAgency(input.role, input.agencyId);
    if (nextAgencyId && !current.agencies.some((entry) => entry.id === nextAgencyId)) {
      throw new Error("Agency not found");
    }

    if (!isPlatformAdmin(viewer)) {
      assertAgencyAdminCreateRole(viewer, input.role, nextAgencyId);
    }

    const requestedInfluencerModelIds = input.role === "USER" ? Array.from(new Set(input.influencerModelIds ?? [])) : [];
    const validInfluencerModelIds = new Set(current.influencerModels.map((model) => model.id));
    const cleanedInfluencerModelIds = requestedInfluencerModelIds.filter((id) => validInfluencerModelIds.has(id));

    if (nextAgencyId && cleanedInfluencerModelIds.length) {
      for (const influencerModelId of cleanedInfluencerModelIds) {
        const model = current.influencerModels.find((entry) => entry.id === influencerModelId);
        if (!model) {
          continue;
        }

        if (model.agencyIds.includes(nextAgencyId)) {
          continue;
        }

        if (isPlatformAdmin(viewer) && model.agencyIds.length === 0) {
          model.agencyIds = [nextAgencyId];
          continue;
        }

        throw new Error("One or more influencer models are not enabled for this user's agency");
      }
    }

    const createdUser: StoredUser = {
      id: randomUUID(),
      email: normalizedEmail,
      name: normalizedName,
      role: input.role,
      agencyId: nextAgencyId,
      managedAgencyIds: input.role === "AGENCY_MANAGER" && nextAgencyId ? [nextAgencyId] : [],
      managerPermissions: input.role === "AGENCY_MANAGER" ? normalizeManagerPermissions(input.managerPermissions) : defaultManagerPermissionsForRole(input.role),
      passwordHash: await hashPassword(input.password),
      isActive: true,
      createdAt: new Date().toISOString(),
      lastPasswordResetAt: null,
    };

    current.users.push(createdUser);
    current.modelAccess.push(
      ...cleanedInfluencerModelIds.map((influencerModelId) => ({
        id: randomUUID(),
        userId: createdUser.id,
        influencerModelId,
        grantedById: viewer.id,
        createdAt: new Date().toISOString(),
      })),
    );
    return current;
  });

  const created = store.users.find((user) => user.email.toLowerCase() === normalizedEmail);
  if (!created) {
    throw new Error("Failed to create user");
  }

  return presentUser(created, store);
}

export async function renameUser(currentUser: AuthUser | null, userId: string, name: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertConsoleAccess(viewer);
  const normalizedName = normalizeName(name);

  if (!normalizedName) {
    throw new Error("Account name is required");
  }

  const store = await updateStore((current) => {
    const user = current.users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!canManageScopedUser(current, viewer, user, "rename")) {
      throw new Error("You cannot rename this account");
    }

    user.name = normalizedName;
    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return presentUser(updated, store);
}

export async function updateUserRole(currentUser: AuthUser | null, userId: string, role: Role) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertConsoleAccess(viewer);

  const store = await updateStore((current) => {
    const user = current.users.find((entry) => entry.id === userId);
    if (!user) {
      throw new Error("User not found");
    }

    const previousRole = user.role;

    if (!canManageScopedUser(current, viewer, user, "change-role")) {
      throw new Error("You cannot change the role for this account");
    }

    if (!isPlatformAdmin(viewer) && !isRoleAssignableByAgencyAdmin(role)) {
      throw new Error("Agency admins can only assign user and manager roles");
    }

    user.role = role;

    if (role === "PLATFORM_ADMIN") {
      user.agencyId = null;
      user.managedAgencyIds = [];
      user.managerPermissions = null;
      current.modelAccess = current.modelAccess.filter((assignment) => assignment.userId !== user.id);
      return current;
    }

    if (!user.agencyId || !current.agencies.some((agency) => agency.id === user.agencyId)) {
      if (previousRole === "PLATFORM_ADMIN" && isPlatformAdmin(viewer)) {
        if (role === "AGENCY_ADMIN") {
          user.managedAgencyIds = [];
          user.managerPermissions = null;
          current.modelAccess = current.modelAccess.filter((assignment) => assignment.userId !== user.id);
          return current;
        }

        if (role === "AGENCY_MANAGER") {
          user.managedAgencyIds = [];
          user.managerPermissions = defaultManagerPermissionsForRole(role, user.managerPermissions);
          return current;
        }

        user.managedAgencyIds = [];
        user.managerPermissions = null;
        return current;
      }

      throw new Error("Assign an agency before applying this role");
    }

    if (role === "AGENCY_ADMIN") {
      user.managedAgencyIds = [];
      user.managerPermissions = null;
      current.modelAccess = current.modelAccess.filter((assignment) => assignment.userId !== user.id);
      return current;
    }

    if (role === "AGENCY_MANAGER") {
      user.managedAgencyIds = normalizeManagerAgencyIds(current.agencies, user.agencyId);
      user.managerPermissions = defaultManagerPermissionsForRole(role, user.managerPermissions);
      return current;
    }

    user.managedAgencyIds = [];
    user.managerPermissions = null;
    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return presentUser(updated, store);
}

export async function updateUserOrganization(
  currentUser: AuthUser | null,
  userId: string,
  input: { agencyId?: string | null },
) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertPlatformAdmin(viewer);

  const store = await updateStore((current) => {
    const targetUser = current.users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.role === "PLATFORM_ADMIN") {
      if (input.agencyId) {
        throw new Error("Platform admin accounts cannot be assigned to an agency");
      }

      targetUser.agencyId = null;
      targetUser.managedAgencyIds = [];
      return current;
    }

    if (targetUser.id === viewer.id) {
      throw new Error("You cannot reassign your own account");
    }

    const nextAgencyId = assertValidScopedAgency(targetUser.role, input.agencyId);
    if (!nextAgencyId || !current.agencies.some((entry) => entry.id === nextAgencyId)) {
      throw new Error("Agency not found");
    }

    targetUser.agencyId = nextAgencyId;
    if (targetUser.role === "AGENCY_MANAGER") {
      targetUser.managedAgencyIds = normalizeManagerAgencyIds(current.agencies, nextAgencyId);
      return current;
    }

    targetUser.managedAgencyIds = [];
    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return presentUser(updated, store);
}

export async function updateManagerPermissions(
  currentUser: AuthUser | null,
  userId: string,
  input: ManagerPermissions,
) {
  const viewer = requireAuthenticatedUser(currentUser);
  assertConsoleAccess(viewer);

  const store = await updateStore((current) => {
    const targetUser = current.users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.role !== "AGENCY_MANAGER") {
      throw new Error("Only manager accounts can receive manager permission settings");
    }

    if (!canManageScopedUser(current, viewer, targetUser, "configure-manager-permissions")) {
      throw new Error("You cannot update manager permissions for this account");
    }

    targetUser.managerPermissions = normalizeManagerPermissions(input);
    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return presentUser(updated, store);
}

export async function setUserModelAccess(currentUser: AuthUser | null, userId: string, influencerModelIds: string[]) {
  const viewer = requireAuthenticatedUser(currentUser);
  const store = await updateStore((current) => {
    if (!canManageAssignments(current, viewer)) {
      throw new Error("You do not have permission to manage influencer assignments");
    }

    const targetUser = current.users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.role !== "USER" && targetUser.role !== "AGENCY_MANAGER") {
      throw new Error("Only user and manager accounts can receive direct influencer assignments");
    }

    if (!canManageScopedUser(current, viewer, targetUser, "manage-assignments")) {
      throw new Error("You cannot manage influencer access for this account");
    }

    const validIds = new Set(current.influencerModels.map((model) => model.id));
    const cleanedIds = Array.from(new Set(influencerModelIds)).filter((id) => validIds.has(id));

    const scopedAgencyIds = getUserAgencyIds(targetUser);
    if (scopedAgencyIds.length) {
      const agencyAccessibleIds = getAgencyAccessibleInfluencerIdsForMany(current, scopedAgencyIds);
      if (cleanedIds.some((id) => !agencyAccessibleIds.has(id))) {
        throw new Error("One or more influencer models are not enabled for this user's agency");
      }
    }

    current.modelAccess = current.modelAccess.filter((assignment) => assignment.userId !== userId);
    current.modelAccess.push(
      ...cleanedIds.map((influencerModelId) => ({
        id: randomUUID(),
        userId,
        influencerModelId,
        grantedById: viewer.id,
        createdAt: new Date().toISOString(),
      })),
    );

    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return presentUser(updated, store);
}

export async function setUserActive(currentUser: AuthUser | null, userId: string, isActive: boolean) {
  const viewer = requireAuthenticatedUser(currentUser);

  const store = await updateStore((current) => {
    const targetUser = current.users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (!canManageScopedUser(current, viewer, targetUser, "suspend")) {
      throw new Error("You cannot change the status of this account");
    }

    targetUser.isActive = isActive;
    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return presentUser(updated, store);
}

export async function resetUserPassword(currentUser: AuthUser | null, userId: string) {
  const viewer = requireAuthenticatedUser(currentUser);
  const nextPassword = createTemporaryPassword();

  const store = await updateStore(async (current) => {
    const targetUser = current.users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (!canManageScopedUser(current, viewer, targetUser, "reset-password")) {
      throw new Error("You cannot reset the password for this account");
    }

    targetUser.passwordHash = await hashPassword(nextPassword);
    targetUser.lastPasswordResetAt = new Date().toISOString();
    return current;
  });

  const updated = store.users.find((user) => user.id === userId);
  if (!updated) {
    throw new Error("User not found");
  }

  return {
    user: presentUser(updated, store),
    temporaryPassword: nextPassword,
  };
}

export async function deleteUser(currentUser: AuthUser | null, userId: string) {
  const viewer = requireAuthenticatedUser(currentUser);

  await updateStore((current) => {
    const targetUser = current.users.find((entry) => entry.id === userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (!canDeleteTargetUser(current, viewer, targetUser)) {
      throw new Error("You cannot delete this account");
    }

    removeUsersFromStore(current, [targetUser.id]);
    return current;
  });

  return true;
}
