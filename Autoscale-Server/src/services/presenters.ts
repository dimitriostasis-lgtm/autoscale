import type { Agency, AuthUser, GeneratedAsset, ReferenceSelection, StoreData, StoredUser, WorkspaceBoard, WorkspaceRow } from "../types/domain.js";

import {
  filterAssetsForUser,
  filterBoardsForUser,
  getAccessibleInfluencerIds,
  getUserAgencyIds,
  getUserAccessScope,
  isPlatformAdmin,
} from "./permissions.service.js";

function getVisibleAssignedAgencies(model: StoreData["influencerModels"][number], store: StoreData, viewer: AuthUser) {
  if (isPlatformAdmin(viewer)) {
    return store.agencies.filter((agency) => model.agencyIds.includes(agency.id));
  }

  const viewerAgencyIds = new Set(getUserAgencyIds(viewer));
  if (viewerAgencyIds.size) {
    return store.agencies.filter((agency) => viewerAgencyIds.has(agency.id) && model.agencyIds.includes(agency.id));
  }

  return [];
}

function presentAsset(asset: GeneratedAsset): GeneratedAsset {
  return { ...asset };
}

function presentReference(selection: ReferenceSelection | null, store: StoreData) {
  if (!selection) {
    return null;
  }

  const asset = selection.assetId ? store.assets.find((entry) => entry.id === selection.assetId) || null : null;

  return {
    ...selection,
    asset,
  };
}

function presentRow(row: WorkspaceRow, store: StoreData) {
  return {
    ...row,
    reference: presentReference(row.reference, store),
    audioReference: presentReference(row.audioReference ?? null, store),
    outputAssets: row.outputAssetIds
      .map((assetId) => store.assets.find((asset) => asset.id === assetId))
      .filter((asset): asset is GeneratedAsset => Boolean(asset))
      .map(presentAsset),
  };
}

export function presentBoard(board: WorkspaceBoard, store: StoreData) {
  const owner = store.users.find((entry) => entry.id === board.ownerId) || null;
  return {
    ...board,
    owner: owner ? presentUser(owner, store) : null,
    settings: {
      ...board.settings,
      globalReferences: board.settings.globalReferences.map((selection) => presentReference(selection, store)),
    },
    rows: [...board.rows].sort((left, right) => left.orderIndex - right.orderIndex).map((row) => presentRow(row, store)),
  };
}

export function presentInfluencerModel(modelIdOrSlug: string, store: StoreData, viewer: AuthUser) {
  const model =
    store.influencerModels.find((entry) => entry.id === modelIdOrSlug) ||
    store.influencerModels.find((entry) => entry.slug === modelIdOrSlug);

  if (!model) {
    return null;
  }

  const accessibleIds = getAccessibleInfluencerIds(store, viewer);
  const boards = filterBoardsForUser(store, viewer, store.boards.filter((board) => board.influencerModelId === model.id));
  const assets = filterAssetsForUser(store, viewer, store.assets.filter((asset) => asset.influencerModelId === model.id));
  const visibleAssignedAgencies = getVisibleAssignedAgencies(model, store, viewer);
  const defaultPlatformWorkflowName = model.defaultPlatformWorkflowName?.trim() || "Default platform workflow";
  const platformWorkflowCount = typeof model.platformWorkflowCount === "number" ? Math.max(0, Math.floor(model.platformWorkflowCount)) : 3;
  const customWorkflowCount = typeof model.customWorkflowCount === "number" ? Math.max(0, Math.floor(model.customWorkflowCount)) : 0;

  return {
    ...model,
    defaultPlatformWorkflowName,
    platformWorkflowCount,
    customWorkflowCount,
    canAccess: accessibleIds.has(model.id),
    assignedAgencyIds: visibleAssignedAgencies.map((agency) => agency.id),
    assignedAgencyNames: visibleAssignedAgencies.map((agency) => agency.name),
    agencyAccessCount: visibleAssignedAgencies.length,
    boardCount: boards.length,
    galleryCount: assets.length,
    outputCount: assets.length,
    boards: boards.map((board) => presentBoard(board, store)),
  };
}

export function presentUser(user: StoredUser, store: StoreData) {
  const agency = store.agencies.find((entry) => entry.id === user.agencyId) || null;
  const scopedAgencyIds = getUserAgencyIds(user);
  const managedAgencies = user.role === "AGENCY_MANAGER" && agency ? [agency] : [];
  const assignedModelIds = store.modelAccess
    .filter((assignment) => assignment.userId === user.id)
    .map((assignment) => assignment.influencerModelId)
    .filter((modelId) => {
      const model = store.influencerModels.find((entry) => entry.id === modelId);
      if (!model || !model.isActive) {
        return false;
      }

      if (scopedAgencyIds.length && !model.agencyIds.some((agencyId) => scopedAgencyIds.includes(agencyId))) {
        return false;
      }

      return true;
    });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    agencyId: agency?.id || null,
    agencyName: agency?.name || null,
    managedAgencyIds: user.role === "AGENCY_MANAGER" ? managedAgencies.map((entry) => entry.id) : [],
    managedAgencyNames: user.role === "AGENCY_MANAGER" ? managedAgencies.map((entry) => entry.name) : [],
    managerPermissions: user.role === "AGENCY_MANAGER" ? user.managerPermissions : null,
    accessScope: getUserAccessScope(user),
    assignedModelIds,
    effectiveModelIds: Array.from(getAccessibleInfluencerIds(store, user)),
    lastPasswordResetAt: user.lastPasswordResetAt,
  };
}

export function presentAgency(agency: Agency, store: StoreData, visibleUsers: StoredUser[]) {
  const members = visibleUsers.filter((user) => user.agencyId === agency.id);
  return {
    id: agency.id,
    slug: agency.slug,
    name: agency.name,
    createdAt: agency.createdAt,
    memberCount: members.length,
    adminCount: members.filter((user) => user.role === "AGENCY_ADMIN").length,
    managerCount: members.filter((user) => user.role === "AGENCY_MANAGER").length,
    userCount: members.filter((user) => user.role === "USER").length,
    activeCount: members.filter((user) => user.isActive).length,
  };
}
