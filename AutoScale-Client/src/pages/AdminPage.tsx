import { useQuery, useMutation } from "@apollo/client/react";

import { AccessControlPanel } from "../components/admin/AccessControlPanel";
import { useAuth } from "../context/AuthContext";
import {
  CREATE_INFLUENCER_MODEL_MUTATION,
  DELETE_INFLUENCER_MODEL_MUTATION,
  INFLUENCER_MODELS_QUERY,
  SET_INFLUENCER_MODEL_AGENCY_ACCESS_MUTATION,
  UPDATE_INFLUENCER_MODEL_PROFILE_MUTATION,
} from "../queries/model";
import {
  AGENCIES_QUERY,
  CREATE_AGENCY_MUTATION,
  CREATE_USER_MUTATION,
  DELETE_AGENCY_MUTATION,
  DELETE_USER_MUTATION,
  RENAME_AGENCY_MUTATION,
  RENAME_USER_MUTATION,
  RESET_USER_PASSWORD_MUTATION,
  SET_USER_ACTIVE_MUTATION,
  SET_USER_MODEL_ACCESS_MUTATION,
  UPDATE_MANAGER_PERMISSIONS_MUTATION,
  UPDATE_USER_ORGANIZATION_MUTATION,
  UPDATE_USER_ROLE_MUTATION,
  USERS_QUERY,
} from "../queries/user";
import type { AgencyRecord, InfluencerModel, UserRecord } from "../types";
import { theme } from "../styles/theme";

interface AdminPageProps {
  currentUser: UserRecord;
  onOpenAgencyInfluencerBuilder: () => void;
}

export function AdminPage({ currentUser, onOpenAgencyInfluencerBuilder }: AdminPageProps) {
  const { refresh: refreshSession } = useAuth();
  const { data: usersData, refetch: refetchUsers } = useQuery<{ users: UserRecord[] }>(USERS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const { data: agenciesData, refetch: refetchAgencies } = useQuery<{ agencies: AgencyRecord[] }>(AGENCIES_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const { data: modelsData, refetch: refetchModels } = useQuery<{ influencerModels: InfluencerModel[] }>(INFLUENCER_MODELS_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { includeInactive: currentUser.role === "PLATFORM_ADMIN" },
  });

  const [createAgencyMutation] = useMutation(CREATE_AGENCY_MUTATION);
  const [createUserMutation] = useMutation(CREATE_USER_MUTATION);
  const [renameUserMutation] = useMutation(RENAME_USER_MUTATION);
  const [createInfluencerModelMutation] = useMutation(CREATE_INFLUENCER_MODEL_MUTATION);
  const [updateInfluencerModelProfileMutation] = useMutation(UPDATE_INFLUENCER_MODEL_PROFILE_MUTATION);
  const [deleteInfluencerModelMutation] = useMutation(DELETE_INFLUENCER_MODEL_MUTATION);
  const [setInfluencerModelAgencyAccessMutation] = useMutation(SET_INFLUENCER_MODEL_AGENCY_ACCESS_MUTATION);
  const [renameAgencyMutation] = useMutation(RENAME_AGENCY_MUTATION);
  const [deleteAgencyMutation] = useMutation(DELETE_AGENCY_MUTATION);
  const [updateUserRoleMutation] = useMutation(UPDATE_USER_ROLE_MUTATION);
  const [setUserModelAccessMutation] = useMutation(SET_USER_MODEL_ACCESS_MUTATION);
  const [updateManagerPermissionsMutation] = useMutation(UPDATE_MANAGER_PERMISSIONS_MUTATION);
  const [updateUserOrganizationMutation] = useMutation(UPDATE_USER_ORGANIZATION_MUTATION);
  const [setUserActiveMutation] = useMutation(SET_USER_ACTIVE_MUTATION);
  const [resetUserPasswordMutation] = useMutation<{ resetUserPassword: { temporaryPassword: string } }>(
    RESET_USER_PASSWORD_MUTATION,
  );
  const [deleteUserMutation] = useMutation(DELETE_USER_MUTATION);

  if (currentUser.role === "USER") {
    return <div className={theme.cardStrong + " glass-panel p-10 text-white/58"}>You do not have access to account management.</div>;
  }

  async function refreshData() {
    await Promise.all([refetchUsers(), refetchAgencies(), refetchModels()]);
  }

  async function refreshAll(includeSession = false) {
    if (includeSession) {
      await Promise.all([refreshData(), refreshSession()]);
      return;
    }

    await refreshData();
  }

  return (
    <AccessControlPanel
      agencies={agenciesData?.agencies || []}
      currentUser={currentUser}
      models={modelsData?.influencerModels || []}
      onCreateAgency={async (name) => {
        await createAgencyMutation({ variables: { name } });
        await refreshAll();
      }}
      onCreateInfluencerModel={async (input) => {
        await createInfluencerModelMutation({ variables: { input } });
        await refreshAll();
      }}
      onOpenAgencyInfluencerBuilder={onOpenAgencyInfluencerBuilder}
      onUpdateInfluencerModelProfile={async (influencerModelId, input) => {
        await updateInfluencerModelProfileMutation({ variables: { influencerModelId, input } });
        await refreshAll();
      }}
      onDeleteInfluencerModel={async (influencerModelId) => {
        await deleteInfluencerModelMutation({ variables: { influencerModelId } });
        await refreshAll();
      }}
      onSetInfluencerModelAgencyAccess={async (influencerModelId, agencyIds) => {
        await setInfluencerModelAgencyAccessMutation({ variables: { influencerModelId, agencyIds } });
        await refreshAll();
      }}
      onCreateUser={async (input) => {
        await createUserMutation({ variables: { input } });
        await refreshAll();
      }}
      onDeleteAgency={async (agencyId) => {
        await deleteAgencyMutation({ variables: { agencyId } });
        await refreshAll(true);
      }}
      onDeleteUser={async (userId) => {
        await deleteUserMutation({ variables: { userId } });
        await refreshAll();
      }}
      onRenameAgency={async (agencyId, name) => {
        await renameAgencyMutation({ variables: { agencyId, name } });
        await refreshAll();
      }}
      onRenameUser={async (userId, name) => {
        await renameUserMutation({ variables: { userId, name } });
        await refreshAll(userId === currentUser.id);
      }}
      onResetPassword={async (userId) => {
        const { data } = await resetUserPasswordMutation({ variables: { userId } });
        await refreshAll();
        return data?.resetUserPassword.temporaryPassword || "";
      }}
      onSetUserActive={async (userId, isActive) => {
        await setUserActiveMutation({ variables: { userId, isActive } });
        await refreshAll();
      }}
      onUpdateAssignments={async (userId, influencerModelIds) => {
        await setUserModelAccessMutation({ variables: { userId, influencerModelIds } });
        await refreshAll();
      }}
      onUpdateManagerPermissions={async (userId, input) => {
        await updateManagerPermissionsMutation({ variables: { userId, input } });
        await refreshAll();
      }}
      onUpdateOrganization={async (userId, input) => {
        await updateUserOrganizationMutation({ variables: { userId, input } });
        await refreshAll(userId === currentUser.id);
      }}
      onUpdateRole={async (userId, role) => {
        await updateUserRoleMutation({ variables: { userId, role } });
        await refreshAll(userId === currentUser.id);
      }}
      users={usersData?.users || []}
    />
  );
}