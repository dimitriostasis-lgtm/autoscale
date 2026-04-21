import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AgencyDeleteModal } from "./AgencyDeleteModal";
import { cx } from "../../lib/cx";
import { uploadReferenceFile } from "../../lib/uploads";
import {
  aspectRatioOptions,
  generationModelOptions,
  resolutionOptions,
  theme,
} from "../../styles/theme";
import type { AgencyRecord, InfluencerModel, ManagerPermissions, Role, UserAccessScope, UserRecord } from "../../types";

interface AccessControlPanelProps {
  currentUser: UserRecord;
  agencies: AgencyRecord[];
  users: UserRecord[];
  models: InfluencerModel[];
  onCreateAgency: (name: string) => Promise<void>;
  onRenameAgency: (agencyId: string, name: string) => Promise<void>;
  onDeleteAgency: (agencyId: string) => Promise<void>;
  onCreateUser: (input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    agencyId?: string | null;
  }) => Promise<void>;
  onRenameUser: (userId: string, name: string) => Promise<void>;
  onCreateInfluencerModel: (input: {
    name: string;
    handle: string;
    description: string;
    avatarImageUrl?: string | null;
    allowedGenerationModels: string[];
    defaults: {
      generationModel: string;
      resolution: string;
      aspectRatio: string;
      quantity: number;
      promptPrefix: string;
    };
  }) => Promise<void>;
  onSetInfluencerModelAgencyAccess: (influencerModelId: string, agencyIds: string[]) => Promise<void>;
  onSetInfluencerModelActive: (influencerModelId: string, isActive: boolean) => Promise<void>;
  onUpdateRole: (userId: string, role: Role) => Promise<void>;
  onUpdateAssignments: (userId: string, influencerModelIds: string[]) => Promise<void>;
  onUpdateManagerPermissions: (userId: string, input: ManagerPermissions) => Promise<void>;
  onUpdateOrganization: (userId: string, input: { agencyId?: string | null; managedAgencyIds?: string[] | null }) => Promise<void>;
  onSetUserActive: (userId: string, isActive: boolean) => Promise<void>;
  onResetPassword: (userId: string) => Promise<string>;
  onDeleteUser: (userId: string) => Promise<void>;
}

type Notice = {
  tone: "success" | "error";
  text: string;
};

type AccountDraft = {
  name: string;
  role: Role;
  agencyId: string;
  managedAgencyIds: string[];
  isActive: boolean;
};

type ModelFormState = {
  name: string;
  handle: string;
  description: string;
  avatarImageUrl: string;
  defaults: {
    generationModel: string;
    resolution: string;
    aspectRatio: string;
    quantity: number;
    promptPrefix: string;
  };
};

const defaultManagerPermissions: ManagerPermissions = {
  canSuspendUsers: true,
  canDeleteUsers: false,
  canResetPasswords: false,
  canManageAssignments: false,
};

const influencerCreationDefaults = {
  generationModel: generationModelOptions[0],
  resolution: resolutionOptions[0],
  aspectRatio: aspectRatioOptions[0],
  quantity: 4,
  promptPrefix: "",
};

function normalizeManagerPermissions(value: ManagerPermissions | null | undefined): ManagerPermissions {
  return {
    canSuspendUsers: value?.canSuspendUsers ?? defaultManagerPermissions.canSuspendUsers,
    canDeleteUsers: value?.canDeleteUsers ?? defaultManagerPermissions.canDeleteUsers,
    canResetPasswords: value?.canResetPasswords ?? defaultManagerPermissions.canResetPasswords,
    canManageAssignments: value?.canManageAssignments ?? defaultManagerPermissions.canManageAssignments,
  };
}

function roleLabel(role: Role): string {
  if (role === "PLATFORM_ADMIN") {
    return "Platform Admin";
  }

  if (role === "AGENCY_ADMIN") {
    return "Agency Admin";
  }

  if (role === "AGENCY_MANAGER") {
    return "Agency Manager";
  }

  return "User";
}

function roleBadgeClass(role: Role): string {
  if (role === "PLATFORM_ADMIN") {
    return "border-lime-300/25 bg-lime-300/10 text-lime-100";
  }

  if (role === "AGENCY_ADMIN") {
    return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  }

  if (role === "AGENCY_MANAGER") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  return "border-white/12 bg-white/[0.04] text-white/72";
}

function accessScopeLabel(scope: UserAccessScope): string {
  if (scope === "PLATFORM_ADMIN_ACCESS") {
    return "Platform-wide control";
  }

  if (scope === "AGENCY_ADMIN_ACCESS") {
    return "Agency-wide control";
  }

  if (scope === "AGENCY_MANAGER_ACCESS") {
    return "Manager-scoped agency access";
  }

  return "Direct influencer access";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function toggleId(ids: string[], nextId: string): string[] {
  return ids.includes(nextId) ? ids.filter((id) => id !== nextId) : [...ids, nextId];
}

function sameIdSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function normalizeManagerAgencyDraft(agencyId: string, managedAgencyIds: string[]): string[] {
  if (!agencyId) {
    return [];
  }

  return Array.from(new Set([agencyId, ...managedAgencyIds.filter(Boolean)]));
}

function canPlatformManage(currentUser: UserRecord, targetUser: UserRecord): boolean {
  return currentUser.role === "PLATFORM_ADMIN" && currentUser.id !== targetUser.id;
}

function canPlatformEditOwnProfile(currentUser: UserRecord, targetUser: UserRecord): boolean {
  return currentUser.role === "PLATFORM_ADMIN" && currentUser.id === targetUser.id;
}

function filterEmptyStateCopy(roleFilter: Role | "ALL"): string {
  if (roleFilter === "AGENCY_MANAGER") {
    return "No agency managers match the current filter.";
  }

  if (roleFilter === "AGENCY_ADMIN") {
    return "No agency admins match the current filter.";
  }

  if (roleFilter === "PLATFORM_ADMIN") {
    return "No platform admins match the current filter.";
  }

  if (roleFilter === "USER") {
    return "No users match the current filter.";
  }

  return "No accounts match the current filter.";
}

function canAgencyAdminManage(currentUser: UserRecord, targetUser: UserRecord): boolean {
  if (currentUser.role !== "AGENCY_ADMIN") {
    return false;
  }

  if (currentUser.id === targetUser.id || currentUser.agencyId !== targetUser.agencyId) {
    return false;
  }

  return targetUser.role === "USER" || targetUser.role === "AGENCY_MANAGER";
}

function canManagerManageUser(currentUser: UserRecord, targetUser: UserRecord, permission: keyof ManagerPermissions): boolean {
  if (currentUser.role !== "AGENCY_MANAGER") {
    return false;
  }

  if (currentUser.id === targetUser.id || currentUser.agencyId !== targetUser.agencyId || targetUser.role !== "USER") {
    return false;
  }

  return normalizeManagerPermissions(currentUser.managerPermissions)[permission];
}

function getRoleOptions(currentUser: UserRecord): Array<{ value: Role; label: string }> {
  if (currentUser.role === "PLATFORM_ADMIN") {
    return [
      { value: "USER", label: "User" },
      { value: "AGENCY_MANAGER", label: "Agency Manager" },
      { value: "AGENCY_ADMIN", label: "Agency Admin" },
      { value: "PLATFORM_ADMIN", label: "Platform Admin" },
    ];
  }

  return [
    { value: "USER", label: "User" },
    { value: "AGENCY_MANAGER", label: "Agency Manager" },
  ];
}

export function AccessControlPanel({
  currentUser,
  agencies,
  users,
  models,
  onCreateAgency,
  onRenameAgency,
  onDeleteAgency,
  onCreateUser,
  onRenameUser,
  onCreateInfluencerModel,
  onSetInfluencerModelAgencyAccess,
  onSetInfluencerModelActive,
  onUpdateRole,
  onUpdateAssignments,
  onUpdateManagerPermissions,
  onUpdateOrganization,
  onSetUserActive,
  onResetPassword,
  onDeleteUser,
}: AccessControlPanelProps) {
  const isPlatformAdmin = currentUser.role === "PLATFORM_ADMIN";
  const isAgencyAdmin = currentUser.role === "AGENCY_ADMIN";
  const canCreateAccounts = isPlatformAdmin || isAgencyAdmin;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentUser.id);
  const [temporaryPassword, setTemporaryPassword] = useState<{ userId: string; value: string } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState("");
  const [agencyDrafts, setAgencyDrafts] = useState<Record<string, string>>({});
  const [agencyPendingDeletionId, setAgencyPendingDeletionId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER" as Role,
    agencyId: isAgencyAdmin ? currentUser.agencyId || "" : agencies[0]?.id || "",
  });
  const [modelForm, setModelForm] = useState<ModelFormState>({
    name: "",
    handle: "",
    description: "",
    avatarImageUrl: "",
    defaults: { ...influencerCreationDefaults },
  });
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);
  const [managerPermissionDraft, setManagerPermissionDraft] = useState<ManagerPermissions>(defaultManagerPermissions);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(models[0]?.id || null);
  const [influencerAgencyDraft, setInfluencerAgencyDraft] = useState<string[]>([]);
  const [influencerActiveDraft, setInfluencerActiveDraft] = useState(true);

  const roleOptions = getRoleOptions(currentUser);

  useEffect(() => {
    setAgencyDrafts((current) => {
      const next = { ...current };
      for (const agency of agencies) {
        if (!next[agency.id]) {
          next[agency.id] = agency.name;
        }
      }
      return next;
    });
  }, [agencies]);

  useEffect(() => {
    if (isAgencyAdmin) {
      setCreateForm((current) => {
        const nextRole = current.role === "PLATFORM_ADMIN" || current.role === "AGENCY_ADMIN" ? "USER" : current.role;
        const nextAgencyId = currentUser.agencyId || "";

        if (current.role === nextRole && current.agencyId === nextAgencyId) {
          return current;
        }

        return { ...current, agencyId: nextAgencyId, role: nextRole };
      });
      return;
    }

    if (createForm.role !== "PLATFORM_ADMIN" && !createForm.agencyId && agencies[0]) {
      setCreateForm((current) => ({ ...current, agencyId: agencies[0]?.id || "" }));
    }
  }, [agencies, createForm.agencyId, createForm.role, currentUser.agencyId, isAgencyAdmin]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${user.name} ${user.email} ${user.agencyName || ""} ${user.managedAgencyNames.join(" ")}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [roleFilter, search, users]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }

    const selectedExists = Boolean(selectedUserId && users.some((user) => user.id === selectedUserId));

    if (!selectedExists) {
      setSelectedUserId(filteredUsers[0]?.id || users.find((user) => user.id === currentUser.id)?.id || users[0]?.id || null);
      return;
    }

    if (filteredUsers.length > 0 && !filteredUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [currentUser.id, filteredUsers, selectedUserId, users]);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ||
    filteredUsers[0] ||
    users.find((user) => user.id === currentUser.id) ||
    users[0] ||
    null;

  useEffect(() => {
    if (!selectedUser) {
      setAccountDraft(null);
      setAssignmentDraft([]);
      setManagerPermissionDraft(defaultManagerPermissions);
      return;
    }

    setAccountDraft({
      name: selectedUser.name,
      role: selectedUser.role,
      agencyId: selectedUser.agencyId || "",
      managedAgencyIds: normalizeManagerAgencyDraft(selectedUser.agencyId || "", selectedUser.managedAgencyIds),
      isActive: selectedUser.isActive,
    });
    setAssignmentDraft(selectedUser.assignedModelIds);
    setManagerPermissionDraft(normalizeManagerPermissions(selectedUser.managerPermissions));
    setTemporaryPassword((current) => (current?.userId === selectedUser.id ? current : null));
  }, [selectedUser]);

  useEffect(() => {
    if (!models.length) {
      setSelectedInfluencerId(null);
      return;
    }

    if (!selectedInfluencerId || !models.some((model) => model.id === selectedInfluencerId)) {
      setSelectedInfluencerId(models[0].id);
    }
  }, [models, selectedInfluencerId]);

  const selectedInfluencer = models.find((model) => model.id === selectedInfluencerId) || models[0] || null;

  useEffect(() => {
    if (!selectedInfluencer) {
      setInfluencerAgencyDraft([]);
      setInfluencerActiveDraft(true);
      return;
    }

    setInfluencerAgencyDraft(selectedInfluencer.assignedAgencyIds);
    setInfluencerActiveDraft(selectedInfluencer.isActive);
  }, [selectedInfluencer]);

  const groupedUsers = useMemo(() => {
    const agencyGroups = agencies
      .map((agency) => ({
        id: agency.id,
        label: agency.name,
        members: filteredUsers.filter((user) => user.agencyId === agency.id),
      }))
      .filter((entry) => entry.members.length > 0);

    const unassignedUsers = filteredUsers.filter((user) => !user.agencyId);
    if (unassignedUsers.length) {
      agencyGroups.unshift({
        id: "platform-wide",
        label: "Platform-wide",
        members: unassignedUsers,
      });
    }

    return agencyGroups;
  }, [agencies, filteredUsers]);

  const totalGalleryAssets = useMemo(() => models.reduce((sum, model) => sum + model.galleryCount, 0), [models]);
  const assignableModels = useMemo(() => models.filter((model) => model.isActive), [models]);
  const agencyPendingDeletion = agencies.find((agency) => agency.id === agencyPendingDeletionId) || null;
  const agencyPendingDeletionUsers = useMemo(
    () =>
      agencyPendingDeletion
        ? users.filter((user) => user.agencyId === agencyPendingDeletion.id && user.role !== "PLATFORM_ADMIN")
        : [],
    [agencyPendingDeletion, users],
  );
  const agencyPendingDeletionPlatformAdmins = useMemo(
    () =>
      agencyPendingDeletion
        ? users.filter((user) => user.agencyId === agencyPendingDeletion.id && user.role === "PLATFORM_ADMIN")
        : [],
    [agencyPendingDeletion, users],
  );

  async function executeAction<T>(
    action: () => Promise<T>,
    successText?: string,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    try {
      const result = await action();
      if (successText) {
        setNotice({ tone: "success", text: successText });
      }
      return { ok: true, value: result };
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Something went wrong",
      });
      return { ok: false };
    }
  }

  if (!selectedUser || !accountDraft) {
    return <div className={theme.cardStrong + " glass-panel p-10 text-white/58"}>No visible accounts.</div>;
  }

  const selectedCanPlatformManage = canPlatformManage(currentUser, selectedUser);
  const selectedCanEditOwnProfile = canPlatformEditOwnProfile(currentUser, selectedUser);
  const selectedCanAgencyAdminManage = canAgencyAdminManage(currentUser, selectedUser);
  const canRenameSelected = selectedCanPlatformManage || selectedCanAgencyAdminManage || selectedCanEditOwnProfile;
  const canChangeRole = selectedCanPlatformManage || selectedCanAgencyAdminManage;
  const canChangeAgency = selectedCanPlatformManage || selectedCanEditOwnProfile;
  const canResetSelectedPassword =
    selectedCanPlatformManage ||
    selectedCanAgencyAdminManage ||
    canManagerManageUser(currentUser, selectedUser, "canResetPasswords");
  const canToggleSelectedStatus =
    selectedCanPlatformManage ||
    selectedCanAgencyAdminManage ||
    canManagerManageUser(currentUser, selectedUser, "canSuspendUsers");
  const canDeleteSelected =
    selectedCanPlatformManage ||
    selectedCanAgencyAdminManage ||
    canManagerManageUser(currentUser, selectedUser, "canDeleteUsers");
  const canEditAssignments =
    (selectedCanPlatformManage || selectedCanAgencyAdminManage) &&
      (selectedUser.role === "USER" || selectedUser.role === "AGENCY_MANAGER") ||
    canManagerManageUser(currentUser, selectedUser, "canManageAssignments");
  const canEditManagerPermissions =
    selectedUser.role === "AGENCY_MANAGER" && (selectedCanPlatformManage || selectedCanAgencyAdminManage);
      const nextScopedAgencyId = accountDraft.agencyId || "";
  const nextManagedAgencyIds =
    accountDraft.role === "AGENCY_MANAGER"
      ? normalizeManagerAgencyDraft(accountDraft.agencyId, accountDraft.managedAgencyIds)
      : [];
  const selectedManagedAgencyIds =
    selectedUser.role === "AGENCY_MANAGER"
      ? normalizeManagerAgencyDraft(selectedUser.agencyId || "", selectedUser.managedAgencyIds)
      : [];
  const hasManagerAgencyChanges =
    isPlatformAdmin && accountDraft.role === "AGENCY_MANAGER" && !sameIdSet(nextManagedAgencyIds, selectedManagedAgencyIds);
  const hasPendingAccountChanges =
    (canRenameSelected && normalizeText(accountDraft.name) !== selectedUser.name) ||
    (canChangeRole && accountDraft.role !== selectedUser.role) ||
    (canChangeAgency && nextScopedAgencyId !== (selectedUser.agencyId || "")) ||
    hasManagerAgencyChanges ||
    (canToggleSelectedStatus && accountDraft.isActive !== selectedUser.isActive);
  const hasAssignmentChanges =
    assignmentDraft.length !== selectedUser.assignedModelIds.length ||
    assignmentDraft.some((id) => !selectedUser.assignedModelIds.includes(id));
  const normalizedSelectedManagerPermissions = normalizeManagerPermissions(selectedUser.managerPermissions);
  const hasManagerPermissionChanges =
    canEditManagerPermissions &&
    (managerPermissionDraft.canSuspendUsers !== normalizedSelectedManagerPermissions.canSuspendUsers ||
      managerPermissionDraft.canDeleteUsers !== normalizedSelectedManagerPermissions.canDeleteUsers ||
      managerPermissionDraft.canResetPasswords !== normalizedSelectedManagerPermissions.canResetPasswords ||
      managerPermissionDraft.canManageAssignments !== normalizedSelectedManagerPermissions.canManageAssignments);
  const hasInfluencerAvailabilityChanges =
    Boolean(selectedInfluencer) &&
    (influencerActiveDraft !== selectedInfluencer.isActive || !sameIdSet(influencerAgencyDraft, selectedInfluencer.assignedAgencyIds));

  async function handleCreateAgency(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextName = normalizeText(newAgencyName);
    if (!nextName) {
      setNotice({ tone: "error", text: "Agency name is required" });
      return;
    }

    const result = await executeAction(() => onCreateAgency(nextName), `Created ${nextName}.`);
    if (result.ok) {
      setNewAgencyName("");
    }
  }

  async function handleRenameAgency(agency: AgencyRecord): Promise<void> {
    const nextName = normalizeText(agencyDrafts[agency.id] || "");
    if (!nextName) {
      setNotice({ tone: "error", text: "Agency name is required" });
      return;
    }

    if (nextName === agency.name) {
      return;
    }

    await executeAction(() => onRenameAgency(agency.id, nextName), `Renamed ${agency.name} to ${nextName}.`);
  }

  async function handleDeleteAgency(agency: AgencyRecord): Promise<void> {
    setAgencyPendingDeletionId(agency.id);
  }

  async function confirmDeleteAgency(): Promise<void> {
    if (!agencyPendingDeletion) {
      return;
    }

    const result = await executeAction(
      () => onDeleteAgency(agencyPendingDeletion.id),
      `Deleted ${agencyPendingDeletion.name}.`,
    );

    if (result.ok) {
      setAgencyPendingDeletionId(null);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextName = normalizeText(createForm.name);
    if (!nextName) {
      setNotice({ tone: "error", text: "Account name is required" });
      return;
    }

    const nextAgencyId = createForm.role === "PLATFORM_ADMIN" ? null : createForm.agencyId || null;
    if (createForm.role !== "PLATFORM_ADMIN" && !nextAgencyId) {
      setNotice({ tone: "error", text: "Select an agency for agency-scoped roles." });
      return;
    }

    const result = await executeAction(
      () =>
        onCreateUser({
          name: nextName,
          email: createForm.email.trim(),
          password: createForm.password,
          role: createForm.role,
          agencyId: nextAgencyId,
        }),
      `Created ${nextName}.`,
    );

    if (result.ok) {
      setCreateForm({
        name: "",
        email: "",
        password: "",
        role: "USER",
        agencyId: isAgencyAdmin ? currentUser.agencyId || "" : agencies[0]?.id || "",
      });
    }
  }

  async function handleApplyAccount(): Promise<void> {
    if (!hasPendingAccountChanges || !accountDraft) {
      return;
    }

    const nextName = normalizeText(accountDraft.name);
    const nextRole = accountDraft.role;
    const nextAgencyId = accountDraft.agencyId || null;

    const result = await executeAction(async () => {
      if (canRenameSelected && nextName !== selectedUser.name) {
        await onRenameUser(selectedUser.id, nextName);
      }

      if (canChangeRole && nextRole !== selectedUser.role) {
        if (nextRole === "PLATFORM_ADMIN") {
          await onUpdateRole(selectedUser.id, nextRole);
        } else if (nextRole === "AGENCY_MANAGER") {
          if (selectedUser.role === "PLATFORM_ADMIN") {
            await onUpdateRole(selectedUser.id, nextRole);
            await onUpdateOrganization(selectedUser.id, {
              agencyId: nextAgencyId,
              managedAgencyIds: nextManagedAgencyIds,
            });
          } else {
            if (canChangeAgency) {
              if (!nextAgencyId) {
                throw new Error("Agency assignment is required for this role");
              }

              if (nextAgencyId !== selectedUser.agencyId) {
                await onUpdateOrganization(selectedUser.id, { agencyId: nextAgencyId });
              }
            }

            await onUpdateRole(selectedUser.id, nextRole);
            await onUpdateOrganization(selectedUser.id, {
              agencyId: nextAgencyId,
              managedAgencyIds: nextManagedAgencyIds,
            });
          }
        } else {
          if (selectedUser.role === "PLATFORM_ADMIN") {
            await onUpdateRole(selectedUser.id, nextRole);

            if (canChangeAgency) {
              if (!nextAgencyId) {
                throw new Error("Agency assignment is required for this role");
              }

              await onUpdateOrganization(selectedUser.id, { agencyId: nextAgencyId });
            }
          } else {
            if (canChangeAgency) {
              if (!nextAgencyId) {
                throw new Error("Agency assignment is required for this role");
              }

              if (nextAgencyId !== selectedUser.agencyId) {
                await onUpdateOrganization(selectedUser.id, { agencyId: nextAgencyId });
              }
            }

            await onUpdateRole(selectedUser.id, nextRole);
          }
        }
      } else if ((canChangeAgency || hasManagerAgencyChanges) && nextRole !== "PLATFORM_ADMIN") {
          if (!nextAgencyId) {
            throw new Error("Agency assignment is required for this role");
          }

          if (nextRole === "AGENCY_MANAGER") {
            if (nextAgencyId !== selectedUser.agencyId || hasManagerAgencyChanges) {
              await onUpdateOrganization(selectedUser.id, {
                agencyId: nextAgencyId,
                managedAgencyIds: nextManagedAgencyIds,
              });
            }
          } else if (nextAgencyId !== selectedUser.agencyId) {
            await onUpdateOrganization(selectedUser.id, { agencyId: nextAgencyId });
          }
      }

      if (canToggleSelectedStatus && accountDraft.isActive !== selectedUser.isActive) {
        await onSetUserActive(selectedUser.id, accountDraft.isActive);
      }
    }, `Applied settings for ${selectedUser.name}.`);

    if (result.ok) {
      setTemporaryPassword(null);
    }
  }

  async function handleApplyAssignments(): Promise<void> {
    if (!canEditAssignments || !hasAssignmentChanges) {
      return;
    }

    await executeAction(() => onUpdateAssignments(selectedUser.id, assignmentDraft), `Updated influencer access for ${selectedUser.name}.`);
  }

  async function handleApplyManagerPermissions(): Promise<void> {
    if (!canEditManagerPermissions || !hasManagerPermissionChanges) {
      return;
    }

    await executeAction(
      () => onUpdateManagerPermissions(selectedUser.id, managerPermissionDraft),
      `Updated manager permissions for ${selectedUser.name}.`,
    );
  }

  async function handleResetPassword(): Promise<void> {
    const password = await executeAction(() => onResetPassword(selectedUser.id), `Reset password for ${selectedUser.name}.`);
    if (password.ok && typeof password.value === "string") {
      setTemporaryPassword({ userId: selectedUser.id, value: password.value });
    }
  }

  async function handleDeleteUser(): Promise<void> {
    if (!canDeleteSelected) {
      return;
    }

    if (!window.confirm(`Delete ${selectedUser.name}? This removes their boards and generated assets.`)) {
      return;
    }

    const result = await executeAction(() => onDeleteUser(selectedUser.id), `Deleted ${selectedUser.name}.`);
    if (result.ok) {
      setSelectedUserId(null);
    }
  }

  async function handleCreateInfluencer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const result = await executeAction(
      () =>
        onCreateInfluencerModel({
          name: normalizeText(modelForm.name),
          handle: modelForm.handle.trim(),
          description: modelForm.description.trim(),
          avatarImageUrl: modelForm.avatarImageUrl || null,
          allowedGenerationModels: [...generationModelOptions],
          defaults: { ...modelForm.defaults, promptPrefix: modelForm.defaults.promptPrefix.trim() },
        }),
      `Added ${normalizeText(modelForm.name)}.`,
    );

    if (result.ok) {
      setModelForm({
        name: "",
        handle: "",
        description: "",
        avatarImageUrl: "",
        defaults: { ...influencerCreationDefaults },
      });
    }
  }

  async function handleApplyInfluencerAvailability(): Promise<void> {
    if (!selectedInfluencer || !hasInfluencerAvailabilityChanges) {
      return;
    }

    await executeAction(async () => {
      if (influencerActiveDraft !== selectedInfluencer.isActive) {
        await onSetInfluencerModelActive(selectedInfluencer.id, influencerActiveDraft);
      }

      if (!sameIdSet(influencerAgencyDraft, selectedInfluencer.assignedAgencyIds)) {
        await onSetInfluencerModelAgencyAccess(selectedInfluencer.id, influencerAgencyDraft);
      }
    }, `Updated ${selectedInfluencer.name}.`);
  }

  async function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const uploaded = await uploadReferenceFile(file);
      setModelForm((current) => ({ ...current, avatarImageUrl: uploaded.url }));
      setNotice({ tone: "success", text: `Uploaded ${file.name}.` });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to upload image",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={cx(
            "rounded-3xl border px-5 py-4 text-sm",
            notice.tone === "success"
              ? "border-lime-300/25 bg-lime-300/10 text-lime-100"
              : "border-rose-400/25 bg-rose-400/10 text-rose-100",
          )}
        >
          {notice.text}
        </div>
      ) : null}

      {isPlatformAdmin ? (
        <section className={theme.cardStrong + " glass-panel overflow-hidden p-0"}>
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7">
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Overview</p>
            <h2 className="font-display mt-2 text-3xl text-white">Platform summary</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">
              A tighter, cleaner view of the model library, agency roster, and published gallery output volume.
            </p>
          </div>

          <div className="grid gap-px bg-white/8 lg:grid-cols-[1.05fr_1.2fr_0.95fr]">
            <div className="bg-[linear-gradient(180deg,rgba(199,255,39,0.08),rgba(13,16,22,0.94))] px-6 py-6 sm:px-7 sm:py-7">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Influencer Models</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{models.length}</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">
                Profiles currently available to structure workspace generation, gallery output, and agency-level availability.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {models.slice(0, 4).map((model) => (
                  <span key={model.id} className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/70">
                    {model.handle}
                  </span>
                ))}
                {models.length > 4 ? (
                  <span className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/48">
                    +{models.length - 4} more
                  </span>
                ) : null}
              </div>
            </div>

            <div className="bg-[rgba(12,15,20,0.96)] px-6 py-6 sm:px-7 sm:py-7">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agencies</p>
              <div className="mt-5 space-y-3">
                {agencies.map((agency) => (
                  <div key={agency.id} className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{agency.name}</p>
                      <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/56">
                        {new Date(agency.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(10,12,17,0.96))] px-6 py-6 sm:px-7 sm:py-7">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Gallery Outputs</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{totalGalleryAssets}</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">
                Generated assets currently available across the internal gallery surface for review, download, and reuse.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <section className={theme.cardStrong + " glass-panel p-6 sm:p-7"}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Directory</p>
              <h2 className="font-display mt-2 text-3xl text-white">Who can see and do what</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
                Role boundaries stay strict here: platform-wide control is separate from agency-scoped access, and only platform admins can extend a manager across more than one agency.
              </p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-white/44">Visible accounts</p>
              <p className="mt-2 text-3xl font-semibold text-white">{filteredUsers.length}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px]">
            <input
              className={theme.input}
              placeholder="Search name, email, or agency"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className={theme.input} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | "ALL")}>
              <option value="ALL">All roles</option>
              <option value="PLATFORM_ADMIN">Platform admins</option>
              <option value="AGENCY_ADMIN">Agency admins</option>
              <option value="AGENCY_MANAGER">Agency managers</option>
              <option value="USER">Users</option>
            </select>
          </div>

          <div className="mt-6 space-y-4">
            {groupedUsers.length ? (
              groupedUsers.map((group) => (
                <div key={group.id} className="rounded-[26px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{group.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                        {group.members.filter((member) => member.role === "AGENCY_ADMIN").length} agency admins / {group.members.filter((member) => member.role === "AGENCY_MANAGER").length} managers / {group.members.filter((member) => member.role === "USER").length} users
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                      {group.members.length} accounts
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.members.map((user) => {
                      const active = user.id === selectedUser.id;
                      return (
                        <button
                          key={user.id}
                          className={cx(
                            "w-full rounded-3xl border px-4 py-4 text-left transition",
                            active
                              ? "border-lime-300/35 bg-lime-300/12"
                              : "border-white/8 bg-black/16 hover:border-white/14 hover:bg-white/[0.04]",
                          )}
                          onClick={() => setSelectedUserId(user.id)}
                          type="button"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{user.name}</p>
                              <p className="mt-1 text-sm text-white/56">{user.email}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cx("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", roleBadgeClass(user.role))}>
                                {roleLabel(user.role)}
                              </span>
                              <span
                                className={cx(
                                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                                  user.isActive ? "bg-lime-300/12 text-lime-200" : "bg-white/[0.06] text-white/46",
                                )}
                              >
                                {user.isActive ? "Active" : "Suspended"}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-white/58">{accessScopeLabel(user.accessScope)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-white/54">
                {filterEmptyStateCopy(roleFilter)}
              </div>
            )}
          </div>
        </section>

        <section className={theme.cardStrong + " glass-panel p-6 sm:p-7"}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Account</p>
              <h2 className="font-display mt-2 text-3xl text-white">Selected account interface</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
                Platform admins can operate globally, agency admins stay inside their agency, and managers only receive the specific user-management actions granted to them.
              </p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-white/44">Access scope</p>
              <p className="mt-2 text-sm font-semibold text-white">{accessScopeLabel(selectedUser.accessScope)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Email</p>
              <p className="mt-2 text-sm font-semibold text-white">{selectedUser.email}</p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Last password reset</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatTimestamp(selectedUser.lastPasswordResetAt)}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-[28px] border border-white/8 bg-black/14 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-white/80">Account name</span>
                <input
                  className={theme.input}
                  disabled={!canRenameSelected}
                  value={accountDraft.name}
                  onChange={(event) => setAccountDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white/80">Role</span>
                <select
                  className={theme.input}
                  disabled={!canChangeRole}
                  value={accountDraft.role}
                  onChange={(event) =>
                    setAccountDraft((current) =>
                      current
                        ? {
                            ...current,
                            role: event.target.value as Role,
                            agencyId:
                              event.target.value === "PLATFORM_ADMIN"
                                ? ""
                                : current.agencyId || currentUser.agencyId || agencies[0]?.id || "",
                            managedAgencyIds:
                              event.target.value === "AGENCY_MANAGER"
                                ? normalizeManagerAgencyDraft(
                                    current.agencyId || currentUser.agencyId || agencies[0]?.id || "",
                                    current.managedAgencyIds,
                                  )
                                : [],
                          }
                        : current,
                    )
                  }
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white/80">Agency</span>
                <select
                  className={theme.input}
                  disabled={!canChangeAgency || accountDraft.role === "PLATFORM_ADMIN"}
                  value={accountDraft.agencyId}
                  onChange={(event) =>
                    setAccountDraft((current) =>
                      current
                        ? {
                            ...current,
                            agencyId: event.target.value,
                            managedAgencyIds:
                              current.role === "AGENCY_MANAGER"
                                ? normalizeManagerAgencyDraft(event.target.value, current.managedAgencyIds)
                                : current.managedAgencyIds,
                          }
                        : current,
                    )
                  }
                >
                  <option value="">No agency</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </label>

              {accountDraft.role === "PLATFORM_ADMIN" ? (
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58 sm:col-span-2">
                  Platform admin accounts always remain global and cannot be linked to a specific agency.
                </div>
              ) : null}

              {isPlatformAdmin && accountDraft.role === "AGENCY_MANAGER" ? (
                <div className="space-y-3 rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Manager agency access</p>
                      <p className="mt-2 text-sm leading-7 text-white/56">
                        The primary agency above is always included. Add any additional agencies this manager should be allowed to operate in.
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                      {nextManagedAgencyIds.length} linked
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {agencies.map((agency) => {
                      const isPrimary = agency.id === accountDraft.agencyId;
                      const selected = nextManagedAgencyIds.includes(agency.id);
                      return (
                        <button
                          key={agency.id}
                          className={cx(
                            "rounded-3xl border px-4 py-4 text-left transition",
                            selected
                              ? "border-lime-300/35 bg-lime-300/12"
                              : "border-white/8 bg-black/18 hover:border-white/14 hover:bg-white/[0.04]",
                            isPrimary ? "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-lime-300/35 disabled:hover:bg-lime-300/12" : "",
                          )}
                          disabled={isPrimary}
                          onClick={() =>
                            setAccountDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    managedAgencyIds: toggleId(current.managedAgencyIds, agency.id),
                                  }
                                : current,
                            )
                          }
                          type="button"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{agency.name}</p>
                              <p className="mt-1 text-sm text-white/54">
                                {agency.adminCount} admins / {agency.managerCount} managers / {agency.userCount} users
                              </p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                              {isPrimary ? "Primary" : selected ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white/80">Status</span>
                <select
                  className={theme.input}
                  disabled={!canToggleSelectedStatus}
                  value={accountDraft.isActive ? "ACTIVE" : "SUSPENDED"}
                  onChange={(event) =>
                    setAccountDraft((current) => (current ? { ...current, isActive: event.target.value === "ACTIVE" } : current))
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </label>

              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Created</p>
                <p className="mt-2 text-sm font-semibold text-white">{formatTimestamp(selectedUser.createdAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className={theme.buttonPrimary} disabled={!hasPendingAccountChanges} onClick={() => void handleApplyAccount()} type="button">
                Apply settings
              </button>
              <button className={theme.buttonSecondary} disabled={!canResetSelectedPassword} onClick={() => void handleResetPassword()} type="button">
                Reset password
              </button>
            </div>

            {temporaryPassword?.userId === selectedUser.id ? (
              <div className="rounded-3xl border border-lime-300/25 bg-lime-300/10 px-4 py-4 text-sm text-lime-100">
                Temporary password: <span className="font-semibold text-lime-50">{temporaryPassword.value}</span>
              </div>
            ) : null}

            {!canRenameSelected && !canChangeRole && !canToggleSelectedStatus ? (
              <p className="text-sm leading-7 text-white/52">
                This account is visible to you, but structural changes are outside your current role boundary.
              </p>
            ) : null}
          </div>

          {selectedUser.role === "AGENCY_MANAGER" ? (
            <div className="mt-6 rounded-[28px] border border-white/8 bg-black/14 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Manager permissions</p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56">
                    These toggles control whether a manager can suspend users, delete users, reset passwords, or manage influencer assignments for users inside the agencies assigned to them.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["canSuspendUsers", "Can suspend users"],
                  ["canDeleteUsers", "Can delete users"],
                  ["canResetPasswords", "Can reset passwords"],
                  ["canManageAssignments", "Can manage influencer assignments"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className={cx(
                      "flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/72",
                      !canEditManagerPermissions && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span>{label}</span>
                    <input
                      checked={managerPermissionDraft[key as keyof ManagerPermissions]}
                      className={!canEditManagerPermissions ? "cursor-not-allowed" : undefined}
                      disabled={!canEditManagerPermissions}
                      onChange={(event) =>
                        setManagerPermissionDraft((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button className={theme.buttonPrimary} disabled={!canEditManagerPermissions || !hasManagerPermissionChanges} onClick={() => void handleApplyManagerPermissions()} type="button">
                  Apply manager permissions
                </button>
                {!canEditManagerPermissions ? (
                  <p className="text-sm text-white/48">Only platform admins and the agency admin for this manager’s agency can edit these permissions.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-[28px] border border-white/8 bg-black/14 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Influencer access</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56">
                  Users and managers receive direct influencer assignments. Platform admins and agency admins inherit broader access from their role and do not use assignment cards.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                {selectedUser.assignedModelIds.length} direct assignments
              </span>
            </div>

            {selectedUser.role === "USER" || selectedUser.role === "AGENCY_MANAGER" ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {assignableModels.map((model) => {
                    const selected = assignmentDraft.includes(model.id);
                    return (
                      <button
                        key={model.id}
                        className={cx(
                          "rounded-3xl border px-4 py-4 text-left transition",
                          selected
                            ? "border-lime-300/35 bg-lime-300/12"
                            : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                          !canEditAssignments && "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-white/8 disabled:hover:bg-white/[0.03]",
                        )}
                        disabled={!canEditAssignments}
                        onClick={() => canEditAssignments && setAssignmentDraft((current) => toggleId(current, model.id))}
                        type="button"
                      >
                        <p className="font-semibold text-white">{model.name}</p>
                        <p className="mt-1 text-sm uppercase tracking-[0.18em] text-white/46">{model.handle}</p>
                      </button>
                    );
                  })}
                </div>

                {!assignableModels.length ? (
                  <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
                    No active influencer models are currently available for direct assignment.
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button className={theme.buttonPrimary} disabled={!canEditAssignments || !hasAssignmentChanges} onClick={() => void handleApplyAssignments()} type="button">
                    Apply influencer access
                  </button>
                  {!canEditAssignments ? (
                    <p className="text-sm text-white/48">Only platform admins, agency admins, or managers with assignment control can update these access grants.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
                {selectedUser.role === "PLATFORM_ADMIN"
                  ? "Platform admins can access the full influencer model library across the platform."
                  : "Agency admins can work across their agency boundary without individual influencer assignment cards."}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[28px] border border-rose-400/18 bg-rose-400/8 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-rose-100">Delete account</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-rose-100/70">
                  Account deletion stays bound to your role. Platform admins can delete globally, agency admins can delete managers and users in their own agency, and managers can only delete users in their assigned agencies if that specific permission has been enabled.
                </p>
              </div>
              <button className={theme.buttonDanger} disabled={!canDeleteSelected} onClick={() => void handleDeleteUser()} type="button">
                Delete account
              </button>
            </div>
            {!canDeleteSelected ? (
              <p className="mt-4 text-sm text-rose-100/62">
                You can review this account, but deleting it is outside your current permission boundary.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {isPlatformAdmin ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <section className={theme.cardStrong + " glass-panel p-6"}>
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agencies</p>
            <h3 className="font-display mt-2 text-2xl text-white">Agency settings</h3>
            <p className="mt-3 text-sm leading-7 text-white/56">
              Platform admins can create, rename, and remove agencies. Deleting an agency permanently deletes every account, board, assignment, and generated output inside it.
            </p>

            <form className="mt-5 space-y-3" onSubmit={handleCreateAgency}>
              <input className={theme.input} placeholder="Create a new agency" value={newAgencyName} onChange={(event) => setNewAgencyName(event.target.value)} />
              <button className={theme.buttonPrimary + " w-full"} type="submit">
                Create agency
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {agencies.map((agency) => (
                <div key={agency.id} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{agency.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                        {agency.adminCount} agency admins / {agency.managerCount} managers / {agency.userCount} users
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                      {agency.memberCount} members
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      className={theme.input}
                      value={agencyDrafts[agency.id] || ""}
                      onChange={(event) => setAgencyDrafts((current) => ({ ...current, [agency.id]: event.target.value }))}
                    />
                    <div className="rounded-2xl border border-rose-400/18 bg-rose-400/10 p-3 text-sm leading-7 text-rose-100/78">
                      {(() => {
                        const agencyScopedMembers = users.filter(
                          (user) => user.agencyId === agency.id && user.role !== "PLATFORM_ADMIN",
                        );
                        const retainedAdmins = users.filter(
                          (user) => user.agencyId === agency.id && user.role === "PLATFORM_ADMIN",
                        );

                        return (
                          <>
                            Deleting this agency also deletes all {agencyScopedMembers.length} agency-scoped account{agencyScopedMembers.length === 1 ? "" : "s"} in it, plus their boards, influencer assignments, and generated outputs.
                            {retainedAdmins.length
                              ? ` ${retainedAdmins.length} platform admin${retainedAdmins.length === 1 ? " is" : "s are"} retained and detached from the agency instead of being deleted.`
                              : ""}
                            {currentUser.agencyId === agency.id && currentUser.role === "PLATFORM_ADMIN"
                              ? " Your current platform admin account will be detached from this agency, not deleted."
                              : currentUser.agencyId === agency.id
                                ? " Your current account is part of this agency."
                                : ""}
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button className={theme.buttonSecondary} onClick={() => void handleRenameAgency(agency)} type="button">
                        Rename agency
                      </button>
                      <button className={theme.buttonDanger} onClick={() => void handleDeleteAgency(agency)} type="button">
                        Delete agency
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {canCreateAccounts ? (
            <section className={theme.cardStrong + " glass-panel p-6"}>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Provisioning</p>
              <h3 className="font-display mt-2 text-2xl text-white">Create platform accounts</h3>
              <p className="mt-3 text-sm leading-7 text-white/56">
                Platform admins can create any role. Agency admins can create users and managers inside their own agency only.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleCreateUser}>
                <input className={theme.input} placeholder="Full name" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
                <input className={theme.input} placeholder="Email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
                <input className={theme.input} placeholder="Temporary password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} />

                <select
                  className={theme.input}
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: event.target.value as Role,
                      agencyId:
                        event.target.value === "PLATFORM_ADMIN"
                          ? ""
                          : isAgencyAdmin
                            ? currentUser.agencyId || ""
                            : current.agencyId || agencies[0]?.id || "",
                    }))
                  }
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className={theme.input}
                  disabled={createForm.role === "PLATFORM_ADMIN" || isAgencyAdmin}
                  value={createForm.role === "PLATFORM_ADMIN" ? "" : createForm.agencyId}
                  onChange={(event) => setCreateForm((current) => ({ ...current, agencyId: event.target.value }))}
                >
                  <option value="">Select agency</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>

                {isAgencyAdmin ? (
                  <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/62">
                    New accounts will be created inside {currentUser.agencyName || "your agency"}.
                  </div>
                ) : null}

                <button className={theme.buttonPrimary + " w-full"} type="submit">
                  Create account
                </button>
              </form>
            </section>
          ) : null}

          <section className={theme.cardStrong + " glass-panel p-6"}>
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Influencers</p>
            <h3 className="font-display mt-2 text-2xl text-white">Influencer profile setup</h3>
            <p className="mt-3 text-sm leading-7 text-white/56">
              Only the platform administrator can create and manage AI influencer models. Every new profile ships with the full generation toolset by default, while agency availability is controlled here and updates access immediately for agency admins.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreateInfluencer}>
              <input className={theme.input} placeholder="Influencer name" value={modelForm.name} onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))} />
              <input className={theme.input} placeholder="@handle" value={modelForm.handle} onChange={(event) => setModelForm((current) => ({ ...current, handle: event.target.value }))} />

              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Profile image</p>
                    <p className="mt-1 text-sm text-white/54">Upload directly from your device.</p>
                  </div>
                  <button className={theme.buttonSecondary} disabled={isUploadingAvatar} onClick={() => fileInputRef.current?.click()} type="button">
                    {isUploadingAvatar ? "Uploading..." : "Upload image"}
                  </button>
                </div>
                <input ref={fileInputRef} accept="image/*" className="hidden" onChange={(event) => void handleProfileImageChange(event)} type="file" />

                {modelForm.avatarImageUrl ? (
                  <div className="mt-4 overflow-hidden rounded-3xl border border-white/8 bg-black/20">
                    <img alt="Influencer profile preview" className="h-40 w-full object-cover" src={modelForm.avatarImageUrl} />
                  </div>
                ) : null}
              </div>

              <textarea
                className={theme.input + " min-h-32 resize-y"}
                placeholder="Short profile description"
                value={modelForm.description}
                onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))}
              />

              <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
                Influencer generation defaults are now managed on the backend, so model-selection and prompt-prefix setup are no longer exposed here.
              </div>

              <button className={theme.buttonPrimary + " w-full"} type="submit">
                Add influencer
              </button>
            </form>

            <div className="mt-8 border-t border-white/8 pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Agency availability and control</p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56">
                    Assign each influencer to the agencies allowed to use it. Removing an agency here immediately removes agency-admin access and cleans stale direct assignments for that agency.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/44">Library</p>
                  <p className="mt-2 text-sm font-semibold text-white">{models.length} influencer models</p>
                </div>
              </div>

              {models.length ? (
                <>
                  <div className="mt-5 space-y-3">
                    {models.map((model) => {
                      const active = model.id === selectedInfluencer?.id;
                      return (
                        <button
                          key={model.id}
                          className={cx(
                            "w-full rounded-3xl border px-4 py-4 text-left transition",
                            active
                              ? "border-lime-300/35 bg-lime-300/12"
                              : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                          )}
                          onClick={() => setSelectedInfluencerId(model.id)}
                          type="button"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{model.name}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/46">{model.handle}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cx(
                                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                                  model.isActive ? "bg-lime-300/12 text-lime-200" : "bg-white/[0.06] text-white/46",
                                )}
                              >
                                {model.isActive ? "Live" : "Hidden"}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                                {model.agencyAccessCount} agenc{model.agencyAccessCount === 1 ? "y" : "ies"}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-white/56">
                            {model.assignedAgencyNames.length ? model.assignedAgencyNames.join(" • ") : "Not assigned to any agency yet."}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedInfluencer ? (
                    <div className="mt-5 rounded-[28px] border border-white/8 bg-black/14 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{selectedInfluencer.name}</p>
                          <p className="mt-2 text-sm leading-7 text-white/56">
                            {selectedInfluencer.description || "No description provided yet."}
                          </p>
                        </div>
                        <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/44">Usage</p>
                          <p className="mt-2 text-sm font-semibold text-white">{selectedInfluencer.boardCount} boards / {selectedInfluencer.galleryCount} outputs</p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Agency assignment</p>
                            <p className="mt-2 text-sm leading-7 text-white/56">
                              Agency admins only receive this influencer after their agency is enabled here.
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                            {influencerAgencyDraft.length} enabled
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {agencies.map((agency) => {
                            const selected = influencerAgencyDraft.includes(agency.id);
                            const scopedMembers = agency.adminCount + agency.managerCount + agency.userCount;
                            return (
                              <button
                                key={agency.id}
                                className={cx(
                                  "rounded-3xl border px-4 py-4 text-left transition",
                                  selected
                                    ? "border-lime-300/35 bg-lime-300/12"
                                    : "border-white/8 bg-black/18 hover:border-white/14 hover:bg-white/[0.04]",
                                )}
                                onClick={() => setInfluencerAgencyDraft((current) => toggleId(current, agency.id))}
                                type="button"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{agency.name}</p>
                                    <p className="mt-1 text-sm text-white/54">{scopedMembers} agency-scoped accounts</p>
                                  </div>
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                                    {selected ? "Enabled" : "Disabled"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button className={theme.buttonPrimary} disabled={!hasInfluencerAvailabilityChanges} onClick={() => void handleApplyInfluencerAvailability()} type="button">
                          Apply influencer settings
                        </button>
                        <p className="text-sm text-white/48">
                          Platform admins retain global access regardless of agency assignment.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/54">
                  Create an influencer model first, then assign it to the agencies that should be allowed to use it.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isAgencyAdmin ? (
        <section className={theme.cardStrong + " glass-panel p-6"}>
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">Provisioning</p>
          <h3 className="font-display mt-2 text-2xl text-white">Create agency accounts</h3>
          <p className="mt-3 text-sm leading-7 text-white/56">
            Agency admins can create users and managers in their own agency only. Agency creation and influencer-model management remain platform-admin-only.
          </p>

          <form className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_220px]" onSubmit={handleCreateUser}>
            <input className={theme.input} placeholder="Full name" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
            <input className={theme.input} placeholder="Email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
            <input className={theme.input} placeholder="Temporary password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} />
            <div className="space-y-4">
              <select className={theme.input} value={createForm.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as Role }))}>
                <option value="USER">User</option>
                <option value="AGENCY_MANAGER">Agency Manager</option>
              </select>
              <button className={theme.buttonPrimary + " w-full"} type="submit">
                Create account
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <AgencyDeleteModal
        affectedUsers={agencyPendingDeletionUsers}
        agency={agencyPendingDeletion}
        currentUser={currentUser}
        onClose={() => setAgencyPendingDeletionId(null)}
        onConfirm={confirmDeleteAgency}
        open={Boolean(agencyPendingDeletion)}
        retainedPlatformAdmins={agencyPendingDeletionPlatformAdmins}
      />
    </div>
  );
}