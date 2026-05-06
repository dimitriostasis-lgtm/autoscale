import { useQuery, useMutation } from "@apollo/client/react";

import { AccessControlPanel } from "../components/admin/AccessControlPanel";
import { useAuth } from "../context/AuthContext";
import {
  CONNECT_HIGGSFIELD_ACCOUNT_MUTATION,
  DISCONNECT_HIGGSFIELD_ACCOUNT_MUTATION,
  HIGGSFIELD_ACCOUNT_CONNECTIONS_QUERY,
  REFRESH_HIGGSFIELD_ACCOUNT_BALANCE_MUTATION,
} from "../queries/higgsfield";
import {
  CREATE_INFLUENCER_MODEL_MUTATION,
  DELETE_INFLUENCER_MODEL_MUTATION,
  INFLUENCER_MODELS_QUERY,
  SET_INFLUENCER_MODEL_AGENCY_ACCESS_MUTATION,
  UPDATE_INFLUENCER_MODEL_PROFILE_MUTATION,
} from "../queries/model";
import {
  AGENCIES_QUERY,
  CLEAR_PLATFORM_NOTIFICATIONS_MUTATION,
  CREATE_AGENCY_MUTATION,
  CREATE_USER_MUTATION,
  DELETE_AGENCY_MUTATION,
  DELETE_USER_MUTATION,
  PLATFORM_NOTIFICATIONS_QUERY,
  RENAME_AGENCY_MUTATION,
  RENAME_USER_MUTATION,
  RESET_USER_PASSWORD_MUTATION,
  SET_USER_ACTIVE_MUTATION,
  SET_USER_MODEL_ACCESS_MUTATION,
  UPDATE_AGENCY_BILLING_SETTINGS_MUTATION,
  UPDATE_MANAGER_PERMISSIONS_MUTATION,
  UPDATE_USER_ORGANIZATION_MUTATION,
  UPDATE_USER_ROLE_MUTATION,
  USERS_QUERY,
} from "../queries/user";
import type { AgencyBillingSettings, AgencyRecord, HiggsfieldAccountConnection, InfluencerModel, PlatformNotification, UserRecord } from "../types";
import { theme } from "../styles/theme";

interface AdminPageProps {
  currentUser: UserRecord;
  onOpenAgencyInfluencerBuilder: () => void;
}

export function AdminPage({ currentUser, onOpenAgencyInfluencerBuilder }: AdminPageProps) {
  const { refresh: refreshSession } = useAuth();
  const canLoadHiggsfieldConnections = currentUser.role !== "USER";
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
  const { data: notificationsData, refetch: refetchNotifications } = useQuery<{ platformNotifications: PlatformNotification[] }>(
    PLATFORM_NOTIFICATIONS_QUERY,
    {
      fetchPolicy: "cache-and-network",
      pollInterval: 15000,
      skip: currentUser.role !== "PLATFORM_ADMIN",
    },
  );
  const { data: higgsfieldData, refetch: refetchHiggsfieldConnections } = useQuery<{ higgsfieldAccountConnections: HiggsfieldAccountConnection[] }>(
    HIGGSFIELD_ACCOUNT_CONNECTIONS_QUERY,
    {
      fetchPolicy: "cache-and-network",
      pollInterval: 30000,
      skip: !canLoadHiggsfieldConnections,
    },
  );

  const [createAgencyMutation] = useMutation(CREATE_AGENCY_MUTATION);
  const [createUserMutation] = useMutation(CREATE_USER_MUTATION);
  const [renameUserMutation] = useMutation(RENAME_USER_MUTATION);
  const [createInfluencerModelMutation] = useMutation(CREATE_INFLUENCER_MODEL_MUTATION);
  const [updateInfluencerModelProfileMutation] = useMutation(UPDATE_INFLUENCER_MODEL_PROFILE_MUTATION);
  const [deleteInfluencerModelMutation] = useMutation(DELETE_INFLUENCER_MODEL_MUTATION);
  const [setInfluencerModelAgencyAccessMutation] = useMutation(SET_INFLUENCER_MODEL_AGENCY_ACCESS_MUTATION);
  const [renameAgencyMutation] = useMutation(RENAME_AGENCY_MUTATION);
  const [updateAgencyBillingSettingsMutation] = useMutation(UPDATE_AGENCY_BILLING_SETTINGS_MUTATION);
  const [deleteAgencyMutation] = useMutation(DELETE_AGENCY_MUTATION);
  const [updateUserRoleMutation] = useMutation(UPDATE_USER_ROLE_MUTATION);
  const [setUserModelAccessMutation] = useMutation(SET_USER_MODEL_ACCESS_MUTATION);
  const [updateManagerPermissionsMutation] = useMutation(UPDATE_MANAGER_PERMISSIONS_MUTATION);
  const [updateUserOrganizationMutation] = useMutation(UPDATE_USER_ORGANIZATION_MUTATION);
  const [setUserActiveMutation] = useMutation(SET_USER_ACTIVE_MUTATION);
  const [clearPlatformNotificationsMutation] = useMutation(CLEAR_PLATFORM_NOTIFICATIONS_MUTATION);
  const [resetUserPasswordMutation] = useMutation<{ resetUserPassword: { temporaryPassword: string } }>(
    RESET_USER_PASSWORD_MUTATION,
  );
  const [deleteUserMutation] = useMutation(DELETE_USER_MUTATION);
  const [connectHiggsfieldAccountMutation] = useMutation(CONNECT_HIGGSFIELD_ACCOUNT_MUTATION);
  const [refreshHiggsfieldAccountBalanceMutation] = useMutation(REFRESH_HIGGSFIELD_ACCOUNT_BALANCE_MUTATION);
  const [disconnectHiggsfieldAccountMutation] = useMutation(DISCONNECT_HIGGSFIELD_ACCOUNT_MUTATION);

  if (currentUser.role === "USER") {
    return <div className={theme.cardStrong + " glass-panel p-10 text-white/58"}>You do not have access to account management.</div>;
  }

  async function refreshData() {
    await Promise.all([
      refetchUsers(),
      refetchAgencies(),
      refetchModels(),
      currentUser.role === "PLATFORM_ADMIN" ? refetchNotifications() : Promise.resolve(),
      canLoadHiggsfieldConnections ? refetchHiggsfieldConnections() : Promise.resolve(),
    ]);
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
      onClearPlatformNotifications={async () => {
        await clearPlatformNotificationsMutation();
        await refetchNotifications();
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
      higgsfieldConnections={higgsfieldData?.higgsfieldAccountConnections || []}
      onConnectHiggsfieldAccount={async (influencerModelId) => {
        await connectHiggsfieldAccountMutation({ variables: { influencerModelId } });
        await refetchHiggsfieldConnections();
      }}
      onDisconnectHiggsfieldAccount={async (influencerModelId) => {
        await disconnectHiggsfieldAccountMutation({ variables: { influencerModelId } });
        await refetchHiggsfieldConnections();
      }}
      onRefreshHiggsfieldAccount={async (influencerModelId) => {
        await refreshHiggsfieldAccountBalanceMutation({ variables: { influencerModelId } });
        await refetchHiggsfieldConnections();
      }}
      onCreateUser={async (input) => {
        await createUserMutation({ variables: { input } });
        await refreshAll();
      }}
      onDeleteAgency={async (agencyId) => {
        await deleteAgencyMutation({ variables: { agencyId } });
        await refreshAll(true);
      }}
      onUpdateAgencyBillingSettings={async (agencyId, input: AgencyBillingSettings) => {
        await updateAgencyBillingSettingsMutation({ variables: { agencyId, input } });
        await refreshAll();
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
      platformNotifications={notificationsData?.platformNotifications || []}
      users={usersData?.users || []}
    />
  );
}
