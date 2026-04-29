import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AgencyDeleteModal } from "./AgencyDeleteModal";
import { ProfileImageCropModal } from "./ProfileImageCropModal";
import { agencyBillingPlan, defaultAgencyBillingSettings } from "../../lib/billing";
import { cx } from "../../lib/cx";
import { uploadReferenceFile } from "../../lib/uploads";
import { InfluencerAvatar } from "../model/InfluencerAvatar";
import {
  aspectRatioOptions,
  generationModelOptions,
  resolutionOptions,
  theme,
} from "../../styles/theme";
import type { AgencyBillingSettings, AgencyRecord, GeneratedAsset, InfluencerModel, ManagerPermissions, PlatformNotification, Role, UserAccessScope, UserRecord } from "../../types";

interface AccessControlPanelProps {
  currentUser: UserRecord;
  agencies: AgencyRecord[];
  platformNotifications: PlatformNotification[];
  users: UserRecord[];
  models: InfluencerModel[];
  onCreateAgency: (name: string) => Promise<void>;
  onRenameAgency: (agencyId: string, name: string) => Promise<void>;
  onDeleteAgency: (agencyId: string) => Promise<void>;
  onUpdateAgencyBillingSettings: (agencyId: string, input: AgencyBillingSettings) => Promise<void>;
  onClearPlatformNotifications: () => Promise<void>;
  onCreateUser: (input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    agencyId?: string | null;
    managerPermissions?: ManagerPermissions | null;
    influencerModelIds?: string[] | null;
  }) => Promise<void>;
  onRenameUser: (userId: string, name: string) => Promise<void>;
  onUpdateRole: (userId: string, role: Role) => Promise<void>;
  onCreateInfluencerModel: (input: {
    name: string;
    handle: string;
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
  onOpenAgencyInfluencerBuilder: () => void;
  onUpdateInfluencerModelProfile: (influencerModelId: string, input: {
    name: string;
    handle: string;
    avatarImageUrl?: string | null;
  }) => Promise<void>;
  onDeleteInfluencerModel: (influencerModelId: string) => Promise<void>;
  onSetInfluencerModelAgencyAccess: (influencerModelId: string, agencyIds: string[]) => Promise<void>;
  onUpdateAssignments: (userId: string, influencerModelIds: string[]) => Promise<void>;
  onUpdateManagerPermissions: (userId: string, input: ManagerPermissions) => Promise<void>;
  onUpdateOrganization: (userId: string, input: { agencyId?: string | null }) => Promise<void>;
  onSetUserActive: (userId: string, isActive: boolean) => Promise<void>;
  onResetPassword: (userId: string) => Promise<string>;
  onDeleteUser: (userId: string) => Promise<void>;
}

type NoticePlacement =
  | "global"
  | "agencyCreditPolicy"
  | "agencySettings"
  | "agencyBillingSettings"
  | "createAccount"
  | "accountSettings"
  | "managerPermissions"
  | "influencerAccess"
  | "deleteAccount"
  | "createInfluencer"
  | "influencerProfile"
  | "deleteInfluencer"
  | "influencerOwnership";

type Notice = {
  tone: "success" | "error";
  text: string;
  placement: NoticePlacement;
};

type AccountDraft = {
  name: string;
  role: Role;
  agencyId: string;
  isActive: boolean;
};

type ModelFormState = {
  name: string;
  handle: string;
  avatarImageUrl: string;
  defaults: {
    generationModel: string;
    resolution: string;
    aspectRatio: string;
    quantity: number;
    promptPrefix: string;
  };
};

type ModelProfileDraft = Pick<ModelFormState, "avatarImageUrl" | "handle" | "name">;

type AvatarCropTarget = "create" | "edit";

type CreditAccessMode = "AGENCY_POOL" | "USER_ALLOCATION";

type AgencyBillingSettingsDraft = Record<keyof AgencyBillingSettings, string>;

type PlatformAgencySort = "NAME" | "INFLUENCER_USAGE" | "ACCOUNTS";

type AgencySettingsSort = "NAME" | "MEMBERS" | "ACTIVE" | "ADMINS";

type SalesRange = "WEEK" | "MONTH" | "QUARTER" | "YTD";

type SalesSnapshot = {
  label: string;
  title: string;
  dateLabel: string;
  total: number;
  changeLabel: string;
  renewalSales: number;
  creditSales: number;
  upgradeSales: number;
  averageOrderValue: number;
  paidAgencies: number;
  chartPoints: Array<{ label: string; value: number }>;
};

type SalesChartSourcePoint = SalesSnapshot["chartPoints"][number];

type SalesChartPoint = SalesChartSourcePoint & {
  x: number;
  y: number;
};

type SalesChartGeometry = {
  width: number;
  height: number;
  chartMax: number;
  plotTop: number;
  plotRight: number;
  plotBottom: number;
  plotLeft: number;
  plotWidth: number;
  plotHeight: number;
  points: SalesChartPoint[];
  yTicks: Array<{ value: number; y: number }>;
  linePath: string;
  areaPath: string;
};

type SalesSourceSegment = {
  label: string;
  value: number;
  fill: string;
  softFill: string;
};

type StoredAgencyCreditPolicy = {
  mode: CreditAccessMode;
  allocations: Record<string, string>;
};

const creditPolicyStorageKeyPrefix = "autoscale-agency-credit-policy";

const defaultManagerPermissions: ManagerPermissions = {
  canSuspendUsers: true,
  canDeleteUsers: false,
  canResetPasswords: false,
  canManageAssignments: false,
  canManageCredits: false,
};

const managerPermissionOptions: Array<{ key: keyof ManagerPermissions; label: string }> = [
  { key: "canSuspendUsers", label: "Can suspend users" },
  { key: "canDeleteUsers", label: "Can delete users" },
  { key: "canResetPasswords", label: "Can reset passwords" },
  { key: "canManageAssignments", label: "Can manage influencer assignments" },
  { key: "canManageCredits", label: "Can manage agency credits" },
];

const sectionHeaderGlowStyle = {
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--accent-main) 16%, transparent) 0%, transparent 52%), linear-gradient(180deg, rgba(255,255,255,0.045), transparent 100%)",
};

const influencerCreationDefaults = {
  generationModel: generationModelOptions[0],
  resolution: resolutionOptions[0],
  aspectRatio: aspectRatioOptions[0],
  quantity: 4,
  promptPrefix: "",
};

const salesRangeOptions: Array<{ value: SalesRange; label: string }> = [
  { value: "WEEK", label: "This week" },
  { value: "MONTH", label: "This month" },
  { value: "QUARTER", label: "Quarter" },
  { value: "YTD", label: "Year to date" },
];

const platformSalesSnapshots: Record<SalesRange, SalesSnapshot> = {
  WEEK: {
    label: "Weekly sales",
    title: "This week",
    dateLabel: "Apr 19 - Apr 25, 2026",
    total: 86240,
    changeLabel: "+12.8% vs previous week",
    renewalSales: 52900,
    creditSales: 18340,
    upgradeSales: 15000,
    averageOrderValue: 8624,
    paidAgencies: 7,
    chartPoints: [
      { label: "Mon", value: 9200 },
      { label: "Tue", value: 11800 },
      { label: "Wed", value: 13250 },
      { label: "Thu", value: 9400 },
      { label: "Fri", value: 17640 },
      { label: "Sat", value: 14600 },
      { label: "Sun", value: 10350 },
    ],
  },
  MONTH: {
    label: "Monthly sales",
    title: "This month",
    dateLabel: "April 2026",
    total: 350520,
    changeLabel: "+18.4% vs March",
    renewalSales: 214000,
    creditSales: 82520,
    upgradeSales: 54000,
    averageOrderValue: 15933,
    paidAgencies: 18,
    chartPoints: [
      { label: "Week 1", value: 68120 },
      { label: "Week 2", value: 81400 },
      { label: "Week 3", value: 94750 },
      { label: "Week 4", value: 106250 },
    ],
  },
  QUARTER: {
    label: "Quarterly sales",
    title: "Last 90 days",
    dateLabel: "Feb 1 - Apr 25, 2026",
    total: 918760,
    changeLabel: "+9.6% vs previous 90 days",
    renewalSales: 575400,
    creditSales: 211860,
    upgradeSales: 131500,
    averageOrderValue: 21875,
    paidAgencies: 31,
    chartPoints: [
      { label: "Feb", value: 248900 },
      { label: "Mar", value: 319340 },
      { label: "Apr", value: 350520 },
    ],
  },
  YTD: {
    label: "Year-to-date sales",
    title: "Year to date",
    dateLabel: "Jan 1 - Apr 25, 2026",
    total: 1968420,
    changeLabel: "+22.1% vs same period last year",
    renewalSales: 1268800,
    creditSales: 441620,
    upgradeSales: 258000,
    averageOrderValue: 24128,
    paidAgencies: 42,
    chartPoints: [
      { label: "Jan", value: 469220 },
      { label: "Feb", value: 401880 },
      { label: "Mar", value: 746800 },
      { label: "Apr", value: 350520 },
    ],
  },
};

function normalizeManagerPermissions(value: ManagerPermissions | null | undefined): ManagerPermissions {
  return {
    canSuspendUsers: value?.canSuspendUsers ?? defaultManagerPermissions.canSuspendUsers,
    canDeleteUsers: value?.canDeleteUsers ?? defaultManagerPermissions.canDeleteUsers,
    canResetPasswords: value?.canResetPasswords ?? defaultManagerPermissions.canResetPasswords,
    canManageAssignments: value?.canManageAssignments ?? defaultManagerPermissions.canManageAssignments,
    canManageCredits: value?.canManageCredits ?? defaultManagerPermissions.canManageCredits,
  };
}

function estimateAssetCreditCost(asset: Pick<GeneratedAsset, "isSyntheticFailure">): number {
  return asset.isSyntheticFailure ? 0 : 1;
}

function formatCreditCount(value: number | null | undefined): string {
  const normalizedValue = Math.max(0, Number(value) || 0);
  return `${normalizedValue.toLocaleString()} credit${normalizedValue === 1 ? "" : "s"}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }

  return formatCurrency(value);
}

function getNiceChartStep(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalizedValue = value / magnitude;

  if (normalizedValue <= 1) {
    return magnitude;
  }

  if (normalizedValue <= 2) {
    return 2 * magnitude;
  }

  if (normalizedValue <= 2.5) {
    return 2.5 * magnitude;
  }

  if (normalizedValue <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function buildSalesChartGeometry(chartPoints: SalesChartSourcePoint[]): SalesChartGeometry {
  const width = 760;
  const height = 340;
  const plotTop = 34;
  const plotRight = 30;
  const plotBottom = 264;
  const plotLeft = 78;
  const tickCount = 5;
  const maxValue = Math.max(...chartPoints.map((point) => point.value), 1);
  const tickStep = getNiceChartStep(maxValue / tickCount);
  const chartMax = tickStep * tickCount;
  const plotWidth = Math.max(1, width - plotLeft - plotRight);
  const plotHeight = plotBottom - plotTop;
  const denominator = Math.max(chartPoints.length - 1, 1);
  const points = chartPoints.map((point, index) => {
    const x = plotLeft + (plotWidth * index) / denominator;
    const y = plotBottom - (point.value / chartMax) * plotHeight;
    return { ...point, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const firstPoint = points[0] ?? { x: plotLeft, y: plotBottom };
  const lastPoint = points[points.length - 1] ?? firstPoint;
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${plotBottom} L ${firstPoint.x.toFixed(2)} ${plotBottom} Z`;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = chartMax - tickStep * index;
    const y = plotTop + (plotHeight * index) / tickCount;
    return { value, y };
  });

  return { width, height, chartMax, plotTop, plotRight, plotBottom, plotLeft, plotWidth, plotHeight, points, yTicks, linePath, areaPath };
}

function getSalesSourceSegments(snapshot: SalesSnapshot): SalesSourceSegment[] {
  return [
    {
      label: "Renewals",
      value: snapshot.renewalSales,
      fill: "var(--accent-main)",
      softFill: "color-mix(in srgb, var(--accent-main) 18%, transparent)",
    },
    {
      label: "Credits",
      value: snapshot.creditSales,
      fill: "rgb(14 165 233)",
      softFill: "rgba(14, 165, 233, 0.14)",
    },
    {
      label: "Upgrades",
      value: snapshot.upgradeSales,
      fill: "rgb(217 70 239)",
      softFill: "rgba(217, 70, 239, 0.14)",
    },
  ];
}

function getClampedSalesBarX(pointX: number, barWidth: number, chart: SalesChartGeometry): number {
  const minX = chart.plotLeft + 8;
  const maxX = chart.width - chart.plotRight - barWidth - 8;
  return Math.max(minX, Math.min(pointX - barWidth / 2, maxX));
}

function buildSalesChartPaths(points: SalesChartPoint[], plotBottom: number): Pick<SalesChartGeometry, "areaPath" | "linePath"> {
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const firstPoint = points[0] ?? { x: 0, y: plotBottom };
  const lastPoint = points[points.length - 1] ?? firstPoint;
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${plotBottom} L ${firstPoint.x.toFixed(2)} ${plotBottom} Z`;

  return { areaPath, linePath };
}

function parseCreditAmount(value: string | undefined): number {
  return Math.max(0, Number(value) || 0);
}

function clampCreditAmount(value: string | undefined, maxCredits: number): number {
  return Math.min(parseCreditAmount(value), Math.max(0, maxCredits));
}

function buildAgencyBillingSettingsDraft(settings: AgencyBillingSettings): AgencyBillingSettingsDraft {
  return {
    monthlySubscriptionPrice: String(settings.monthlySubscriptionPrice),
    includedMonthlyCredits: String(settings.includedMonthlyCredits),
    aiInfluencerAllowance: String(settings.aiInfluencerAllowance),
    workspaceTabAllowance: String(settings.workspaceTabAllowance),
    parallelRowGenerations: String(settings.parallelRowGenerations),
    teamSeatAllowance: String(settings.teamSeatAllowance),
  };
}

function normalizeAgencyBillingSettingsDraft(draft: AgencyBillingSettingsDraft): AgencyBillingSettings {
  return {
    monthlySubscriptionPrice: Math.max(0, Number(draft.monthlySubscriptionPrice) || 0),
    includedMonthlyCredits: Math.max(0, Number(draft.includedMonthlyCredits) || 0),
    aiInfluencerAllowance: Math.max(0, Number(draft.aiInfluencerAllowance) || 0),
    workspaceTabAllowance: Math.max(0, Number(draft.workspaceTabAllowance) || 0),
    parallelRowGenerations: Math.max(0, Number(draft.parallelRowGenerations) || 0),
    teamSeatAllowance: Math.max(0, Number(draft.teamSeatAllowance) || 0),
  };
}

function resolveAgencyBillingSettings(agency: AgencyRecord | null | undefined): AgencyBillingSettings {
  return agency?.billingSettings ?? defaultAgencyBillingSettings;
}

function resolveCreditPolicyStorageKey(agencyId: string): string {
  return `${creditPolicyStorageKeyPrefix}:${agencyId}`;
}

function readStoredAgencyCreditPolicy(agencyId: string): StoredAgencyCreditPolicy | null {
  if (!agencyId || typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(resolveCreditPolicyStorageKey(agencyId));
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredAgencyCreditPolicy>;
    const mode = parsedValue.mode === "USER_ALLOCATION" ? "USER_ALLOCATION" : "AGENCY_POOL";
    const allocations =
      parsedValue.allocations && typeof parsedValue.allocations === "object" && !Array.isArray(parsedValue.allocations)
        ? Object.fromEntries(
            Object.entries(parsedValue.allocations).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {};

    return { mode, allocations };
  } catch {
    return null;
  }
}

function writeStoredAgencyCreditPolicy(agencyId: string, policy: StoredAgencyCreditPolicy): void {
  if (!agencyId || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(resolveCreditPolicyStorageKey(agencyId), JSON.stringify(policy));
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
    return "Single-agency manager access";
  }

  return "Direct model access";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildProfileInitials(name: string): string {
  const parts = normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || "").join("").slice(0, 2) || "AI";
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

function AccessNotice({ notice }: { notice: Notice }) {
  return (
    <div
      className={cx(
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        notice.tone === "success"
          ? "border-lime-300/25 bg-lime-300/10 text-lime-100"
          : "border-rose-400/25 bg-rose-400/10 text-rose-100",
      )}
    >
      {notice.text}
    </div>
  );
}

function resolveUserAgencyIds(user: Pick<UserRecord, "agencyId">): string[] {
  return user.agencyId ? [user.agencyId] : [];
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
  platformNotifications,
  users,
  models,
  onCreateAgency,
  onRenameAgency,
  onDeleteAgency,
  onUpdateAgencyBillingSettings,
  onClearPlatformNotifications,
  onCreateUser,
  onRenameUser,
  onCreateInfluencerModel,
  onOpenAgencyInfluencerBuilder,
  onUpdateInfluencerModelProfile,
  onDeleteInfluencerModel,
  onSetInfluencerModelAgencyAccess,
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
  const createAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const editAvatarInputRef = useRef<HTMLInputElement | null>(null);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [isClearingPlatformNotifications, setIsClearingPlatformNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [platformAgencySearch, setPlatformAgencySearch] = useState("");
  const [platformAgencySort, setPlatformAgencySort] = useState<PlatformAgencySort>("NAME");
  const [agencySettingsSearch, setAgencySettingsSearch] = useState("");
  const [agencySettingsSort, setAgencySettingsSort] = useState<AgencySettingsSort>("NAME");
  const [salesRange, setSalesRange] = useState<SalesRange>("MONTH");
  const [activeSalesPointIndex, setActiveSalesPointIndex] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentUser.id);
  const [temporaryPassword, setTemporaryPassword] = useState<{ userId: string; value: string } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState("");
  const [agencyDrafts, setAgencyDrafts] = useState<Record<string, string>>({});
  const [agencyBillingDrafts, setAgencyBillingDrafts] = useState<Record<string, AgencyBillingSettingsDraft>>({});
  const [expandedAgencyBillingId, setExpandedAgencyBillingId] = useState<string | null>(null);
  const [agencyPendingDeletionId, setAgencyPendingDeletionId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER" as Role,
    agencyId: isAgencyAdmin ? currentUser.agencyId || "" : agencies[0]?.id || "",
  });
  const [createManagerPermissionDraft, setCreateManagerPermissionDraft] = useState<ManagerPermissions>(defaultManagerPermissions);
  const [createAssignmentDraft, setCreateAssignmentDraft] = useState<string[]>([]);
  const [modelForm, setModelForm] = useState<ModelFormState>({
    name: "",
    handle: "",
    avatarImageUrl: "",
    defaults: { ...influencerCreationDefaults },
  });
  const [modelProfileDraft, setModelProfileDraft] = useState<ModelProfileDraft>({
    name: "",
    handle: "",
    avatarImageUrl: "",
  });
  const [pendingAvatarCrop, setPendingAvatarCrop] = useState<{ file: File; target: AvatarCropTarget } | null>(null);
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);
  const [managerPermissionDraft, setManagerPermissionDraft] = useState<ManagerPermissions>(defaultManagerPermissions);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(models[0]?.id || null);
  const [influencerPendingDeletionId, setInfluencerPendingDeletionId] = useState<string | null>(null);
  const [influencerLibrarySearch, setInfluencerLibrarySearch] = useState("");
  const [influencerAgencySearch, setInfluencerAgencySearch] = useState("");
  const [influencerAgencyDraft, setInfluencerAgencyDraft] = useState<string[]>([]);
  const [agencyCreditAccessMode, setAgencyCreditAccessMode] = useState<CreditAccessMode>("AGENCY_POOL");
  const [creditAllocationDrafts, setCreditAllocationDrafts] = useState<Record<string, string>>({});

  const roleOptions = getRoleOptions(currentUser);
  const currentManagerPermissions = normalizeManagerPermissions(currentUser.managerPermissions);
  const canManageAgencyCreditPolicy = isAgencyAdmin || (currentUser.role === "AGENCY_MANAGER" && currentManagerPermissions.canManageCredits);
  const selectedSalesSnapshot = platformSalesSnapshots[salesRange];
  const maxSalesPoint = Math.max(...selectedSalesSnapshot.chartPoints.map((point) => point.value), 1);
  const salesChart = buildSalesChartGeometry(selectedSalesSnapshot.chartPoints);
  const salesChartGradientId = `sales-chart-area-${salesRange.toLowerCase()}`;
  const salesChartClipId = `sales-chart-plot-${salesRange.toLowerCase()}`;
  const salesSourceSegments = getSalesSourceSegments(selectedSalesSnapshot);
  const salesBarWidth = Math.min(68, Math.max(34, salesChart.plotWidth / Math.max(salesChart.points.length * 2.7, 1)));
  const salesChartPoints = salesChart.points.map((point) => ({
    ...point,
    x: getClampedSalesBarX(point.x, salesBarWidth, salesChart) + salesBarWidth / 2,
  }));
  const salesChartPaths = buildSalesChartPaths(salesChartPoints, salesChart.plotBottom);
  const resolvedActiveSalesPointIndex =
    activeSalesPointIndex === null || activeSalesPointIndex < 0 || activeSalesPointIndex >= salesChartPoints.length
      ? -1
      : activeSalesPointIndex;
  const activeSalesPoint = resolvedActiveSalesPointIndex === -1 ? null : salesChartPoints[resolvedActiveSalesPointIndex] ?? null;
  const previousSalesPoint = activeSalesPoint && resolvedActiveSalesPointIndex > 0 ? salesChartPoints[resolvedActiveSalesPointIndex - 1] : null;
  const activeSalesPointShare = activeSalesPoint ? Math.round((activeSalesPoint.value / Math.max(selectedSalesSnapshot.total, 1)) * 100) : 0;
  const activeSalesPointChange = activeSalesPoint && previousSalesPoint ? activeSalesPoint.value - previousSalesPoint.value : null;
  const salesTooltipWidth = 246;
  const salesTooltipHeight = 154;
  const salesTooltipX = activeSalesPoint ? Math.min(Math.max(activeSalesPoint.x + 18, salesChart.plotLeft), salesChart.width - salesTooltipWidth - 16) : salesChart.plotLeft;
  const salesTooltipY = activeSalesPoint
    ? Math.min(Math.max(activeSalesPoint.y - salesTooltipHeight - 10, salesChart.plotTop + 6), salesChart.plotBottom - salesTooltipHeight - 8)
    : salesChart.plotTop;
  const activeSalesPointSourceSegments = activeSalesPoint
    ? salesSourceSegments.map((segment) => ({
        ...segment,
        value: Math.round(activeSalesPoint.value * (segment.value / Math.max(selectedSalesSnapshot.total, 1))),
      }))
    : [];

  useEffect(() => {
    setActiveSalesPointIndex(null);
  }, [salesRange]);

  useEffect(() => {
    const sectionId = window.location.hash.slice(1);
    if (!sectionId) {
      return;
    }

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(scrollTimer);
  }, []);

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
    setAgencyBillingDrafts((current) => {
      const next = { ...current };
      for (const agency of agencies) {
        next[agency.id] = current[agency.id] ?? buildAgencyBillingSettingsDraft(resolveAgencyBillingSettings(agency));
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

      return `${user.name} ${user.email} ${user.agencyName || ""}`
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
  const influencerPendingDeletion = models.find((model) => model.id === influencerPendingDeletionId) || null;

  useEffect(() => {
    if (!selectedInfluencer) {
      setInfluencerAgencyDraft([]);
      setModelProfileDraft({ name: "", handle: "", avatarImageUrl: "" });
      return;
    }

    setInfluencerAgencyDraft(selectedInfluencer.assignedAgencyIds);
    setModelProfileDraft({
      name: selectedInfluencer.name,
      handle: selectedInfluencer.handle,
      avatarImageUrl: selectedInfluencer.avatarImageUrl || "",
    });
  }, [selectedInfluencer]);

  const filteredInfluencerModels = useMemo(() => {
    const normalizedQuery = influencerLibrarySearch.trim().toLocaleLowerCase();
    const visibleModels = normalizedQuery
      ? models.filter((model) =>
          `${model.name} ${model.handle} ${model.assignedAgencyNames.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery),
        )
      : models;

    return [...visibleModels].sort((left, right) => left.name.localeCompare(right.name));
  }, [influencerLibrarySearch, models]);

  const filteredInfluencerAgencies = useMemo(() => {
    const normalizedQuery = influencerAgencySearch.trim().toLocaleLowerCase();

    return agencies
      .filter((agency) => {
        if (!normalizedQuery) {
          return true;
        }

        return `${agency.name} ${agency.slug}`.toLocaleLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [agencies, influencerAgencySearch]);

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
  const platformAgencyRows = useMemo(() => {
    return agencies.map((agency) => {
      const billingSettings = resolveAgencyBillingSettings(agency);
      const influencerCapacity = billingSettings.aiInfluencerAllowance;
      const assignedModels = models.filter((model) => model.isActive && model.assignedAgencyIds.includes(agency.id));
      const agencyDirectUsers = users.filter((user) => user.agencyId === agency.id && (user.role === "USER" || user.role === "AGENCY_MANAGER"));
      const directAssignmentCount = agencyDirectUsers.reduce((sum, user) => sum + user.assignedModelIds.length, 0);
      const directAssigneeCount = agencyDirectUsers.filter((user) => user.assignedModelIds.length > 0).length;

      return {
        agency,
        assignedInfluencers: assignedModels.length,
        billingSettings,
        influencerCapacity,
        activeAccounts: agency.activeCount,
        creditBalance: agencyBillingPlan.creditBalance,
        directAssigneeCount,
        directAssignmentCount,
        memberCount: agency.memberCount,
        openInfluencerSlots: Math.max(0, influencerCapacity - assignedModels.length),
        overCapacityCount: Math.max(0, assignedModels.length - influencerCapacity),
      };
    });
  }, [agencies, models, users]);
  const platformAgencyTotals = useMemo(
    () => ({
      agencies: platformAgencyRows.length,
      creditBalance: platformAgencyRows.reduce((sum, row) => sum + row.creditBalance, 0),
      assignedInfluencers: platformAgencyRows.reduce((sum, row) => sum + row.assignedInfluencers, 0),
      influencerCapacity: platformAgencyRows.reduce((sum, row) => sum + row.influencerCapacity, 0),
      overCapacityAgencies: platformAgencyRows.filter((row) => row.overCapacityCount > 0).length,
      activeAccounts: platformAgencyRows.reduce((sum, row) => sum + row.activeAccounts, 0),
    }),
    [platformAgencyRows],
  );
  const filteredPlatformAgencyRows = useMemo(() => {
    const normalizedSearch = platformAgencySearch.trim().toLocaleLowerCase();
    const visibleRows = normalizedSearch
      ? platformAgencyRows.filter((row) => `${row.agency.name} ${row.agency.slug}`.toLocaleLowerCase().includes(normalizedSearch))
      : platformAgencyRows;

    return [...visibleRows].sort((left, right) => {
      if (platformAgencySort === "INFLUENCER_USAGE") {
        const leftUsage = left.influencerCapacity ? left.assignedInfluencers / left.influencerCapacity : 0;
        const rightUsage = right.influencerCapacity ? right.assignedInfluencers / right.influencerCapacity : 0;
        return rightUsage - leftUsage || right.assignedInfluencers - left.assignedInfluencers || left.agency.name.localeCompare(right.agency.name);
      }

      if (platformAgencySort === "ACCOUNTS") {
        return right.memberCount - left.memberCount || left.agency.name.localeCompare(right.agency.name);
      }

    return left.agency.name.localeCompare(right.agency.name);
  });
  }, [platformAgencyRows, platformAgencySearch, platformAgencySort]);
  const agencySettingsRows = useMemo(() => {
    const normalizedSearch = agencySettingsSearch.trim().toLocaleLowerCase();
    const visibleRows = normalizedSearch
      ? platformAgencyRows.filter((row) => `${row.agency.name} ${row.agency.slug}`.toLocaleLowerCase().includes(normalizedSearch))
      : platformAgencyRows;

    return [...visibleRows].sort((left, right) => {
      if (agencySettingsSort === "MEMBERS") {
        return right.memberCount - left.memberCount || left.agency.name.localeCompare(right.agency.name);
      }

      if (agencySettingsSort === "ACTIVE") {
        return right.activeAccounts - left.activeAccounts || left.agency.name.localeCompare(right.agency.name);
      }

      if (agencySettingsSort === "ADMINS") {
        return right.agency.adminCount - left.agency.adminCount || left.agency.name.localeCompare(right.agency.name);
      }

      return left.agency.name.localeCompare(right.agency.name);
    });
  }, [agencySettingsSearch, agencySettingsSort, platformAgencyRows]);
  const agencySummaryAgencyId = currentUser.agencyId || agencies[0]?.id || "";
  const agencySummaryAgency = agencies.find((agency) => agency.id === agencySummaryAgencyId) || null;
  const currentAgencyBillingSettings = resolveAgencyBillingSettings(agencySummaryAgency);
  const agencySummaryUsers = useMemo(
    () => users.filter((user) => user.agencyId === agencySummaryAgencyId && user.role !== "PLATFORM_ADMIN"),
    [agencySummaryAgencyId, users],
  );
  const agencySummaryCounts = useMemo(
    () => ({
      memberCount: agencySummaryAgency?.memberCount ?? agencySummaryUsers.length,
      adminCount: agencySummaryAgency?.adminCount ?? agencySummaryUsers.filter((user) => user.role === "AGENCY_ADMIN").length,
      managerCount: agencySummaryAgency?.managerCount ?? agencySummaryUsers.filter((user) => user.role === "AGENCY_MANAGER").length,
      userCount: agencySummaryAgency?.userCount ?? agencySummaryUsers.filter((user) => user.role === "USER").length,
      activeCount: agencySummaryAgency?.activeCount ?? agencySummaryUsers.filter((user) => user.isActive).length,
    }),
    [agencySummaryAgency, agencySummaryUsers],
  );
  const agencyAvailableModels = useMemo(() => models.filter((model) => model.isActive && model.canAccess), [models]);
  const agencyInfluencerCapacity = currentAgencyBillingSettings.aiInfluencerAllowance;
  const agencyOpenInfluencerSlots = Math.max(0, agencyInfluencerCapacity - agencyAvailableModels.length);
  const agencyGalleryAssets = useMemo(
    () => agencyAvailableModels.reduce((sum, model) => sum + model.galleryCount, 0),
    [agencyAvailableModels],
  );
  const agencyBoardCount = useMemo(
    () => agencyAvailableModels.reduce((sum, model) => sum + model.boardCount, 0),
    [agencyAvailableModels],
  );
  const agencyModelsByGallery = useMemo(
    () => [...agencyAvailableModels].sort((left, right) => right.galleryCount - left.galleryCount || left.name.localeCompare(right.name)),
    [agencyAvailableModels],
  );
  const agencyCreditAssignableUsers = useMemo(
    () => agencySummaryUsers.filter((user) => user.role === "USER" || user.role === "AGENCY_MANAGER"),
    [agencySummaryUsers],
  );
  const agencyGeneratedAssets = useMemo(() => {
    const agencyUserIds = new Set(agencySummaryUsers.map((user) => user.id));
    const assets: GeneratedAsset[] = [];

    for (const model of agencyAvailableModels) {
      for (const board of model.boards || []) {
        for (const row of board.rows || []) {
          for (const asset of row.outputAssets || []) {
            if (agencyUserIds.has(asset.createdById)) {
              assets.push(asset);
            }
          }
        }
      }
    }

    return assets;
  }, [agencyAvailableModels, agencySummaryUsers]);
  const agencyCreditUsageRows = useMemo(
    () =>
      agencySummaryUsers
        .map((user) => {
          const userAssets = agencyGeneratedAssets.filter((asset) => asset.createdById === user.id);
          const modelIds = new Set(userAssets.map((asset) => asset.influencerModelId));
          const estimatedCredits = userAssets.reduce((sum, asset) => sum + estimateAssetCreditCost(asset), 0);
          const latestAsset = userAssets.reduce<GeneratedAsset | null>((latest, asset) => {
            if (!latest || new Date(asset.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
              return asset;
            }

            return latest;
          }, null);

          return {
            user,
            estimatedCredits,
            outputCount: userAssets.length,
            modelCount: modelIds.size,
            lastGeneratedAt: latestAsset?.createdAt || null,
          };
        })
        .sort((left, right) => right.estimatedCredits - left.estimatedCredits || left.user.name.localeCompare(right.user.name)),
    [agencyGeneratedAssets, agencySummaryUsers],
  );
  const agencyEstimatedCreditsSpent = useMemo(
    () => agencyCreditUsageRows.reduce((sum, row) => sum + row.estimatedCredits, 0),
    [agencyCreditUsageRows],
  );
  const agencyCreditAllocationTotal = useMemo(
    () =>
      agencyCreditAssignableUsers.reduce((sum, user) => {
        const allocation = parseCreditAmount(creditAllocationDrafts[user.id]);
        return sum + allocation;
      }, 0),
    [agencyCreditAssignableUsers, creditAllocationDrafts],
  );
  const agencyCreditUnallocatedBalance = Math.max(0, agencyBillingPlan.creditBalance - agencyCreditAllocationTotal);
  const assignableModels = useMemo(() => models.filter((model) => model.isActive), [models]);
  const createAssignableModels = useMemo(() => {
    if (createForm.role !== "USER" || !createForm.agencyId) {
      return [];
    }

    return models
      .filter((model) => {
        if (!model.isActive) {
          return false;
        }

        return model.assignedAgencyIds.includes(createForm.agencyId) || (isPlatformAdmin && model.assignedAgencyIds.length === 0);
      })
      .sort((left, right) => {
        const leftOwned = left.assignedAgencyIds.includes(createForm.agencyId);
        const rightOwned = right.assignedAgencyIds.includes(createForm.agencyId);

        if (leftOwned !== rightOwned) {
          return leftOwned ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });
  }, [createForm.agencyId, createForm.role, isPlatformAdmin, models]);

  useEffect(() => {
    const availableIds = new Set(createAssignableModels.map((model) => model.id));
    setCreateAssignmentDraft((current) => {
      const next = current.filter((modelId) => availableIds.has(modelId));
      return next.length === current.length ? current : next;
    });
  }, [createAssignableModels]);

  const selectedUserAgencyIds = useMemo(() => (selectedUser ? resolveUserAgencyIds(selectedUser) : []), [selectedUser]);
  const selectedUserPrimaryAgencyId = selectedUser?.agencyId || selectedUserAgencyIds[0] || "";
  const selectedUserAgencyNames = useMemo(() => {
    const selectedAgencyIdSet = new Set(selectedUserAgencyIds);
    return agencies.filter((agency) => selectedAgencyIdSet.has(agency.id)).map((agency) => agency.name);
  }, [agencies, selectedUserAgencyIds]);
  const selectedUserAgencyLabel = selectedUserAgencyNames.join(", ") || selectedUser?.agencyName || "this agency";
  const pendingAgencyEnablementModels = useMemo(
    () =>
      assignmentDraft
        .map((modelId) => models.find((model) => model.id === modelId) || null)
        .filter(
          (model): model is InfluencerModel =>
            model !== null && selectedUserAgencyIds.length > 0 && !model.assignedAgencyIds.some((agencyId) => selectedUserAgencyIds.includes(agencyId)),
        ),
    [assignmentDraft, models, selectedUserAgencyIds],
  );
  const pendingUnownedAgencyEnablementModels = useMemo(
    () => pendingAgencyEnablementModels.filter((model) => model.assignedAgencyIds.length === 0),
    [pendingAgencyEnablementModels],
  );
  const pendingExclusiveAgencyModels = useMemo(
    () => pendingAgencyEnablementModels.filter((model) => model.assignedAgencyIds.length > 0),
    [pendingAgencyEnablementModels],
  );
  const agencyUnavailableAssignmentCount = useMemo(
    () =>
      assignableModels.filter(
        (model) =>
          selectedUserAgencyIds.length > 0 &&
          model.assignedAgencyIds.length > 0 &&
          !model.assignedAgencyIds.some((agencyId) => selectedUserAgencyIds.includes(agencyId)),
      ).length,
    [assignableModels, selectedUserAgencyIds],
  );
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

  useEffect(() => {
    const storedPolicy = readStoredAgencyCreditPolicy(agencySummaryAgencyId);
    setAgencyCreditAccessMode(storedPolicy?.mode || "AGENCY_POOL");
    setCreditAllocationDrafts(storedPolicy?.allocations || {});
  }, [agencySummaryAgencyId]);

  useEffect(() => {
    setCreditAllocationDrafts((current) => {
      const storedPolicy = readStoredAgencyCreditPolicy(agencySummaryAgencyId);
      const assignableIds = new Set(agencyCreditAssignableUsers.map((user) => user.id));
      const next: Record<string, string> = {};
      let remainingCredits = agencyBillingPlan.creditBalance;
      let changed = false;

      for (const user of agencyCreditAssignableUsers) {
        const cappedAllocation = clampCreditAmount(current[user.id] ?? storedPolicy?.allocations[user.id], remainingCredits);
        next[user.id] = String(cappedAllocation);
        remainingCredits -= cappedAllocation;
        changed ||= next[user.id] !== current[user.id];
      }

      changed ||= Object.keys(current).some((userId) => !assignableIds.has(userId));

      return changed ? next : current;
    });
  }, [agencyCreditAssignableUsers, agencySummaryAgencyId]);

  function showNotice(placement: NoticePlacement, tone: Notice["tone"], text: string): void {
    setNotice({ placement, tone, text });
  }

  function renderNotice(placement: NoticePlacement, className?: string) {
    if (notice?.placement !== placement) {
      return null;
    }

    const content = <AccessNotice notice={notice} />;
    return className ? <div className={className}>{content}</div> : content;
  }

  function renderCreateManagerPermissionControls(className?: string) {
    if (createForm.role !== "AGENCY_MANAGER") {
      return null;
    }

    return (
      <div className={cx("rounded-[24px] border border-white/8 bg-black/14 p-4", className)}>
        <div>
          <p className="text-sm font-semibold text-white">Manager permissions</p>
          <p className="mt-2 text-sm leading-6 text-white/54">
            Choose what this manager can do for users inside {currentUser.agencyName || "their agency"} from their first sign-in.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {managerPermissionOptions.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
              <span>{label}</span>
              <input
                checked={createManagerPermissionDraft[key]}
                onChange={(event) =>
                  setCreateManagerPermissionDraft((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
                type="checkbox"
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderCreateInfluencerAccessControls(className?: string) {
    if (createForm.role !== "USER") {
      return null;
    }

    const selectedAgencyName = agencies.find((agency) => agency.id === createForm.agencyId)?.name || currentUser.agencyName || "";
    const unassignedAvailableCount = createAssignableModels.filter((model) => model.assignedAgencyIds.length === 0).length;
    const selectedUnassignedCount = createAssignmentDraft.filter((modelId) => {
      const model = createAssignableModels.find((entry) => entry.id === modelId);
      return model ? model.assignedAgencyIds.length === 0 : false;
    }).length;

    return (
      <div className={cx("rounded-[24px] border border-white/8 bg-black/14 p-4 sm:p-5", className)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Influencer access</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/54">
              Grant the influencer profiles this user should be able to open as soon as the account is created.
              {selectedAgencyName ? ` Showing models available to ${selectedAgencyName}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
              {createAssignmentDraft.length} selected
            </span>
            {isPlatformAdmin && unassignedAvailableCount ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100/78">
                {unassignedAvailableCount} unassigned available
              </span>
            ) : null}
          </div>
        </div>

        {createAssignableModels.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {createAssignableModels.map((model) => {
              const selected = createAssignmentDraft.includes(model.id);
              const ownedBySelectedAgency = createForm.agencyId ? model.assignedAgencyIds.includes(createForm.agencyId) : false;
              const unassignedModel = model.assignedAgencyIds.length === 0;

              return (
                <button
                  key={model.id}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    selected
                      ? "border-lime-300/35 bg-lime-300/12"
                      : unassignedModel
                        ? "border-amber-300/18 bg-amber-300/[0.06] hover:border-amber-300/28 hover:bg-amber-300/[0.09]"
                        : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                  )}
                  onClick={() => setCreateAssignmentDraft((current) => toggleId(current, model.id))}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{model.name}</span>
                      <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-white/44">{model.handle}</span>
                    </span>
                    <span
                      className={cx(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        selected ? "bg-lime-300/14 text-lime-100" : "bg-white/[0.06] text-white/48",
                      )}
                    >
                      {selected ? "Granted" : "Add"}
                    </span>
                  </span>
                  <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-white/46">
                    {ownedBySelectedAgency
                      ? `Owned by ${selectedAgencyName || "selected agency"}`
                      : unassignedModel
                        ? `Will assign to ${selectedAgencyName || "selected agency"}`
                        : "Unavailable"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-white/52">
            {createForm.agencyId
              ? "No active influencer profiles are owned by this agency yet. Assign influencer ownership first, then grant direct user access."
              : "Select an agency to see owned influencer profiles and unassigned profiles that can be attached during account creation."}
          </div>
        )}

        {isPlatformAdmin && selectedUnassignedCount ? (
          <p className="mt-4 rounded-2xl border border-amber-300/18 bg-amber-300/[0.08] px-4 py-3 text-sm leading-6 text-amber-100/76">
            {selectedUnassignedCount} unassigned influencer{selectedUnassignedCount === 1 ? "" : "s"} will be assigned to {selectedAgencyName || "the selected agency"} before access is granted.
          </p>
        ) : null}
      </div>
    );
  }

  async function executeAction<T>(
    action: () => Promise<T>,
    successText?: string,
    placement: NoticePlacement = "global",
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    try {
      const result = await action();
      if (successText) {
        showNotice(placement, "success", successText);
      }
      return { ok: true, value: result };
    } catch (error) {
      showNotice(placement, "error", error instanceof Error ? error.message : "Something went wrong");
      return { ok: false };
    }
  }

  async function handleClearPlatformNotifications(): Promise<void> {
    setIsClearingPlatformNotifications(true);
    const result = await executeAction(
      onClearPlatformNotifications,
      "Cleared platform notifications.",
      "global",
    );
    if (result.ok) {
      setNotice(null);
    }
    setIsClearingPlatformNotifications(false);
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
    !isPlatformAdmin &&
    ((selectedCanAgencyAdminManage && (selectedUser.role === "USER" || selectedUser.role === "AGENCY_MANAGER")) ||
      canManagerManageUser(currentUser, selectedUser, "canManageAssignments"));
  const canEditManagerPermissions =
    selectedUser.role === "AGENCY_MANAGER" && (selectedCanPlatformManage || selectedCanAgencyAdminManage);
  const nextScopedAgencyId = accountDraft.agencyId || "";
  const hasPendingAccountChanges =
    (canRenameSelected && normalizeText(accountDraft.name) !== selectedUser.name) ||
    (canChangeRole && accountDraft.role !== selectedUser.role) ||
    (canChangeAgency && nextScopedAgencyId !== (selectedUser.agencyId || "")) ||
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
      managerPermissionDraft.canManageAssignments !== normalizedSelectedManagerPermissions.canManageAssignments ||
      managerPermissionDraft.canManageCredits !== normalizedSelectedManagerPermissions.canManageCredits);
  const hasInfluencerAvailabilityChanges =
    Boolean(selectedInfluencer) && !sameIdSet(influencerAgencyDraft, selectedInfluencer.assignedAgencyIds);
  const selectedInfluencerCurrentAgencyId = selectedInfluencer?.assignedAgencyIds[0] || "";
  const selectedInfluencerCurrentAgencyName = selectedInfluencer?.assignedAgencyNames[0] || "Unassigned";
  const selectedInfluencerDraftAgencyId = influencerAgencyDraft[0] || "";
  const selectedInfluencerDraftAgencyName = selectedInfluencerDraftAgencyId
    ? agencies.find((agency) => agency.id === selectedInfluencerDraftAgencyId)?.name || "Selected agency"
    : "No owner selected";
  const influencerOwnershipActionLabel = !hasInfluencerAvailabilityChanges
    ? "Owner unchanged"
    : selectedInfluencerCurrentAgencyId && selectedInfluencerDraftAgencyId
      ? `Transfer to ${selectedInfluencerDraftAgencyName}`
      : selectedInfluencerDraftAgencyId
        ? `Assign to ${selectedInfluencerDraftAgencyName}`
        : "Remove owner agency";
  const hasModelProfileChanges =
    Boolean(selectedInfluencer) &&
    (normalizeText(modelProfileDraft.name) !== selectedInfluencer.name ||
      modelProfileDraft.handle.trim() !== selectedInfluencer.handle ||
      (modelProfileDraft.avatarImageUrl || "") !== (selectedInfluencer.avatarImageUrl || ""));

  async function handleCreateAgency(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextName = normalizeText(newAgencyName);
    if (!nextName) {
      showNotice("agencySettings", "error", "Agency name is required");
      return;
    }

    const result = await executeAction(() => onCreateAgency(nextName), `Created ${nextName}.`, "agencySettings");
    if (result.ok) {
      setNewAgencyName("");
    }
  }

  async function handleRenameAgency(agency: AgencyRecord): Promise<void> {
    const nextName = normalizeText(agencyDrafts[agency.id] || "");
    if (!nextName) {
      showNotice("agencySettings", "error", "Agency name is required");
      return;
    }

    if (nextName === agency.name) {
      return;
    }

    await executeAction(() => onRenameAgency(agency.id, nextName), `Renamed ${agency.name} to ${nextName}.`, "agencySettings");
  }

  function handleAgencyBillingDraftChange(
    agencyId: string,
    field: keyof AgencyBillingSettings,
    value: string,
  ): void {
    setAgencyBillingDrafts((current) => ({
      ...current,
      [agencyId]: {
        ...(current[agencyId] ?? buildAgencyBillingSettingsDraft(defaultAgencyBillingSettings)),
        [field]: value,
      },
    }));
  }

  async function handleSaveAgencyBillingSettings(agency: AgencyRecord): Promise<void> {
    const draft = agencyBillingDrafts[agency.id] ?? buildAgencyBillingSettingsDraft(resolveAgencyBillingSettings(agency));
    const nextSettings = normalizeAgencyBillingSettingsDraft(draft);

    const result = await executeAction(
      () => onUpdateAgencyBillingSettings(agency.id, nextSettings),
      `Updated billing settings for ${agency.name}.`,
      "agencyBillingSettings",
    );

    if (result.ok) {
      setAgencyBillingDrafts((current) => ({
        ...current,
        [agency.id]: buildAgencyBillingSettingsDraft(nextSettings),
      }));
    }
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
      "agencySettings",
    );

    if (result.ok) {
      setAgencyPendingDeletionId(null);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nextName = normalizeText(createForm.name);
    if (!nextName) {
      showNotice("createAccount", "error", "Account name is required");
      return;
    }

    const nextAgencyId = createForm.role === "PLATFORM_ADMIN" ? null : createForm.agencyId || null;
    if (createForm.role !== "PLATFORM_ADMIN" && !nextAgencyId) {
      showNotice("createAccount", "error", "Select an agency for agency-scoped roles.");
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
          managerPermissions: createForm.role === "AGENCY_MANAGER" ? createManagerPermissionDraft : null,
          influencerModelIds: createForm.role === "USER" ? createAssignmentDraft : null,
        }),
      `Created ${nextName}.`,
      "createAccount",
    );

    if (result.ok) {
      setCreateForm({
        name: "",
        email: "",
        password: "",
        role: "USER",
        agencyId: isAgencyAdmin ? currentUser.agencyId || "" : agencies[0]?.id || "",
      });
      setCreateManagerPermissionDraft(defaultManagerPermissions);
      setCreateAssignmentDraft([]);
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
      } else if (canChangeAgency && nextRole !== "PLATFORM_ADMIN") {
        if (!nextAgencyId) {
          throw new Error("Agency assignment is required for this role");
        }

        if (nextAgencyId !== selectedUser.agencyId) {
          await onUpdateOrganization(selectedUser.id, { agencyId: nextAgencyId });
        }
      }

      if (canToggleSelectedStatus && accountDraft.isActive !== selectedUser.isActive) {
        await onSetUserActive(selectedUser.id, accountDraft.isActive);
      }
    }, `Applied settings for ${selectedUser.name}.`, "accountSettings");

    if (result.ok) {
      setTemporaryPassword(null);
    }
  }

  async function handleApplyAssignments(): Promise<void> {
    if (!canEditAssignments || !hasAssignmentChanges) {
      return;
    }

    const canAssignUnownedModelToAgency = isPlatformAdmin && Boolean(selectedUserPrimaryAgencyId);
    if (pendingExclusiveAgencyModels.length) {
      showNotice("influencerAccess", "error", "Those influencers already belong to another agency. Choose influencers owned by this account's agency.");
      return;
    }

    if (pendingUnownedAgencyEnablementModels.length && !canAssignUnownedModelToAgency) {
      showNotice("influencerAccess", "error", "Assign those influencers to this account's agency before granting direct access.");
      return;
    }

    await executeAction(async () => {
      for (const model of pendingUnownedAgencyEnablementModels) {
        await onSetInfluencerModelAgencyAccess(model.id, [selectedUserPrimaryAgencyId]);
      }

      await onUpdateAssignments(selectedUser.id, assignmentDraft);
    }, pendingUnownedAgencyEnablementModels.length ? `Assigned ${pendingUnownedAgencyEnablementModels.length} influencer${pendingUnownedAgencyEnablementModels.length === 1 ? "" : "s"} to ${selectedUserAgencyLabel} and updated access for ${selectedUser.name}.` : `Updated influencer access for ${selectedUser.name}.`, "influencerAccess");
  }

  async function handleToggleSelectedAgencyModelAccess(model: InfluencerModel): Promise<void> {
    if (!isPlatformAdmin || !selectedUser.agencyId) {
      return;
    }

    const selectedAgencyId = selectedUser.agencyId;
    const ownedBySelectedAgency = model.assignedAgencyIds.includes(selectedAgencyId);
    const previousOwnerName = model.assignedAgencyNames[0] || "another agency";
    const selectedAgencyName = selectedUser.agencyName || "this agency";
    const nextAgencyIds = ownedBySelectedAgency ? [] : [selectedAgencyId];
    const actionLabel = ownedBySelectedAgency
      ? `Removed ${model.name} from ${selectedAgencyName}.`
      : model.assignedAgencyIds.length > 0
        ? `Transferred ${model.name} from ${previousOwnerName} to ${selectedAgencyName}.`
        : `Assigned ${model.name} to ${selectedAgencyName}.`;

    await executeAction(
      () => onSetInfluencerModelAgencyAccess(model.id, nextAgencyIds),
      actionLabel,
      "influencerAccess",
    );
  }

  async function handleApplyManagerPermissions(): Promise<void> {
    if (!canEditManagerPermissions || !hasManagerPermissionChanges) {
      return;
    }

    await executeAction(
      () => onUpdateManagerPermissions(selectedUser.id, managerPermissionDraft),
      `Updated manager permissions for ${selectedUser.name}.`,
      "managerPermissions",
    );
  }

  function handleApplyCreditPolicy(): void {
    if (!canManageAgencyCreditPolicy) {
      return;
    }

    showNotice(
      "agencyCreditPolicy",
      "success",
      agencyCreditAccessMode === "AGENCY_POOL"
        ? "Agency credits are saved as shared pool access."
        : `Credit allocations are saved for ${agencyCreditAssignableUsers.length} account${agencyCreditAssignableUsers.length === 1 ? "" : "s"}.`,
    );
  }

  function handleCreditAccessModeChange(nextMode: CreditAccessMode): void {
    setAgencyCreditAccessMode(nextMode);
    writeStoredAgencyCreditPolicy(agencySummaryAgencyId, {
      mode: nextMode,
      allocations: creditAllocationDrafts,
    });
  }

  function handleCreditAllocationChange(userId: string, value: string): void {
    setCreditAllocationDrafts((current) => {
      const otherAllocatedCredits = agencyCreditAssignableUsers.reduce((sum, user) => {
        if (user.id === userId) {
          return sum;
        }

        return sum + parseCreditAmount(current[user.id]);
      }, 0);
      const maxAllocation = Math.max(0, agencyBillingPlan.creditBalance - otherAllocatedCredits);
      const nextDrafts = { ...current, [userId]: String(clampCreditAmount(value, maxAllocation)) };
      writeStoredAgencyCreditPolicy(agencySummaryAgencyId, {
        mode: agencyCreditAccessMode,
        allocations: nextDrafts,
      });
      return nextDrafts;
    });
  }

  async function handleResetPassword(): Promise<void> {
    const password = await executeAction(() => onResetPassword(selectedUser.id), `Reset password for ${selectedUser.name}.`, "accountSettings");
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

    const result = await executeAction(() => onDeleteUser(selectedUser.id), `Deleted ${selectedUser.name}.`, "deleteAccount");
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
          avatarImageUrl: modelForm.avatarImageUrl || null,
          allowedGenerationModels: [...generationModelOptions],
          defaults: { ...modelForm.defaults, promptPrefix: modelForm.defaults.promptPrefix.trim() },
        }),
      `Added ${normalizeText(modelForm.name)}.`,
      "createInfluencer",
    );

    if (result.ok) {
      setModelForm({
        name: "",
        handle: "",
        avatarImageUrl: "",
        defaults: { ...influencerCreationDefaults },
      });
    }
  }

  async function handleUpdateInfluencerProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedInfluencer || !hasModelProfileChanges) {
      return;
    }

    await executeAction(
      () =>
        onUpdateInfluencerModelProfile(selectedInfluencer.id, {
          name: normalizeText(modelProfileDraft.name),
          handle: modelProfileDraft.handle.trim(),
          avatarImageUrl: modelProfileDraft.avatarImageUrl || null,
        }),
      `Updated ${normalizeText(modelProfileDraft.name)}.`,
      "influencerProfile",
    );
  }

  async function handleDeleteInfluencer(): Promise<void> {
    if (!influencerPendingDeletion) {
      return;
    }

    const deletedInfluencerName = influencerPendingDeletion.name;
    const result = await executeAction(
      () => onDeleteInfluencerModel(influencerPendingDeletion.id),
      `Deleted ${deletedInfluencerName}.`,
      "deleteInfluencer",
    );

    if (result.ok) {
      setInfluencerPendingDeletionId(null);
      setSelectedInfluencerId(null);
    }
  }

  async function handleApplyInfluencerAvailability(): Promise<void> {
    if (!selectedInfluencer || !hasInfluencerAvailabilityChanges) {
      return;
    }

    await executeAction(async () => {
      if (!sameIdSet(influencerAgencyDraft, selectedInfluencer.assignedAgencyIds)) {
        await onSetInfluencerModelAgencyAccess(selectedInfluencer.id, influencerAgencyDraft);
      }
    }, `Updated ${selectedInfluencer.name}.`, "influencerOwnership");
  }

  function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>, target: AvatarCropTarget): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setPendingAvatarCrop({ file, target });
  }

  async function handleSaveCroppedAvatar(file: File): Promise<void> {
    if (!pendingAvatarCrop) {
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const uploaded = await uploadReferenceFile(file);
      if (pendingAvatarCrop.target === "create") {
        setModelForm((current) => ({ ...current, avatarImageUrl: uploaded.url }));
      } else {
        setModelProfileDraft((current) => ({ ...current, avatarImageUrl: uploaded.url }));
      }
      setPendingAvatarCrop(null);
      showNotice(pendingAvatarCrop.target === "create" ? "createInfluencer" : "influencerProfile", "success", `Uploaded ${file.name}.`);
    } catch (error) {
      showNotice(
        pendingAvatarCrop.target === "create" ? "createInfluencer" : "influencerProfile",
        "error",
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const platformNotificationsSummary = (
    <div
      id="access-platform-notifications"
      className={cx(
        "border-t border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-6 transition sm:px-7",
        platformNotifications.length ? "py-5" : "py-3 opacity-45 hover:opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Platform Notifications</p>
          {platformNotifications.length ? (
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Billing follow-up requests from agency admins appear here as soon as they click the request button.
            </p>
          ) : (
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">No follow-up requests.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cx(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
              platformNotifications.length
                ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]"
                : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)]",
            )}
          >
            {platformNotifications.length} request{platformNotifications.length === 1 ? "" : "s"}
          </span>
          {platformNotifications.length ? (
            <button
              className={theme.buttonSecondary + " rounded-xl px-3 py-2 text-xs"}
              disabled={isClearingPlatformNotifications}
              onClick={() => void handleClearPlatformNotifications()}
              type="button"
            >
              {isClearingPlatformNotifications ? "Clearing..." : "Clear"}
            </button>
          ) : null}
        </div>
      </div>

      {platformNotifications.length ? (
        <div className="mt-4 divide-y divide-[color:var(--surface-border)] overflow-hidden rounded-[22px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)]">
          {platformNotifications.slice(0, 3).map((notification) => (
            <div key={notification.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[color:var(--text-strong)]">{notification.message}</p>
                <p className="mt-1 truncate text-xs text-[color:var(--text-muted)]">
                  {notification.requesterName}
                  {notification.requesterEmail ? ` - ${notification.requesterEmail}` : ""}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-semibold text-[color:var(--text-main)]">{notification.agencyName || "No agency"}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{formatTimestamp(notification.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {renderNotice("global")}

      {isPlatformAdmin ? (
        <section id="access-platform-sales" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7" style={sectionHeaderGlowStyle}>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/42">Platform revenue</p>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">
                  Revenue from agency renewals, credit purchases, and plan upgrades across the platform.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 rounded-3xl border border-white/8 bg-black/18 p-1.5">
                {salesRangeOptions.map((option) => {
                  const selected = salesRange === option.value;
                  return (
                    <button
                      key={option.value}
                      className={cx(
                        "rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                        selected ? "bg-lime-300 text-black" : "text-white/58 hover:bg-white/[0.06] hover:text-white/78",
                      )}
                      onClick={() => setSalesRange(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-px bg-white/8 xl:grid-cols-[0.82fr_1.18fr]">
            <div
              className="border border-white/10 bg-[color:var(--surface-card-strong)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-7 sm:py-7"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--accent-main) 10%, var(--surface-card-strong)) 0%, var(--surface-card-strong) 100%)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">{selectedSalesSnapshot.label}</p>
                  <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{formatCurrency(selectedSalesSnapshot.total)}</p>
                  <p className="mt-3 text-sm font-semibold text-lime-100">{selectedSalesSnapshot.changeLabel}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/18 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
                  {selectedSalesSnapshot.dateLabel}
                </span>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/12 bg-white/[0.055] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Paid agencies</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{selectedSalesSnapshot.paidAgencies}</p>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/[0.055] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Avg order</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(selectedSalesSnapshot.averageOrderValue)}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  ["Renewals", selectedSalesSnapshot.renewalSales, "bg-lime-300/75"],
                  ["Credit purchases", selectedSalesSnapshot.creditSales, "bg-sky-300/75"],
                  ["Plan upgrades", selectedSalesSnapshot.upgradeSales, "bg-fuchsia-300/75"],
                ].map(([label, value, barClass]) => {
                  const percent = Math.max(4, Math.round((Number(value) / selectedSalesSnapshot.total) * 100));
                  return (
                    <div key={label} className="rounded-3xl border border-white/12 bg-white/[0.055] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{label}</p>
                        <p className="text-sm font-semibold text-white/72">{formatCurrency(Number(value))}</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                        <div className={cx("h-full rounded-full", String(barClass))} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[color:var(--surface-card)] px-6 py-6 sm:px-7 sm:py-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Sales graph</p>
                  <h3 className="font-display mt-2 text-2xl text-white">{selectedSalesSnapshot.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
                    Revenue trend with period detail for renewals, top-ups, and upgrades in the selected range.
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:w-auto sm:min-w-[330px] sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/42">Peak period</p>
                    <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(maxSalesPoint)}</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/42">Selected</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {activeSalesPoint ? `${activeSalesPoint.label} · ${formatCurrency(activeSalesPoint.value)}` : "Hover a bar"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-semibold text-[color:var(--text-muted)]">
                {salesSourceSegments.map((segment) => (
                  <span key={segment.label} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.fill }} />
                    {segment.label}
                  </span>
                ))}
              </div>

              <div
                className="mt-6 rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-3 shadow-[var(--shadow-soft)] sm:p-5"
                onMouseLeave={() => setActiveSalesPointIndex(null)}
              >
                <div className="overflow-x-auto">
                  <svg
                    aria-label={`${selectedSalesSnapshot.title} platform sales chart`}
                    className="min-w-[760px]"
                    role="img"
                    viewBox={`0 0 ${salesChart.width} ${salesChart.height}`}
                    width="100%"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>{`${selectedSalesSnapshot.title} platform sales chart`}</title>
                    <defs>
                      <linearGradient id={salesChartGradientId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-main)" stopOpacity="0.32" />
                        <stop offset="72%" stopColor="rgb(14 165 233)" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="rgb(14 165 233)" stopOpacity="0" />
                      </linearGradient>
                      <clipPath id={salesChartClipId}>
                        <rect height={salesChart.plotHeight} rx="16" width={salesChart.plotWidth} x={salesChart.plotLeft} y={salesChart.plotTop} />
                      </clipPath>
                      {salesChartPoints.map((point, index) => {
                        const barX = point.x - salesBarWidth / 2;
                        return (
                          <clipPath key={`${point.label}-bar-clip`} id={`${salesChartClipId}-bar-${index}`}>
                            <rect
                              height={salesChart.plotBottom - point.y}
                              rx="12"
                              width={salesBarWidth}
                              x={barX}
                              y={point.y}
                            />
                          </clipPath>
                        );
                      })}
                    </defs>
                    <rect fill="var(--surface-card)" height="100%" rx="20" stroke="var(--surface-border)" width="100%" />

                    {salesChart.yTicks.map((tick) => (
                      <g key={tick.value}>
                        <line
                          stroke="var(--surface-border)"
                          strokeDasharray={tick.value === 0 ? undefined : "4 8"}
                          x1={salesChart.plotLeft}
                          x2={salesChart.width - salesChart.plotRight}
                          y1={tick.y}
                          y2={tick.y}
                        />
                        <text fill="var(--text-muted)" fontSize="12" fontWeight="600" textAnchor="end" x={salesChart.plotLeft - 14} y={tick.y + 4}>
                          {formatCompactCurrency(tick.value)}
                        </text>
                      </g>
                    ))}

                    {salesChartPoints.map((point) => (
                      <line
                        key={`${point.label}-guide`}
                        stroke="color-mix(in srgb, var(--text-strong) 7%, transparent)"
                        x1={point.x}
                        x2={point.x}
                        y1={salesChart.plotTop}
                        y2={salesChart.plotBottom}
                      />
                    ))}

                    <g clipPath={`url(#${salesChartClipId})`}>
                      <path d={salesChartPaths.areaPath} fill={`url(#${salesChartGradientId})`} />

                      {salesChartPoints.map((point, index) => {
                        const selected = index === resolvedActiveSalesPointIndex;
                        const barX = point.x - salesBarWidth / 2;
                        const segmentValues = salesSourceSegments.map((segment) => ({
                          ...segment,
                          value: point.value * (segment.value / Math.max(selectedSalesSnapshot.total, 1)),
                        }));
                        let segmentBottom = salesChart.plotBottom;
                        return (
                          <g key={`${point.label}-bar`} data-sales-bar="true">
                            <g clipPath={`url(#${salesChartClipId}-bar-${index})`}>
                              {segmentValues.map((segment) => {
                                const rawHeight = (segment.value / salesChart.chartMax) * salesChart.plotHeight;
                                const segmentHeight = Math.max(2, rawHeight);
                                segmentBottom -= segmentHeight;
                                return (
                                  <rect
                                    key={segment.label}
                                    fill={selected ? segment.fill : segment.softFill}
                                    height={segmentHeight}
                                    opacity={selected ? 0.94 : 0.9}
                                    width={salesBarWidth}
                                    x={barX}
                                    y={segmentBottom}
                                  />
                                );
                              })}
                            </g>
                            <rect
                              fill="none"
                              height={salesChart.plotBottom - point.y}
                              rx="12"
                              stroke={selected ? "var(--accent-main)" : "color-mix(in srgb, var(--text-strong) 10%, transparent)"}
                              strokeWidth={selected ? 2 : 1}
                              width={salesBarWidth}
                              x={barX}
                              y={point.y}
                            />
                          </g>
                        );
                      })}

                      <path
                        d={salesChartPaths.linePath}
                        fill="none"
                        stroke="color-mix(in srgb, var(--accent-main) 18%, transparent)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="12"
                      />
                      <path
                        d={salesChartPaths.linePath}
                        fill="none"
                        stroke="var(--accent-main)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="4"
                      />
                    </g>

                    <line
                      stroke="var(--surface-border-strong)"
                      strokeWidth="1.5"
                      x1={salesChart.plotLeft}
                      x2={salesChart.width - salesChart.plotRight}
                      y1={salesChart.plotBottom}
                      y2={salesChart.plotBottom}
                    />
                    <line
                      stroke="var(--surface-border-strong)"
                      strokeWidth="1.5"
                      x1={salesChart.plotLeft}
                      x2={salesChart.plotLeft}
                      y1={salesChart.plotTop}
                      y2={salesChart.plotBottom}
                    />

                    {salesChartPoints.map((point, index) => {
                      const selected = index === resolvedActiveSalesPointIndex;
                      return (
                        <g key={point.label}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            fill="var(--surface-card-strong)"
                            r={selected ? 8 : 6}
                            stroke="var(--accent-main)"
                            strokeOpacity={selected ? 0.88 : 0.42}
                            strokeWidth={selected ? 4 : 2}
                          />
                          <circle cx={point.x} cy={point.y} fill="var(--accent-main)" r={selected ? 4 : 3} />
                          <text fill="var(--text-main)" fontSize="12" fontWeight="700" textAnchor="middle" x={point.x} y={salesChart.plotBottom + 28}>
                          {point.label}
                          </text>
                          <text fill="var(--text-muted)" fontSize="11" fontWeight="700" textAnchor="middle" x={point.x} y={salesChart.plotBottom + 47}>
                          {formatCompactCurrency(point.value)}
                          </text>
                        </g>
                      );
                    })}

                    {activeSalesPoint ? (
                      <g>
                        <line
                          stroke="var(--accent-main)"
                          strokeDasharray="6 7"
                          strokeOpacity="0.72"
                          strokeWidth="1.5"
                          x1={activeSalesPoint.x}
                          x2={activeSalesPoint.x}
                          y1={salesChart.plotTop}
                          y2={salesChart.plotBottom}
                        />
                        <circle
                          cx={activeSalesPoint.x}
                          cy={activeSalesPoint.y}
                          fill="var(--surface-card-strong)"
                          r="12"
                          stroke="var(--accent-main)"
                          strokeWidth="3"
                        />
                        <circle cx={activeSalesPoint.x} cy={activeSalesPoint.y} fill="var(--accent-main)" r="5" />
                        <g pointerEvents="none" transform={`translate(${salesTooltipX} ${salesTooltipY})`}>
                          <rect
                            fill="var(--bg-main)"
                            height={salesTooltipHeight}
                            rx="18"
                            stroke="var(--surface-border-strong)"
                            strokeWidth="1.5"
                            width={salesTooltipWidth}
                          />
                          <text fill="var(--text-muted)" fontSize="11" fontWeight="700" x="16" y="24">
                            {activeSalesPoint.label}
                          </text>
                          <text fill="var(--text-strong)" fontSize="22" fontWeight="800" x="16" y="52">
                            {formatCurrency(activeSalesPoint.value)}
                          </text>
                          <text fill="var(--text-muted)" fontSize="11" fontWeight="700" x="16" y="74">
                            {activeSalesPointShare}% of selected range
                          </text>
                          <text fill={activeSalesPointChange === null || activeSalesPointChange >= 0 ? "var(--accent-text)" : "var(--danger-text)"} fontSize="11" fontWeight="800" x="16" y="94">
                            {activeSalesPointChange === null
                              ? "First point in range"
                              : `${activeSalesPointChange >= 0 ? "+" : ""}${formatCurrency(activeSalesPointChange)} vs previous`}
                          </text>
                          {activeSalesPointSourceSegments.map((segment, index) => (
                            <g key={segment.label} transform={`translate(16 ${116 + index * 16})`}>
                              <circle cx="4" cy="-3" fill={segment.fill} r="3" />
                              <text fill="var(--text-muted)" fontSize="10" fontWeight="700" x="14" y="0">
                                {segment.label}
                              </text>
                              <text fill="var(--text-strong)" fontSize="10" fontWeight="800" textAnchor="end" x="214" y="0">
                                {formatCompactCurrency(segment.value)}
                              </text>
                            </g>
                          ))}
                        </g>
                      </g>
                    ) : null}

                    {salesChartPoints.map((point, index) => {
                      const hitWidth = salesBarWidth + 28;
                      const hitX = getClampedSalesBarX(point.x, hitWidth, salesChart);
                      return (
                        <rect
                          key={`${point.label}-hit`}
                          aria-label={`${point.label}: ${formatCurrency(point.value)}`}
                          fill="transparent"
                          height={salesChart.plotHeight + 72}
                          onBlur={() => setActiveSalesPointIndex(null)}
                          onFocus={() => setActiveSalesPointIndex(index)}
                          onMouseEnter={() => setActiveSalesPointIndex(index)}
                          onMouseLeave={() => setActiveSalesPointIndex(null)}
                          role="button"
                          style={{ cursor: "crosshair" }}
                          tabIndex={0}
                          width={hitWidth}
                          x={hitX}
                          y={salesChart.plotTop}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isPlatformAdmin ? (
        <section id="access-agency-performance" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7" style={sectionHeaderGlowStyle}>
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Overview</p>
            <h2 className="font-display mt-2 text-3xl text-white">Platform summary</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">
              A compact operations view for agency credits, influencer capacity, account load, and gallery output across the platform.
            </p>
          </div>

          <div className="grid gap-px bg-white/8 md:grid-cols-2 xl:grid-cols-4">
            <div
              className="border border-white/10 bg-[color:var(--surface-card-strong)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-7 sm:py-7"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--accent-main) 10%, var(--surface-card-strong)) 0%, var(--surface-card-strong) 100%)",
              }}
            >
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Influencer Models</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{models.length}</p>
              <p className="mt-3 text-sm leading-7 text-white/60">{platformAgencyTotals.assignedInfluencers.toLocaleString()} agency-owned influencer slots.</p>
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

            <div className="border border-white/10 bg-[color:var(--surface-card)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-7 sm:py-7">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agencies</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{platformAgencyTotals.agencies}</p>
              <p className="mt-3 text-sm leading-7 text-white/60">{platformAgencyTotals.activeAccounts.toLocaleString()} active accounts under agency management.</p>
            </div>

            <div className="border border-white/10 bg-[color:var(--surface-card-strong)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-7 sm:py-7">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agency Credits</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{platformAgencyTotals.creditBalance.toLocaleString()}</p>
              <p className="mt-3 text-sm leading-7 text-white/60">
                Total credit balance currently shown across all agencies.
              </p>
            </div>

            <div
              className="border border-white/10 bg-[color:var(--surface-card-strong)] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-7 sm:py-7"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--text-strong) 5%, var(--surface-card-strong)) 0%, var(--surface-card-strong) 100%)",
              }}
            >
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Gallery Outputs</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{totalGalleryAssets}</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">
                Generated assets currently available across the internal gallery surface for review, download, and reuse.
              </p>
            </div>
          </div>

          {platformNotificationsSummary}

          <div className="border-t border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-6 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Agency Operations</p>
                <h3 className="font-display mt-2 text-2xl text-[color:var(--text-strong)]">Capacity and credit control</h3>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[color:var(--text-muted)]">
                  Built for large agency rosters: search agencies, sort by risk or usage, and scan agency-owned influencer capacity, direct user grants, and credit balances without endless card scrolling.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[520px] sm:flex-row">
                <input
                  className={theme.input + " sm:min-w-[260px]"}
                  onChange={(event) => setPlatformAgencySearch(event.target.value)}
                  placeholder="Search agencies"
                  value={platformAgencySearch}
                />
                <select className={theme.input + " sm:w-[220px]"} onChange={(event) => setPlatformAgencySort(event.target.value as PlatformAgencySort)} value={platformAgencySort}>
                  <option value="NAME">Sort by name</option>
                  <option value="INFLUENCER_USAGE">Highest influencer usage</option>
                  <option value="ACCOUNTS">Most accounts</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                Showing {filteredPlatformAgencyRows.length.toLocaleString()} / {platformAgencyRows.length.toLocaleString()} agencies
              </span>
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                {platformAgencyTotals.assignedInfluencers.toLocaleString()} / {platformAgencyTotals.influencerCapacity.toLocaleString()} agency-owned slots used
              </span>
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                {platformAgencyTotals.overCapacityAgencies.toLocaleString()} over-capacity agencies
              </span>
            </div>

            <div className="mt-5 min-w-0 overflow-hidden rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] shadow-[var(--shadow-soft)]">
              <div className="max-h-[520px] min-w-0 overflow-y-auto">
                <div className="min-w-0">
                  <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1.3fr)_1.1fr_1.1fr_0.9fr_0.9fr] gap-px bg-[color:var(--surface-border)] lg:grid">
                    <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Agency</div>
                    <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Credits</div>
                    <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Agency-owned influencers</div>
                    <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Accounts</div>
                    <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Status</div>
                  </div>

                  <div className="divide-y divide-[color:var(--surface-border)]">
                    {filteredPlatformAgencyRows.map((row) => {
                      const influencerUsagePercent = row.influencerCapacity ? Math.min(100, Math.round((row.assignedInfluencers / row.influencerCapacity) * 100)) : 0;
                      const statusLabel = row.overCapacityCount > 0 ? `${row.overCapacityCount.toLocaleString()} over capacity` : `${row.openInfluencerSlots.toLocaleString()} slots open`;

                      return (
                        <div key={row.agency.id} className="grid min-w-0 gap-4 bg-[color:var(--surface-card)] px-4 py-4 text-sm transition hover:bg-[color:var(--surface-soft-hover)] lg:grid-cols-[minmax(0,1.3fr)_1.1fr_1.1fr_0.9fr_0.9fr] lg:gap-3">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-[color:var(--text-strong)]">{row.agency.name}</p>
                            </div>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                              Created {new Date(row.agency.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] lg:hidden">Credits</p>
                            <p className="font-semibold text-[color:var(--text-strong)]">{formatCreditCount(row.creditBalance)}</p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">Current agency balance</p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] lg:hidden">Agency-owned influencers</p>
                            <p className="font-semibold text-[color:var(--text-strong)]">
                              {row.assignedInfluencers.toLocaleString()} / {row.influencerCapacity.toLocaleString()} owned
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{statusLabel}</p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-soft)]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  background:
                                    row.overCapacityCount > 0
                                      ? "linear-gradient(90deg, #ef4444, #f87171)"
                                      : "linear-gradient(90deg, var(--accent-main), var(--accent-main))",
                                  width: `${influencerUsagePercent}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] lg:hidden">Accounts</p>
                            <p className="font-semibold text-[color:var(--text-strong)]">{row.activeAccounts.toLocaleString()} active</p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{row.memberCount.toLocaleString()} total accounts</p>
                            <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                              {row.directAssignmentCount.toLocaleString()} direct grant{row.directAssignmentCount === 1 ? "" : "s"} across {row.directAssigneeCount.toLocaleString()} account{row.directAssigneeCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div>
                            <span
                              className={cx(
                                "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                                row.overCapacityCount > 0
                                  ? "border-red-400/28 bg-red-500/10 text-red-100"
                                  : "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]",
                              )}
                            >
                              {row.overCapacityCount > 0 ? "Review" : "Healthy"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {!filteredPlatformAgencyRows.length ? (
                      <div className="bg-[color:var(--surface-card)] px-4 py-8 text-center text-sm text-[color:var(--text-muted)]">No agencies match this search.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {canManageAgencyCreditPolicy ? (
        <section id="access-agency-summary" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7" style={sectionHeaderGlowStyle}>
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Overview</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl text-white">Agency summary</h2>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">
                  {agencySummaryAgency?.name || currentUser.agencyName || "Your agency"} owned influencers, account mix, gallery output volume, and credit usage.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/62">
                {agencySummaryCounts.activeCount} active / {agencySummaryCounts.memberCount} total
              </span>
            </div>
          </div>

          <div className="grid gap-px bg-white/8 lg:grid-cols-[1.05fr_1.15fr_0.95fr]">
            <div
              className="px-6 py-6 sm:px-7 sm:py-7"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--accent-main) 18%, transparent) 0%, var(--surface-card-strong) 100%)",
              }}
            >
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Owned Influencers</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{agencyAvailableModels.length}</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">
                Influencer profiles owned by this agency and visible to agency admins.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {agencyAvailableModels.slice(0, 4).map((model) => (
                  <span key={model.id} className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/70">
                    {model.handle}
                  </span>
                ))}
                {agencyAvailableModels.length > 4 ? (
                  <span className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/48">
                    +{agencyAvailableModels.length - 4} more
                  </span>
                ) : null}
                {!agencyAvailableModels.length ? (
                  <span className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/48">
                    None owned
                  </span>
                ) : null}
              </div>
            </div>

            <div className="bg-[color:var(--surface-card)] px-6 py-6 sm:px-7 sm:py-7">
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agency Users</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["Agency admins", agencySummaryCounts.adminCount],
                  ["Managers", agencySummaryCounts.managerCount],
                  ["Users", agencySummaryCounts.userCount],
                  ["Active accounts", agencySummaryCounts.activeCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/42">{label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="px-6 py-6 sm:px-7 sm:py-7"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--text-strong) 6%, transparent) 0%, var(--surface-card-strong) 100%)",
              }}
            >
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Gallery Outputs</p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-white">{agencyGalleryAssets}</p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/60">
                Generated assets across {agencyBoardCount} workspace board{agencyBoardCount === 1 ? "" : "s"} for this agency.
              </p>
              <div className="mt-6 space-y-3">
                {agencyModelsByGallery.slice(0, 3).map((model) => (
                  <div key={model.id} className="flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-black/18 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{model.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/44">{model.handle}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                      {model.galleryCount} output{model.galleryCount === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            id="access-agency-credit-control"
            className="scroll-mt-32 border-t border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-6 py-6 sm:px-7 sm:py-7"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent-main) 10%, var(--surface-card)) 0%, var(--surface-card) 42%), linear-gradient(180deg, color-mix(in srgb, var(--text-strong) 5%, transparent), transparent 38%)",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Credit Controls</p>
                <h3 className="font-display mt-2 text-3xl text-[color:var(--text-strong)]">User spend and allocation</h3>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[color:var(--text-muted)]">
                  Pick one credit policy for the agency, then review spend and allocation caps for each user or manager.
                </p>
              </div>

              <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Active policy</p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">
                  {agencyCreditAccessMode === "AGENCY_POOL" ? "Shared agency pool" : "Per-user allocations"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                ["Agency pool", formatCreditCount(agencyBillingPlan.creditBalance), "Monthly credit balance"],
                ["Spent estimate", formatCreditCount(agencyEstimatedCreditsSpent), "Based on generated outputs"],
                ["Unallocated", formatCreditCount(agencyCreditUnallocatedBalance), "Remaining after user caps"],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-[24px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{label}</p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--text-strong)]">{value}</p>
                  <p className="mt-2 text-sm text-[color:var(--text-muted)]">{hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-strong)]">Credit policy</p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
                    This is the main switch for agency spending. Shared pool is simplest; per-user allocations creates explicit caps.
                  </p>
                </div>
                <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                  Choose one
                </span>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {[
                  {
                    mode: "AGENCY_POOL" as CreditAccessMode,
                    label: "Shared agency pool",
                    status: "No individual caps",
                    description: "Every eligible user draws from the same agency balance. Best when the team shares one operating budget.",
                  },
                  {
                    mode: "USER_ALLOCATION" as CreditAccessMode,
                    label: "Per-user allocations",
                    status: "Set spending caps",
                    description: "Give each user or manager a specific credit cap. Unallocated credits stay in the admin reserve.",
                  },
                ].map(({ mode, label, status, description }) => {
                  const selected = agencyCreditAccessMode === mode;
                  return (
                    <button
                      key={mode}
                      aria-pressed={selected}
                      className={cx(
                        "rounded-[24px] border px-5 py-5 text-left transition",
                        selected
                          ? "border-[color:var(--accent-main)] bg-[color:var(--accent-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-main)_42%,transparent)]"
                          : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] hover:bg-[color:var(--surface-soft-hover)]",
                      )}
                      onClick={() => handleCreditAccessModeChange(mode)}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold text-[color:var(--text-strong)]">{label}</span>
                        <span
                          className={cx(
                            "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                            selected
                              ? "border-[color:var(--accent-main)] bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                              : "border-[color:var(--surface-border)] text-[color:var(--text-muted)]",
                          )}
                        >
                          {selected ? "Selected" : status}
                        </span>
                      </span>
                      <span className="mt-3 block text-sm leading-6 text-[color:var(--text-muted)]">{description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)]">
              <div className="flex flex-wrap items-start justify-between gap-3 bg-[color:var(--surface-card)] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-strong)]">Account credit access</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                    {agencyCreditAccessMode === "AGENCY_POOL"
                      ? "All eligible users currently share the agency balance."
                      : "Enter allocation caps for users and managers below."}
                  </p>
                </div>
                <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                  {agencyCreditUsageRows.length} account{agencyCreditUsageRows.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="hidden gap-px bg-[color:var(--surface-border)] text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)] lg:grid lg:grid-cols-[minmax(0,1.25fr)_0.8fr_0.75fr_0.8fr_0.8fr_0.95fr]">
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Account</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">{agencyCreditAccessMode === "AGENCY_POOL" ? "Policy" : "Allocation cap"}</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Spent</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Outputs</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Last use</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Credit status</div>
              </div>

              <div className="max-h-[560px] divide-y divide-[color:var(--surface-border)] overflow-y-auto">
                {agencyCreditUsageRows.map((row) => {
                  const canReceiveAllocation = row.user.role === "USER" || row.user.role === "AGENCY_MANAGER";
                  const maxAllocationForUser = canReceiveAllocation
                    ? Math.max(
                        0,
                        agencyBillingPlan.creditBalance -
                          agencyCreditAssignableUsers.reduce((sum, user) => {
                            if (user.id === row.user.id) {
                              return sum;
                            }

                            return sum + parseCreditAmount(creditAllocationDrafts[user.id]);
                          }, 0),
                      )
                    : 0;
                  const allocatedCredits = clampCreditAmount(creditAllocationDrafts[row.user.id], maxAllocationForUser);
                  const hasAgencyPoolAccess = agencyCreditAccessMode === "AGENCY_POOL";
                  const availableCredits = canReceiveAllocation ? allocatedCredits : agencyCreditUnallocatedBalance;
                  return (
                    <div
                      key={row.user.id}
                      className="grid gap-4 bg-[color:var(--surface-card)] px-4 py-4 lg:grid-cols-[minmax(0,1.25fr)_0.8fr_0.75fr_0.8fr_0.8fr_0.95fr] lg:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--text-strong)]">{row.user.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{roleLabel(row.user.role)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] lg:hidden">
                          {agencyCreditAccessMode === "AGENCY_POOL" ? "Policy" : "Allocation cap"}
                        </p>
                        {agencyCreditAccessMode === "USER_ALLOCATION" && canReceiveAllocation ? (
                          <label className="block space-y-2">
                            <span className="sr-only">Credit allocation for {row.user.name}</span>
                            <input
                              className={theme.input}
                              max={maxAllocationForUser}
                              min="0"
                              onChange={(event) => handleCreditAllocationChange(row.user.id, event.target.value)}
                              step="100"
                              type="number"
                              value={creditAllocationDrafts[row.user.id] ?? "0"}
                            />
                          </label>
                        ) : (
                          <p className="text-sm font-semibold text-[color:var(--text-strong)]">
                            {hasAgencyPoolAccess ? "Shared pool" : formatCreditCount(availableCredits)}
                          </p>
                        )}
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                          {hasAgencyPoolAccess ? "Agency balance" : canReceiveAllocation ? "Available cap" : "Admin reserve"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] lg:hidden">Spent</p>
                        <p className="text-sm font-semibold text-[color:var(--text-strong)]">{formatCreditCount(row.estimatedCredits)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] lg:hidden">Outputs</p>
                        <p className="text-sm text-[color:var(--text-main)]">
                          {row.outputCount.toLocaleString()} output{row.outputCount === 1 ? "" : "s"} / {row.modelCount.toLocaleString()} model{row.modelCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] lg:hidden">Last use</p>
                        <p className="text-sm text-[color:var(--text-main)]">{formatTimestamp(row.lastGeneratedAt)}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] lg:hidden">Credit status</p>
                        <span className="inline-flex w-fit rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                          {agencyCreditAccessMode === "AGENCY_POOL" ? "Shared access" : canReceiveAllocation ? "Cap editable" : "Admin reserve"}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {!agencyCreditUsageRows.length ? (
                  <div className="bg-[color:var(--surface-card)] px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
                    No agency credit activity yet.
                  </div>
                ) : null}
              </div>
            </div>

            {renderNotice("agencyCreditPolicy", "mt-5")}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-4">
              <p className="text-sm text-[color:var(--text-muted)]">
                Managers only see and manage this section when an agency admin grants the credit-management permission.
              </p>
              <button className={theme.buttonPrimary} onClick={handleApplyCreditPolicy} type="button">
                Apply credit policy
              </button>
            </div>
          </div>

          {isAgencyAdmin ? (
            <div className="border-t border-white/8 bg-[color:var(--surface-card)] px-6 py-5 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Influencer allowance</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {agencyAvailableModels.length} / {agencyInfluencerCapacity} influencers used
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/56">
                    {agencyOpenInfluencerSlots > 0
                      ? `${agencyOpenInfluencerSlots} influencer slot${agencyOpenInfluencerSlots === 1 ? "" : "s"} still available on ${agencyBillingPlan.currentPlan}.`
                      : `${agencyBillingPlan.currentPlan} allowance is fully used. Upgrade the plan to add another influencer.`}
                  </p>
                </div>
                <button
                  className={theme.buttonPrimary}
                  disabled={agencyOpenInfluencerSlots <= 0}
                  onClick={onOpenAgencyInfluencerBuilder}
                  type="button"
                >
                  Add influencer
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section id="access-directory" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
        <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7" style={sectionHeaderGlowStyle}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Access control</p>
              <h2 className="font-display mt-2 text-3xl text-white">Directory and selected account</h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">
                {isPlatformAdmin
                  ? "Pick an account from the directory and manage its role, agency, permissions, and status. Agency admins control user-level model access inside their own agency."
                  : "Pick an account from the directory and manage its role, agency, permissions, influencer access, and status in the connected account panel."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/8 bg-black/16 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-xs uppercase tracking-[0.2em] text-white/44">Visible accounts</p>
                <p className="mt-2 text-3xl font-semibold text-white">{filteredUsers.length}</p>
              </div>
              <div className="rounded-3xl border border-white/8 bg-black/16 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-xs uppercase tracking-[0.2em] text-white/44">Selected scope</p>
                <p className="mt-2 text-sm font-semibold text-white">{accessScopeLabel(selectedUser.accessScope)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-white/8 xl:grid-cols-[1.02fr_1.08fr]">
          <div className="max-h-[1180px] overflow-y-auto bg-[color:var(--surface-card-strong)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Directory</p>
              <h3 className="font-display mt-2 text-2xl text-white">Who can see and do what</h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
                Role boundaries stay strict here; selecting any account updates the account controls beside this list.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px]">
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

          <div className="mt-5 space-y-3">
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
          </div>

          <div className="max-h-[1180px] overflow-y-auto bg-[color:var(--surface-card)] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Account</p>
              <h3 className="font-display mt-1.5 text-2xl text-white">{selectedUser.name}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                Role and agency boundaries define what this account can manage.
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-white/44">Access scope</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{accessScopeLabel(selectedUser.accessScope)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Email</p>
              <p className="mt-1.5 truncate text-sm font-semibold text-white">{selectedUser.email}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Last password reset</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{formatTimestamp(selectedUser.lastPasswordResetAt)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Created</p>
              <p className="mt-1.5 text-sm font-semibold text-white">{formatTimestamp(selectedUser.createdAt)}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-[22px] border border-white/8 bg-black/14 p-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block space-y-1.5 lg:col-span-2">
                <span className="text-sm font-semibold text-white/80">Account name</span>
                <input
                  className={theme.input}
                  disabled={!canRenameSelected}
                  value={accountDraft.name}
                  onChange={(event) => setAccountDraft((current) => (current ? { ...current, name: event.target.value } : current))}
                />
              </label>

              <label className="block space-y-1.5">
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

              <label className="block space-y-1.5">
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
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/58 lg:col-span-2">
                  Platform admin accounts always remain global and cannot be linked to a specific agency.
                </div>
              ) : null}

              <label className="block space-y-1.5">
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

              <div className="flex flex-wrap items-end gap-3">
                <button className={theme.buttonPrimary} disabled={!hasPendingAccountChanges} onClick={() => void handleApplyAccount()} type="button">
                  Apply settings
                </button>
                <button className={theme.buttonSecondary} disabled={!canResetSelectedPassword} onClick={() => void handleResetPassword()} type="button">
                  Reset password
                </button>
              </div>
            </div>

            {renderNotice("accountSettings", "mt-3")}

            {temporaryPassword?.userId === selectedUser.id ? (
              <div className="rounded-2xl border border-lime-300/25 bg-lime-300/10 px-4 py-3 text-sm text-lime-100">
                Temporary password: <span className="font-semibold text-lime-50">{temporaryPassword.value}</span>
              </div>
            ) : null}

            {!canRenameSelected && !canChangeRole && !canToggleSelectedStatus ? (
              <p className="text-sm leading-6 text-white/52">
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
                    These toggles control whether a manager can suspend users, delete users, reset passwords, manage influencer assignments, or manage agency credit controls for users inside their agency.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {managerPermissionOptions.map(({ key, label }) => (
                  <label
                    key={key}
                    className={cx(
                      "flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/72",
                      !canEditManagerPermissions && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span>{label}</span>
                    <input
                      checked={managerPermissionDraft[key]}
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

              {renderNotice("managerPermissions", "mt-5")}

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

          {!isPlatformAdmin ? (
          <div className="mt-6 rounded-[28px] border border-white/8 bg-black/14 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Influencer access</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56">
                  Users and managers receive direct influencer assignments. Agency-owned influencers are capacity at the agency level; direct assignments are the per-account grants below.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                  {selectedUser.effectiveModelIds.length} effective access
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                  {selectedUser.assignedModelIds.length} direct grants
                </span>
              </div>
            </div>

            {selectedUser.role === "USER" || selectedUser.role === "AGENCY_MANAGER" ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {assignableModels.map((model) => {
                    const selected = assignmentDraft.includes(model.id);
                    const enabledForSelectedUserAgency =
                      !selectedUserAgencyIds.length || model.assignedAgencyIds.some((agencyId) => selectedUserAgencyIds.includes(agencyId));
                    const modelIsUnowned = model.assignedAgencyIds.length === 0;
                    const modelOwnerAgencyName = model.assignedAgencyNames[0] || "another agency";
                    const canAssignUnownedToSelectedAgency = isPlatformAdmin && modelIsUnowned && Boolean(selectedUserPrimaryAgencyId);
                    const canToggleAssignment = canEditAssignments && (enabledForSelectedUserAgency || canAssignUnownedToSelectedAgency);
                    return (
                      <button
                        key={model.id}
                        className={cx(
                          "rounded-3xl border px-4 py-4 text-left transition",
                          selected
                            ? "border-lime-300/35 bg-lime-300/12"
                            : enabledForSelectedUserAgency
                              ? "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
                              : "border-amber-300/18 bg-amber-300/[0.06] hover:border-amber-300/28 hover:bg-amber-300/[0.09]",
                          !canToggleAssignment && "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-white/8 disabled:hover:bg-white/[0.03]",
                        )}
                        disabled={!canToggleAssignment}
                        onClick={() => canToggleAssignment && setAssignmentDraft((current) => toggleId(current, model.id))}
                        type="button"
                      >
                        <p className="font-semibold text-white">{model.name}</p>
                        <p className="mt-1 text-sm uppercase tracking-[0.18em] text-white/46">{model.handle}</p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/46">
                          {enabledForSelectedUserAgency
                            ? `Owned by ${selectedUserAgencyLabel}`
                            : canAssignUnownedToSelectedAgency
                              ? `Will assign to ${selectedUserAgencyLabel}`
                              : modelIsUnowned
                                ? "Assign owner agency first"
                                : `Exclusive to ${modelOwnerAgencyName}`}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {!assignableModels.length ? (
                  <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
                    No active influencer models are currently available for direct assignment.
                  </div>
                ) : null}

                {renderNotice("influencerAccess", "mt-5")}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button className={theme.buttonPrimary} disabled={!canEditAssignments || !hasAssignmentChanges} onClick={() => void handleApplyAssignments()} type="button">
                    {pendingUnownedAgencyEnablementModels.length ? "Assign owner and apply access" : "Apply influencer access"}
                  </button>
                  {pendingUnownedAgencyEnablementModels.length ? (
                    <p className="text-sm text-amber-100/72">
                      {pendingUnownedAgencyEnablementModels.length} unassigned influencer{pendingUnownedAgencyEnablementModels.length === 1 ? "" : "s"} will be assigned to {selectedUserAgencyLabel} before direct access is saved.
                    </p>
                  ) : null}
                  {!pendingAgencyEnablementModels.length && agencyUnavailableAssignmentCount > 0 && isPlatformAdmin ? (
                    <p className="text-sm text-white/48">
                      {agencyUnavailableAssignmentCount} active model{agencyUnavailableAssignmentCount === 1 ? "" : "s"} are exclusive to another agency.
                    </p>
                  ) : null}
                  {!canEditAssignments ? (
                    <p className="text-sm text-white/48">Only agency admins or managers with assignment control can update these access grants.</p>
                  ) : null}
                </div>
              </>
            ) : selectedUser.role === "AGENCY_ADMIN" ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
                  Agency admins inherit every influencer owned by their agency. Platform admins can assign unowned influencers, remove current ownership, or transfer exclusive ownership from another agency.
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {assignableModels.map((model) => {
                    const ownedBySelectedAgency = Boolean(selectedUser.agencyId && model.assignedAgencyIds.includes(selectedUser.agencyId));
                    const modelIsUnowned = model.assignedAgencyIds.length === 0;
                    const modelOwnerAgencyName = model.assignedAgencyNames[0] || "another agency";
                    const canManageSelectedAgencyOwnership = isPlatformAdmin && Boolean(selectedUser.agencyId);
                    const selectedAgencyName = selectedUser.agencyName || "this agency";
                    return (
                      <button
                        key={model.id}
                        className={cx(
                          "rounded-3xl border px-4 py-4 text-left transition",
                          ownedBySelectedAgency
                            ? "border-lime-300/35 bg-lime-300/12"
                            : modelIsUnowned
                              ? "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
                              : "border-amber-300/18 bg-amber-300/[0.06] hover:border-amber-300/28 hover:bg-amber-300/[0.09]",
                          !canManageSelectedAgencyOwnership && "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-white/8 disabled:hover:bg-white/[0.03]",
                        )}
                        disabled={!canManageSelectedAgencyOwnership}
                        onClick={() => canManageSelectedAgencyOwnership && void handleToggleSelectedAgencyModelAccess(model)}
                        type="button"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{model.name}</p>
                            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-white/46">{model.handle}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                            {ownedBySelectedAgency ? "Owned here" : modelIsUnowned ? "Assign here" : "Transfer here"}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/46">
                          {ownedBySelectedAgency
                            ? `Owned by ${selectedAgencyName}`
                            : modelIsUnowned
                              ? `No owner yet - assign to ${selectedAgencyName}`
                              : `Current owner: ${modelOwnerAgencyName} - transfer to ${selectedAgencyName}`}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {!isPlatformAdmin ? (
                  <p className="text-sm text-white/48">Only platform admins can change agency-level influencer ownership.</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
                {selectedUser.role === "PLATFORM_ADMIN"
                  ? "Platform admins can access the full influencer model library across the platform."
                  : "This role does not use individual influencer assignment cards."}
              </div>
            )}
          </div>
          ) : null}

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
            {renderNotice("deleteAccount", "mt-4")}
            {!canDeleteSelected ? (
              <p className="mt-4 text-sm text-rose-100/62">
                You can review this account, but deleting it is outside your current permission boundary.
              </p>
            ) : null}
          </div>
          </div>
        </div>
      </section>

      {isPlatformAdmin ? (
        <div className="space-y-6">
          <section id="access-agency-settings" className={theme.cardStrong + " glass-panel theme-smooth scroll-mt-32 overflow-hidden p-0"}>
            <div className="border-b border-white/8 px-5 py-5 sm:px-6 sm:py-6" style={sectionHeaderGlowStyle}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agencies</p>
                  <h3 className="font-display mt-2 text-2xl text-white">Agency settings</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
                    Create, rename, remove, and tune agency billing settings from one operations view.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-right">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Agencies</p>
                    <p className="mt-1 text-lg font-semibold text-white">{agencies.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Members</p>
                    <p className="mt-1 text-lg font-semibold text-white">{platformAgencyRows.reduce((sum, row) => sum + row.memberCount, 0)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">Active</p>
                    <p className="mt-1 text-lg font-semibold text-white">{platformAgencyRows.reduce((sum, row) => sum + row.activeAccounts, 0)}</p>
                  </div>
                </div>
              </div>

              <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]" onSubmit={handleCreateAgency}>
                <input className={theme.input} placeholder="Create a new agency" value={newAgencyName} onChange={(event) => setNewAgencyName(event.target.value)} />
                <button className={theme.buttonPrimary + " w-full"} type="submit">
                  Create
                </button>
              </form>

              {renderNotice("agencySettings", "mt-4")}
              {renderNotice("agencyBillingSettings", "mt-4")}

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
                <input
                  className={theme.input}
                  onChange={(event) => setAgencySettingsSearch(event.target.value)}
                  placeholder="Search agency name or slug"
                  value={agencySettingsSearch}
                />
                <select className={theme.input} onChange={(event) => setAgencySettingsSort(event.target.value as AgencySettingsSort)} value={agencySettingsSort}>
                  <option value="NAME">Sort by name</option>
                  <option value="MEMBERS">Most members</option>
                  <option value="ACTIVE">Most active</option>
                  <option value="ADMINS">Most admins</option>
                </select>
              </div>
            </div>

            <div className="max-h-[860px] overflow-y-auto">
              <div className="sticky top-0 z-10 hidden grid-cols-[minmax(220px,1.15fr)_220px_190px_minmax(260px,1fr)_170px] gap-px bg-[color:var(--surface-border)] text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] lg:grid">
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Agency</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Roster</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Influencers</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Rename</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-right">Actions</div>
              </div>

              <div className="divide-y divide-[color:var(--surface-border)]">
                {agencySettingsRows.map((row) => {
                  const agency = row.agency;
                  const agencyBillingDraft = agencyBillingDrafts[agency.id] ?? buildAgencyBillingSettingsDraft(row.billingSettings);
                  const billingSettingsExpanded = expandedAgencyBillingId === agency.id;
                  const agencyScopedMembers = users.filter((user) => user.agencyId === agency.id && user.role !== "PLATFORM_ADMIN");
                  const retainedAdmins = users.filter((user) => user.agencyId === agency.id && user.role === "PLATFORM_ADMIN");
                  const deleteSummary = `${agencyScopedMembers.length} scoped account${agencyScopedMembers.length === 1 ? "" : "s"} affected${
                    retainedAdmins.length ? `, ${retainedAdmins.length} platform admin${retainedAdmins.length === 1 ? "" : "s"} detached` : ""
                  }`;

                  return (
                    <div key={agency.id} className="grid gap-4 border-b border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-4 text-sm transition last:border-b-0 hover:bg-[color:var(--surface-soft-hover)] lg:grid-cols-[minmax(220px,1.15fr)_220px_190px_minmax(260px,1fr)_170px] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[color:var(--text-strong)]">{agency.name}</p>
                        <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{agency.slug}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-muted)]">Created {new Date(agency.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] lg:hidden">Roster</p>
                        <p className="font-semibold text-[color:var(--text-strong)]">{row.memberCount} total / {row.activeAccounts} active</p>
                        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                          {agency.adminCount} admins / {agency.managerCount} managers / {agency.userCount} users
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] lg:hidden">Influencers</p>
                        <p className="font-semibold text-[color:var(--text-strong)]">{row.assignedInfluencers} / {row.influencerCapacity} owned</p>
                        <p className={cx("mt-1 text-xs", row.overCapacityCount > 0 ? "text-red-100/72" : "text-[color:var(--text-muted)]")}>
                          {row.overCapacityCount > 0 ? `${row.overCapacityCount} over capacity` : `${row.openInfluencerSlots} slots open`}
                        </p>
                      </div>
                      <label className="block space-y-2">
                        <span className="sr-only">Rename {agency.name}</span>
                        <input
                          className={theme.input}
                          value={agencyDrafts[agency.id] || ""}
                          onChange={(event) => setAgencyDrafts((current) => ({ ...current, [agency.id]: event.target.value }))}
                        />
                      </label>
                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                        <button
                          aria-expanded={billingSettingsExpanded}
                          className={cx(
                            "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition",
                            billingSettingsExpanded
                              ? "border-[color:var(--accent-main)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]"
                              : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-main)] hover:bg-[color:var(--surface-soft-hover)]",
                          )}
                          onClick={() => setExpandedAgencyBillingId((current) => (current === agency.id ? null : agency.id))}
                          title="Billing & allowance settings"
                          type="button"
                        >
                          <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
                            <path
                              d="M8.95 2.25h2.1l.42 1.92c.43.14.84.31 1.22.52l1.67-1.06 1.49 1.49-1.06 1.67c.21.38.38.79.52 1.22l1.92.42v2.1l-1.92.42a5.62 5.62 0 0 1-.52 1.22l1.06 1.67-1.49 1.49-1.67-1.06c-.38.21-.79.38-1.22.52l-.42 1.92h-2.1l-.42-1.92a5.62 5.62 0 0 1-1.22-.52l-1.67 1.06-1.49-1.49 1.06-1.67a5.62 5.62 0 0 1-.52-1.22l-1.92-.42v-2.1l1.92-.42c.14-.43.31-.84.52-1.22L4.15 5.12l1.49-1.49 1.67 1.06c.38-.21.79-.38 1.22-.52l.42-1.92ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
                              fill="currentColor"
                            />
                          </svg>
                          Settings
                        </button>
                        <button className={theme.buttonSecondary} onClick={() => void handleRenameAgency(agency)} type="button">
                          Rename
                        </button>
                        <button className={theme.buttonDanger} onClick={() => void handleDeleteAgency(agency)} title={deleteSummary} type="button">
                          Delete
                        </button>
                      </div>
                      {billingSettingsExpanded ? (
                      <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text-strong)_5%,transparent)] lg:col-span-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">BILLING & ALLOWANCE SETTINGS</p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                              Set the subscription details and limits shown in agency billing and enforced for agency-owned influencer capacity.
                            </p>
                          </div>
                          <button className={theme.buttonSecondary} onClick={() => void handleSaveAgencyBillingSettings(agency)} type="button">
                            Save billing
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            ["monthlySubscriptionPrice", "Monthly Subscription", "USD per month"],
                            ["includedMonthlyCredits", "Included Monthly Credits", "USD credits per month"],
                            ["aiInfluencerAllowance", "AI Influencer Allowance", "Per agency"],
                            ["workspaceTabAllowance", "Workspace Tab Allowance", "Per employee"],
                            ["parallelRowGenerations", "Parallel Row Generations", "Per seat"],
                            ["teamSeatAllowance", "Team Seat Allowance", "Agency seats"],
                          ].map(([field, label, hint]) => (
                            <label key={field} className="block space-y-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">{label}</span>
                              <input
                                className={theme.input}
                                min="0"
                                onChange={(event) => handleAgencyBillingDraftChange(agency.id, field as keyof AgencyBillingSettings, event.target.value)}
                                step="1"
                                type="number"
                                value={agencyBillingDraft[field as keyof AgencyBillingSettings]}
                              />
                              <span className="block text-xs text-[color:var(--text-muted)]">{hint}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      ) : null}
                    </div>
                  );
                })}

                {!agencySettingsRows.length ? (
                  <div className="bg-[color:var(--surface-card)] px-5 py-10 text-center text-sm text-white/52">
                    No agencies match this search.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {canCreateAccounts ? (
            <section id="access-create-accounts" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
              <div className="border-b border-white/8 px-5 py-5 sm:px-6 sm:py-6" style={sectionHeaderGlowStyle}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/42">Provisioning</p>
                    <h3 className="font-display mt-2 text-3xl text-white">Create platform accounts</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
                      Create platform-wide admins or agency-scoped accounts. For user accounts, choose an agency first, then grant influencer access below.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/16 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/42">Directory size</p>
                    <p className="mt-1 text-sm font-semibold text-white">{users.length} existing accounts</p>
                  </div>
                </div>
              </div>

              <form className="bg-[color:var(--surface-card)] p-5 sm:p-6" onSubmit={handleCreateUser}>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/76">Full name</span>
                      <input
                        className={theme.input}
                        placeholder="New account name"
                        value={createForm.name}
                        onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/76">Email</span>
                      <input
                        className={theme.input}
                        placeholder="email@company.com"
                        value={createForm.email}
                        onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/76">Role</span>
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
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/76">Agency</span>
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
                    </label>

                    {renderCreateManagerPermissionControls("lg:col-span-2")}

                    <label className="block space-y-2 lg:col-span-2">
                      <span className="text-sm font-semibold text-white/76">Temporary password</span>
                      <input
                        className={theme.input}
                        placeholder="Set temporary password"
                        type="password"
                        value={createForm.password}
                        onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                      />
                    </label>

                    {isAgencyAdmin ? (
                      <p className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/62 lg:col-span-2">
                        New accounts will be created inside {currentUser.agencyName || "your agency"}.
                      </p>
                    ) : null}
                  </div>

                  <aside className="rounded-[22px] border border-white/8 bg-black/14 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/42">Preview</p>
                        <p className="mt-2 text-base font-semibold text-white">{createForm.name || "Unnamed account"}</p>
                        <p className="mt-1 truncate text-sm text-white/54">{createForm.email || "email@company.com"}</p>
                      </div>
                      <span className={cx("shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", roleBadgeClass(createForm.role))}>
                        {roleLabel(createForm.role)}
                      </span>
                    </div>

                    <dl className="mt-5 space-y-3 border-t border-white/8 pt-4">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-white/38">Scope</dt>
                        <dd className="mt-1 text-sm font-semibold text-white">
                          {createForm.role === "PLATFORM_ADMIN"
                            ? "Global platform"
                            : agencies.find((agency) => agency.id === createForm.agencyId)?.name || currentUser.agencyName || "No agency selected"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.18em] text-white/38">Credentials</dt>
                        <dd className="mt-1 text-sm text-white/58">
                          {createForm.password ? "Temporary password ready" : "Temporary password required"}
                        </dd>
                      </div>
                      {createForm.role === "AGENCY_MANAGER" ? (
                        <div>
                          <dt className="text-xs uppercase tracking-[0.18em] text-white/38">Manager permissions</dt>
                          <dd className="mt-1 text-sm text-white/58">
                            {managerPermissionOptions.filter(({ key }) => createManagerPermissionDraft[key]).length} enabled
                          </dd>
                        </div>
                      ) : null}
                      {createForm.role === "USER" ? (
                        <div>
                          <dt className="text-xs uppercase tracking-[0.18em] text-white/38">Influencer access</dt>
                          <dd className="mt-1 text-sm text-white/58">
                            {createAssignmentDraft.length} direct grant{createAssignmentDraft.length === 1 ? "" : "s"}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <p className="mt-5 text-sm leading-6 text-white/52">
                      Passwords can be reset later from the selected account panel.
                    </p>

                    {renderNotice("createAccount", "mt-4")}

                    <button className={theme.buttonPrimary + " mt-4 w-full"} type="submit">
                      Create account
                    </button>
                  </aside>
                </div>
                {renderCreateInfluencerAccessControls("mt-5")}
              </form>
            </section>
          ) : null}
          <section id="access-influencer-profiles" className={theme.cardStrong + " glass-panel theme-smooth max-h-[980px] scroll-mt-32 overflow-y-auto p-0"}>
            <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7" style={sectionHeaderGlowStyle}>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Influencers</p>
              <h3 className="font-display mt-2 text-3xl text-white">Influencer profile setup</h3>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-white/56">
                Only the platform administrator can create and manage AI influencer models. Every new profile ships with the full generation toolset by default, while agency ownership is controlled here and updates access immediately for agency admins.
              </p>
            </div>

            <div className="p-6 sm:p-7">

            <form className="mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03]" onSubmit={handleCreateInfluencer}>
              <div className="grid gap-px bg-white/8 xl:grid-cols-[minmax(0,1.1fr)_360px]">
                <div className="bg-[color:var(--surface-card)] p-4 sm:p-5">
                  <div>
                    <p className="text-sm font-semibold text-white">Create profile</p>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/54">Build the public identity first, then add the cropped circular image that will appear across the app.</p>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <input className={theme.input} placeholder="Influencer name" value={modelForm.name} onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))} />
                    <input className={theme.input} placeholder="@handle" value={modelForm.handle} onChange={(event) => setModelForm((current) => ({ ...current, handle: event.target.value }))} />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button className={theme.buttonPrimary} type="submit">
                      Add influencer
                    </button>
                    <p className="text-sm text-white/48">Generation defaults are attached automatically.</p>
                  </div>
                </div>

                <div className="bg-[color:var(--surface-card-strong)] p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <InfluencerAvatar
                      model={{
                        accentFrom: "from-lime-300",
                        accentTo: "to-emerald-400",
                        avatarImageUrl: modelForm.avatarImageUrl || null,
                        avatarLabel: buildProfileInitials(modelForm.name),
                        name: modelForm.name || "New influencer",
                      }}
                      size="xl"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{modelForm.name || "New influencer"}</p>
                      <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-white/46">{modelForm.handle || "@handle"}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-white/8 bg-black/14 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Circular profile image</p>
                      <p className="mt-1 text-sm text-white/54">Upload, crop, drag, and scale before saving.</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className={theme.buttonSecondary} disabled={isUploadingAvatar} onClick={() => createAvatarInputRef.current?.click()} type="button">
                        {modelForm.avatarImageUrl ? "Replace image" : "Upload image"}
                      </button>
                      {modelForm.avatarImageUrl ? (
                        <button className={theme.buttonSecondary} disabled={isUploadingAvatar} onClick={() => setModelForm((current) => ({ ...current, avatarImageUrl: "" }))} type="button">
                          Remove image
                        </button>
                      ) : null}
                    </div>
                    <input ref={createAvatarInputRef} accept="image/*" className="hidden" onChange={(event) => handleProfileImageChange(event, "create")} type="file" />
                  </div>
                </div>
              </div>

              {renderNotice("createInfluencer", "border-t border-white/8 bg-[color:var(--surface-card)] p-4 sm:p-5")}
            </form>

            <div className="mt-9 border-t border-white/8 pt-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Agency availability and control</p>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56">
                    Assign each influencer to exactly one owner agency. Transferring ownership immediately moves agency-admin access and cleans stale direct assignments from the previous agency.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/44">Library</p>
                  <p className="mt-2 text-sm font-semibold text-white">{models.length} influencer models</p>
                </div>
              </div>

              {models.length ? (
                <>
                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.45fr)]">
                    <div className="overflow-hidden rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] transition-colors duration-300 ease-out">
                      <div className="border-b border-[color:var(--surface-border)] p-4 transition-colors duration-300 ease-out sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)] transition-colors duration-300 ease-out">Influencer library</p>
                            <p className="mt-2 text-sm font-semibold text-[color:var(--text-strong)] transition-colors duration-300 ease-out">
                              {filteredInfluencerModels.length} of {models.length} visible
                            </p>
                          </div>
                          <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)] transition-colors duration-300 ease-out">
                            {models.filter((model) => model.assignedAgencyIds.length === 0).length} unassigned
                          </span>
                        </div>

                        <input
                          className={theme.input + " mt-4"}
                          placeholder="Search influencers or owner agencies"
                          value={influencerLibrarySearch}
                          onChange={(event) => setInfluencerLibrarySearch(event.target.value)}
                        />
                      </div>

                      <div className="max-h-[620px] divide-y divide-[color:var(--surface-border)] overflow-y-auto transition-colors duration-300 ease-out">
                        {filteredInfluencerModels.map((model) => {
                          const active = model.id === selectedInfluencer?.id;
                          return (
                            <button
                              key={model.id}
                              className={cx(
                                "grid w-full gap-3 border-b border-[color:var(--surface-border)] px-4 py-4 text-left transition-colors duration-300 ease-out last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                                active
                                  ? "bg-[color:var(--accent-soft)]"
                                  : "bg-[color:var(--surface-card)] hover:bg-[color:var(--surface-soft-hover)]",
                              )}
                              onClick={() => setSelectedInfluencerId(model.id)}
                              type="button"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <InfluencerAvatar model={model} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-[color:var(--text-strong)] transition-colors duration-300 ease-out">{model.name}</p>
                                    {active ? (
                                      <span className="rounded-full bg-[color:var(--accent-main)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-foreground)] transition-colors duration-300 ease-out">Selected</span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)] transition-colors duration-300 ease-out">{model.handle}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition-colors duration-300 ease-out">
                                      {model.outputCount} outputs
                                    </span>
                                    <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[color:var(--text-muted)] transition-colors duration-300 ease-out">
                                      {model.platformWorkflowCount + model.customWorkflowCount} workflows
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 sm:justify-end">
                                <span className="shrink-0 rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)] transition-colors duration-300 ease-out">
                                  {model.assignedAgencyNames[0] || "Unassigned"}
                                </span>
                                <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-300 ease-out", active ? "bg-[color:var(--accent-main)]" : "bg-[color:var(--surface-border-strong)]")} />
                              </div>
                            </button>
                          );
                        })}

                        {!filteredInfluencerModels.length ? (
                          <div className="m-4 rounded-2xl border border-dashed border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)] transition-colors duration-300 ease-out">
                            No influencers match this search.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {selectedInfluencer ? (
                      <div className="rounded-[28px] border border-white/8 bg-black/14 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-4">
                            <InfluencerAvatar
                              model={{
                                ...selectedInfluencer,
                                avatarImageUrl: modelProfileDraft.avatarImageUrl || null,
                                avatarLabel: buildProfileInitials(modelProfileDraft.name),
                                name: modelProfileDraft.name || selectedInfluencer.name,
                              }}
                              size="lg"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{modelProfileDraft.name || selectedInfluencer.name}</p>
                              <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-white/46">{modelProfileDraft.handle || selectedInfluencer.handle}</p>
                            </div>
                          </div>
                          <div className="min-w-[180px] rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/44">Current owner</p>
                            <p className="mt-2 text-sm font-semibold text-white">{selectedInfluencerCurrentAgencyName}</p>
                          </div>
                        </div>

                        <form className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] p-4" onSubmit={handleUpdateInfluencerProfile}>
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-white">Edit selected profile</p>
                              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/54">Changes apply to the influencer selected on the left.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button className={theme.buttonSecondary} disabled={isUploadingAvatar} onClick={() => editAvatarInputRef.current?.click()} type="button">
                                {modelProfileDraft.avatarImageUrl ? "Replace image" : "Upload image"}
                              </button>
                              {modelProfileDraft.avatarImageUrl ? (
                                <button className={theme.buttonSecondary} disabled={isUploadingAvatar} onClick={() => setModelProfileDraft((current) => ({ ...current, avatarImageUrl: "" }))} type="button">
                                  Remove image
                                </button>
                              ) : null}
                            </div>
                            <input ref={editAvatarInputRef} accept="image/*" className="hidden" onChange={(event) => handleProfileImageChange(event, "edit")} type="file" />
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <input className={theme.input} placeholder="Influencer name" value={modelProfileDraft.name} onChange={(event) => setModelProfileDraft((current) => ({ ...current, name: event.target.value }))} />
                            <input className={theme.input} placeholder="@handle" value={modelProfileDraft.handle} onChange={(event) => setModelProfileDraft((current) => ({ ...current, handle: event.target.value }))} />
                          </div>

                          {renderNotice("influencerProfile", "mt-4")}
                          {renderNotice("deleteInfluencer", "mt-4")}

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button className={theme.buttonPrimary} disabled={!hasModelProfileChanges} type="submit">
                              Save profile changes
                            </button>
                            <button
                              className={theme.buttonSecondary}
                              disabled={!hasModelProfileChanges}
                              onClick={() =>
                                setModelProfileDraft({
                                  name: selectedInfluencer.name,
                                  handle: selectedInfluencer.handle,
                                  avatarImageUrl: selectedInfluencer.avatarImageUrl || "",
                                })
                              }
                              type="button"
                            >
                              Reset
                            </button>
                            <button className={theme.buttonDanger} onClick={() => setInfluencerPendingDeletionId(selectedInfluencer.id)} type="button">
                              Delete
                            </button>
                          </div>
                        </form>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/44">Workflow</p>
                            <p className="mt-2 text-sm font-semibold text-white">{selectedInfluencer.defaultPlatformWorkflowName}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/44">Platform workflows</p>
                            <p className="mt-2 text-lg font-semibold text-white">{selectedInfluencer.platformWorkflowCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/44">Custom workflows</p>
                            <p className="mt-2 text-lg font-semibold text-white">{selectedInfluencer.customWorkflowCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/44">Outputs</p>
                            <p className="mt-2 text-lg font-semibold text-white">{selectedInfluencer.outputCount}</p>
                          </div>
                        </div>

                        <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Owner transfer</p>
                              <p className="mt-2 text-sm leading-7 text-white/56">
                                Search the agency roster, choose the next exclusive owner, then apply the ownership update.
                              </p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-white/62">
                              {filteredInfluencerAgencies.length} shown
                            </span>
                          </div>

                          <div className="mt-4">
                            <input
                              className={theme.input}
                              placeholder="Search agencies"
                              value={influencerAgencySearch}
                              onChange={(event) => setInfluencerAgencySearch(event.target.value)}
                            />
                          </div>

                          <div className="mt-4 max-h-[520px] overflow-y-auto rounded-2xl border border-white/8 bg-black/18">
                            <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,1.2fr)_130px_170px] gap-4 border-b border-white/8 bg-[var(--surface-card-strong)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/42 md:grid">
                              <span>Agency</span>
                              <span>Accounts</span>
                              <span className="text-right">Ownership change</span>
                            </div>

                            {filteredInfluencerAgencies.map((agency) => {
                              const selected = influencerAgencyDraft.includes(agency.id);
                              const currentOwner = agency.id === selectedInfluencerCurrentAgencyId;
                              const willBecomeOwner = selected && !currentOwner;
                              const scopedMembers = agency.adminCount + agency.managerCount + agency.userCount;
                              return (
                                <button
                                  key={agency.id}
                                  className={cx(
                                    "grid w-full gap-3 border-b border-white/8 px-4 py-4 text-left transition last:border-b-0 md:grid-cols-[minmax(0,1.2fr)_130px_170px] md:items-center md:gap-4",
                                    currentOwner
                                      ? "bg-lime-300/[0.08] hover:bg-lime-300/[0.12]"
                                      : willBecomeOwner
                                        ? "bg-amber-300/[0.08] hover:bg-amber-300/[0.12]"
                                        : "hover:bg-white/[0.035]",
                                  )}
                                  onClick={() => setInfluencerAgencyDraft([agency.id])}
                                  type="button"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">{agency.name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">{agency.slug}</p>
                                  </div>
                                  <p className="text-sm text-white/56">{scopedMembers} accounts</p>
                                  <div className="flex justify-start md:justify-end">
                                    <span
                                      className={cx(
                                        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                                        currentOwner
                                          ? "bg-lime-300/14 text-lime-100"
                                          : willBecomeOwner
                                            ? "bg-amber-300/14 text-amber-100"
                                            : "bg-white/[0.06] text-white/46",
                                      )}
                                    >
                                      {currentOwner && selected ? "Current owner" : willBecomeOwner ? "New owner" : currentOwner ? "Current owner" : "Select"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}

                            {!filteredInfluencerAgencies.length ? (
                              <div className="p-5 text-sm text-white/50">No agencies match this filter.</div>
                            ) : null}
                          </div>
                        </div>

                        {renderNotice("influencerOwnership", "mt-5")}

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button className={theme.buttonPrimary} disabled={!hasInfluencerAvailabilityChanges} onClick={() => void handleApplyInfluencerAvailability()} type="button">
                            {influencerOwnershipActionLabel}
                          </button>
                          <p className="text-sm text-white/48">
                            Platform admins retain global access regardless of the exclusive owner agency.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/54">
                  Create an influencer model first, then assign it to the agencies that should be allowed to use it.
                </div>
              )}
            </div>
            </div>
          </section>
        </div>
      ) : null}

      {isAgencyAdmin ? (
        <section id="access-create-accounts" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
          <div className="border-b border-white/8 px-5 py-5 sm:px-6 sm:py-6" style={sectionHeaderGlowStyle}>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/42">Provisioning</p>
                <h3 className="font-display mt-2 text-3xl text-white">Create agency accounts</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
                  Add teammates to {currentUser.agencyName || "your agency"} with the right day-one access.
                </p>
              </div>

              <div className="grid w-full gap-2 text-right sm:w-auto sm:grid-cols-3">
                {[
                  ["Agency", currentUser.agencyName || "Assigned"],
                  ["Active", agencySummaryCounts.activeCount.toLocaleString()],
                  ["Managers", agencySummaryCounts.managerCount.toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/16 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form className="grid gap-px bg-white/8 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={handleCreateUser}>
            <div className="bg-[color:var(--surface-card)] p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-white/76">Full name</span>
                  <input
                    className={theme.input}
                    placeholder="New teammate"
                    value={createForm.name}
                    onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-white/76">Email</span>
                  <input
                    className={theme.input}
                    placeholder="name@agency.com"
                    type="email"
                    value={createForm.email}
                    onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-white/76">Temporary password</span>
                  <input
                    className={theme.input}
                    placeholder="Set temporary password"
                    type="password"
                    value={createForm.password}
                    onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                  />
                </label>

                <div className="space-y-2">
                  <span className="block text-sm font-semibold text-white/76">Agency</span>
                  <div className="flex min-h-[46px] items-center rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{currentUser.agencyName || "Your agency"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">Locked scope</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-semibold text-white/76">Role</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    ["USER", "User", "Workspace access"],
                    ["AGENCY_MANAGER", "Agency Manager", "Team oversight"],
                  ].map(([value, label, hint]) => {
                    const selected = createForm.role === value;

                    return (
                      <button
                        key={value}
                        className={cx(
                          "rounded-2xl border px-4 py-3 text-left transition",
                          selected
                            ? "border-[color:var(--accent-main)] bg-[color:var(--accent-soft)] text-white shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-main)_42%,transparent)]"
                            : "border-white/8 bg-white/[0.03] text-white/66 hover:border-white/16 hover:bg-white/[0.05]",
                        )}
                        onClick={() => setCreateForm((current) => ({ ...current, role: value as Role }))}
                        type="button"
                      >
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="mt-1 block text-xs uppercase tracking-[0.14em] opacity-60">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {renderCreateManagerPermissionControls("mt-5")}
              {renderCreateInfluencerAccessControls("mt-5")}
            </div>

            <aside className="bg-[color:var(--surface-card-strong)] p-5 sm:p-6">
              <div className="rounded-[24px] border border-white/8 bg-black/14 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-base font-semibold text-white">
                    {buildProfileInitials(createForm.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{createForm.name || "New account"}</p>
                    <p className="mt-1 truncate text-sm text-white/52">{createForm.email || "name@agency.com"}</p>
                  </div>
                </div>

                <dl className="mt-5 space-y-3 border-t border-white/8 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-xs uppercase tracking-[0.16em] text-white/38">Role</dt>
                    <dd className={cx("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", roleBadgeClass(createForm.role))}>
                      {roleLabel(createForm.role)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-white/38">Scope</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-white">{currentUser.agencyName || "Your agency"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.16em] text-white/38">Credentials</dt>
                    <dd className="mt-1 text-sm text-white/58">
                      {createForm.password ? "Temporary password ready" : "Temporary password required"}
                    </dd>
                  </div>
                  {createForm.role === "AGENCY_MANAGER" ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.16em] text-white/38">Manager permissions</dt>
                      <dd className="mt-1 text-sm text-white/58">
                        {managerPermissionOptions.filter(({ key }) => createManagerPermissionDraft[key]).length} enabled
                      </dd>
                    </div>
                  ) : null}
                  {createForm.role === "USER" ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.16em] text-white/38">Influencer access</dt>
                      <dd className="mt-1 text-sm text-white/58">
                        {createAssignmentDraft.length} direct grant{createAssignmentDraft.length === 1 ? "" : "s"}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {renderNotice("createAccount", "mt-4")}

              <button className={theme.buttonPrimary + " mt-4 w-full"} type="submit">
                Create account
              </button>

              <p className="mt-4 text-sm leading-6 text-white/48">
                Managers can receive assignment, password, suspension, deletion, or credit permissions from the selected account panel.
              </p>
            </aside>
          </form>
        </section>
      ) : null}

      {influencerPendingDeletion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
          <div className={cx(theme.cardStrong, "glass-panel w-full max-w-xl p-6 sm:p-7")}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-rose-200/68">Confirm deletion</p>
                <h3 className="font-display mt-2 text-3xl text-white">Delete AI influencer?</h3>
                <p className="mt-3 max-w-lg text-sm leading-7 text-white/58">
                  This will permanently remove <span className="font-semibold text-white">{influencerPendingDeletion.name}</span> from the model library.
                </p>
              </div>
              <button className={theme.buttonSecondary} onClick={() => setInfluencerPendingDeletionId(null)} type="button">
                Cancel
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-5">
                <p className="text-sm font-semibold text-rose-100">This action cannot be undone.</p>
                <p className="mt-2 text-sm leading-7 text-rose-100/76">
                  Assigned access, workspace boards, and generated outputs connected to this influencer will also be removed.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Boards</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{influencerPendingDeletion.boardCount}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Outputs</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{influencerPendingDeletion.outputCount}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Owner</p>
                  <p className="mt-3 truncate text-sm font-semibold text-white">{influencerPendingDeletion.assignedAgencyNames[0] || "Unassigned"}</p>
                </div>
              </div>

              {renderNotice("deleteInfluencer")}

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-5">
                <button className={theme.buttonSecondary} onClick={() => setInfluencerPendingDeletionId(null)} type="button">
                  Cancel
                </button>
                <button className={theme.buttonDanger} onClick={() => void handleDeleteInfluencer()} type="button">
                  Delete influencer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ProfileImageCropModal
        file={pendingAvatarCrop?.file || null}
        onCancel={() => setPendingAvatarCrop(null)}
        onSave={(file) => handleSaveCroppedAvatar(file)}
        title={pendingAvatarCrop?.target === "edit" ? "Replace influencer profile image" : "Create influencer profile image"}
      />

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
