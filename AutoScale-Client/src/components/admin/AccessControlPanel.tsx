import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AgencyDeleteModal } from "./AgencyDeleteModal";
import { ProfileImageCropModal } from "./ProfileImageCropModal";
import { agencyBillingPlan } from "../../lib/billing";
import { cx } from "../../lib/cx";
import { uploadReferenceFile } from "../../lib/uploads";
import { InfluencerAvatar } from "../model/InfluencerAvatar";
import {
  aspectRatioOptions,
  generationModelOptions,
  resolutionOptions,
  theme,
} from "../../styles/theme";
import type { AgencyRecord, GeneratedAsset, InfluencerModel, ManagerPermissions, Role, UserAccessScope, UserRecord } from "../../types";

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
  onUpdateRole: (userId: string, role: Role) => Promise<void>;
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
  onUpdateInfluencerModelProfile: (influencerModelId: string, input: {
    name: string;
    handle: string;
    description: string;
    avatarImageUrl?: string | null;
  }) => Promise<void>;
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
  | "createAccount"
  | "accountSettings"
  | "managerPermissions"
  | "influencerAccess"
  | "deleteAccount"
  | "createInfluencer"
  | "influencerProfile"
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

type ModelProfileDraft = Pick<ModelFormState, "avatarImageUrl" | "description" | "handle" | "name">;

type AvatarCropTarget = "create" | "edit";

type CreditAccessMode = "AGENCY_POOL" | "USER_ALLOCATION";

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

function parseInfluencerCapacity(value: string): number {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
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
  users,
  models,
  onCreateAgency,
  onRenameAgency,
  onDeleteAgency,
  onCreateUser,
  onRenameUser,
  onCreateInfluencerModel,
  onUpdateInfluencerModelProfile,
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
  const [modelProfileDraft, setModelProfileDraft] = useState<ModelProfileDraft>({
    name: "",
    handle: "",
    description: "",
    avatarImageUrl: "",
  });
  const [pendingAvatarCrop, setPendingAvatarCrop] = useState<{ file: File; target: AvatarCropTarget } | null>(null);
  const [accountDraft, setAccountDraft] = useState<AccountDraft | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<string[]>([]);
  const [managerPermissionDraft, setManagerPermissionDraft] = useState<ManagerPermissions>(defaultManagerPermissions);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string | null>(models[0]?.id || null);
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

  useEffect(() => {
    if (!selectedInfluencer) {
      setInfluencerAgencyDraft([]);
      setModelProfileDraft({ name: "", handle: "", description: "", avatarImageUrl: "" });
      return;
    }

    setInfluencerAgencyDraft(selectedInfluencer.assignedAgencyIds);
    setModelProfileDraft({
      name: selectedInfluencer.name,
      handle: selectedInfluencer.handle,
      description: selectedInfluencer.description,
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
    const influencerCapacity = parseInfluencerCapacity(agencyBillingPlan.currentPlan);

    return agencies.map((agency) => {
      const assignedModels = models.filter((model) => model.isActive && model.assignedAgencyIds.includes(agency.id));
      const agencyDirectUsers = users.filter((user) => user.agencyId === agency.id && (user.role === "USER" || user.role === "AGENCY_MANAGER"));
      const directAssignmentCount = agencyDirectUsers.reduce((sum, user) => sum + user.assignedModelIds.length, 0);
      const directAssigneeCount = agencyDirectUsers.filter((user) => user.assignedModelIds.length > 0).length;

      return {
        agency,
        assignedInfluencers: assignedModels.length,
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
      modelProfileDraft.description.trim() !== selectedInfluencer.description ||
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
          description: modelForm.description.trim(),
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
        description: "",
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
          description: modelProfileDraft.description.trim(),
          avatarImageUrl: modelProfileDraft.avatarImageUrl || null,
        }),
      `Updated ${normalizeText(modelProfileDraft.name)}.`,
      "influencerProfile",
    );
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

  return (
    <div className="space-y-6">
      {renderNotice("global")}

      {isPlatformAdmin ? (
        <section id="access-platform-sales" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7">
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
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7">
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
          <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7">
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

          <div className="border-t border-white/8 bg-black/12 px-6 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-white/42">Credit Controls</p>
                <h3 className="font-display mt-2 text-2xl text-white">User spend and allocation</h3>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">
                  Estimated spend is based on generated outputs in this agency. Agency admins can keep one shared credit pool or allocate caps to users and managers.
                </p>
              </div>
              <div className="grid gap-3 text-right sm:grid-cols-3">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Agency pool</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatCreditCount(agencyBillingPlan.creditBalance)}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Spent estimate</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatCreditCount(agencyEstimatedCreditsSpent)}</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/42">Unallocated</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatCreditCount(agencyCreditUnallocatedBalance)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {[
                ["AGENCY_POOL", "Use shared agency credits", "Users draw from the agency balance without individual caps."],
                ["USER_ALLOCATION", "Allocate credits by user", "Set user and manager credit caps from the agency balance."],
              ].map(([mode, label, description]) => {
                const selected = agencyCreditAccessMode === mode;
                return (
                  <button
                    key={mode}
                    className={cx(
                      "rounded-3xl border px-4 py-4 text-left transition",
                      selected ? "border-lime-300/35 bg-lime-300/12" : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                    )}
                    onClick={() => handleCreditAccessModeChange(mode as CreditAccessMode)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold text-white">{label}</span>
                    <span className="mt-2 block text-sm leading-6 text-white/56">{description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03]">
              <div className="grid gap-px bg-white/8 lg:grid-cols-[minmax(0,1.25fr)_0.8fr_0.75fr_0.8fr_0.8fr_0.95fr]">
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Account</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Available balance</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Spent</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Outputs</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Last use</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">Credit access</div>
              </div>

              <div className="max-h-[420px] divide-y divide-white/8 overflow-y-auto">
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
                    <div key={row.user.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.25fr)_0.8fr_0.75fr_0.8fr_0.8fr_0.95fr] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{row.user.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">{roleLabel(row.user.role)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{hasAgencyPoolAccess ? "Agency balance" : formatCreditCount(availableCredits)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">
                          {hasAgencyPoolAccess ? "Shared pool" : canReceiveAllocation ? "Allocated balance" : "Admin reserve"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white">{formatCreditCount(row.estimatedCredits)}</p>
                      <p className="text-sm text-white/62">
                        {row.outputCount.toLocaleString()} output{row.outputCount === 1 ? "" : "s"} / {row.modelCount.toLocaleString()} model{row.modelCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-sm text-white/62">{formatTimestamp(row.lastGeneratedAt)}</p>
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
                        <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
                          {agencyCreditAccessMode === "AGENCY_POOL" ? "Agency pool" : "Admin pool"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {renderNotice("agencyCreditPolicy", "mt-5")}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button className={theme.buttonPrimary} onClick={handleApplyCreditPolicy} type="button">
                Apply credit policy
              </button>
              <p className="text-sm text-white/48">
                Managers only see and manage this section when an agency admin grants the credit-management permission.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section id="access-directory" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
        <div className="border-b border-white/8 px-6 py-6 sm:px-7 sm:py-7">
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
              <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-white/44">Visible accounts</p>
                <p className="mt-2 text-3xl font-semibold text-white">{filteredUsers.length}</p>
              </div>
              <div className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-white/44">Selected scope</p>
                <p className="mt-2 text-sm font-semibold text-white">{accessScopeLabel(selectedUser.accessScope)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-white/8 xl:grid-cols-[1.02fr_1.08fr]">
          <div className="max-h-[920px] overflow-y-auto bg-[color:var(--surface-card-strong)] p-5 sm:p-6">
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

          <div className="max-h-[920px] overflow-y-auto bg-[color:var(--surface-card)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">Account</p>
              <h3 className="font-display mt-2 text-2xl text-white">{selectedUser.name}</h3>
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

            {renderNotice("accountSettings", "mt-5")}

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
                    These toggles control whether a manager can suspend users, delete users, reset passwords, manage influencer assignments, or manage agency credit controls for users inside their agency.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["canSuspendUsers", "Can suspend users"],
                  ["canDeleteUsers", "Can delete users"],
                  ["canResetPasswords", "Can reset passwords"],
                  ["canManageAssignments", "Can manage influencer assignments"],
                  ["canManageCredits", "Can manage agency credits"],
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
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section id="access-agency-settings" className={theme.cardStrong + " glass-panel scroll-mt-32 overflow-hidden p-0"}>
            <div className="border-b border-white/8 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Agencies</p>
                  <h3 className="font-display mt-2 text-2xl text-white">Agency settings</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
                    Create, rename, search, and remove agencies from one dense operations view.
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

            <div className="max-h-[620px] overflow-y-auto">
              <div className="sticky top-0 z-10 hidden grid-cols-[minmax(180px,1fr)_190px_170px_minmax(190px,0.9fr)_150px] gap-px bg-white/8 text-xs font-semibold uppercase tracking-[0.16em] text-white/42 lg:grid">
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Agency</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Roster</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Influencers</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3">Rename</div>
                <div className="bg-[color:var(--surface-card)] px-4 py-3 text-right">Actions</div>
              </div>

              <div className="divide-y divide-white/8">
                {agencySettingsRows.map((row) => {
                  const agency = row.agency;
                  const agencyScopedMembers = users.filter((user) => user.agencyId === agency.id && user.role !== "PLATFORM_ADMIN");
                  const retainedAdmins = users.filter((user) => user.agencyId === agency.id && user.role === "PLATFORM_ADMIN");
                  const deleteSummary = `${agencyScopedMembers.length} scoped account${agencyScopedMembers.length === 1 ? "" : "s"} affected${
                    retainedAdmins.length ? `, ${retainedAdmins.length} platform admin${retainedAdmins.length === 1 ? "" : "s"} detached` : ""
                  }`;

                  return (
                    <div key={agency.id} className="grid gap-4 bg-[color:var(--surface-card)] px-4 py-4 text-sm transition hover:bg-[color:var(--surface-soft-hover)] lg:grid-cols-[minmax(180px,1fr)_190px_170px_minmax(190px,0.9fr)_150px] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{agency.name}</p>
                        <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-white/42">{agency.slug}</p>
                        <p className="mt-1 text-xs text-white/42">Created {new Date(agency.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42 lg:hidden">Roster</p>
                        <p className="font-semibold text-white">{row.memberCount} total / {row.activeAccounts} active</p>
                        <p className="mt-1 text-xs text-white/48">
                          {agency.adminCount} admins / {agency.managerCount} managers / {agency.userCount} users
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42 lg:hidden">Influencers</p>
                        <p className="font-semibold text-white">{row.assignedInfluencers} / {row.influencerCapacity} owned</p>
                        <p className={cx("mt-1 text-xs", row.overCapacityCount > 0 ? "text-red-100/72" : "text-white/48")}>
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
                        <button className={theme.buttonSecondary} onClick={() => void handleRenameAgency(agency)} type="button">
                          Rename
                        </button>
                        <button className={theme.buttonDanger} onClick={() => void handleDeleteAgency(agency)} title={deleteSummary} type="button">
                          Delete
                        </button>
                      </div>
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
              <div className="border-b border-white/8 px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/42">Provisioning</p>
                    <h3 className="font-display mt-2 text-2xl text-white">Create platform accounts</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
                      Create the account, choose its role boundary, and place agency-scoped users in the correct agency before sending credentials.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/62">
                    {users.length} existing accounts
                  </span>
                </div>
              </div>

              <form className="grid gap-px bg-white/8 lg:grid-cols-[minmax(0,1fr)_330px]" onSubmit={handleCreateUser}>
                <div className="bg-[color:var(--surface-card)] p-5 sm:p-6">
                  <p className="text-sm font-semibold text-white">Account identity</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <input className={theme.input} placeholder="Full name" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} />
                    <input className={theme.input} placeholder="Email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
                    <input className={theme.input + " sm:col-span-2"} placeholder="Temporary password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} />
                  </div>

                  <div className="mt-5 rounded-3xl border border-white/8 bg-black/14 p-4">
                    <p className="text-sm font-semibold text-white">Access scope</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-white/72">Role</span>
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
                        <span className="text-sm font-semibold text-white/72">Agency</span>
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
                    </div>

                    {isAgencyAdmin ? (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/62">
                        New accounts will be created inside {currentUser.agencyName || "your agency"}.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="bg-[color:var(--surface-card-strong)] p-5 sm:p-6">
                  <p className="text-sm font-semibold text-white">Provisioning preview</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">Account</p>
                      <p className="mt-2 truncate text-sm font-semibold text-white">{createForm.name || "Unnamed account"}</p>
                      <p className="mt-1 truncate text-sm text-white/54">{createForm.email || "email@company.com"}</p>
                    </div>
                    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">Role boundary</p>
                      <p className="mt-2 text-sm font-semibold text-white">{roleLabel(createForm.role)}</p>
                      <p className="mt-1 text-sm text-white/54">
                        {createForm.role === "PLATFORM_ADMIN"
                          ? "Global platform access"
                          : agencies.find((agency) => agency.id === createForm.agencyId)?.name || currentUser.agencyName || "No agency selected"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/8 bg-black/14 p-4 text-sm leading-6 text-white/54">
                      Temporary credentials can be reset later from the selected account panel.
                    </div>
                  </div>

                  {renderNotice("createAccount", "mt-5")}

                  <button className={theme.buttonPrimary + " mt-5 w-full"} type="submit">
                    Create account
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          </div>

          <section id="access-influencer-profiles" className={theme.cardStrong + " glass-panel max-h-[980px] scroll-mt-32 overflow-y-auto p-6 sm:p-7"}>
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">Influencers</p>
            <h3 className="font-display mt-2 text-2xl text-white">Influencer profile setup</h3>
            <p className="mt-3 text-sm leading-7 text-white/56">
              Only the platform administrator can create and manage AI influencer models. Every new profile ships with the full generation toolset by default, while agency ownership is controlled here and updates access immediately for agency admins.
            </p>

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
                    <textarea
                      className={theme.input + " min-h-32 resize-y sm:col-span-2"}
                      placeholder="Short profile description"
                      value={modelForm.description}
                      onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))}
                    />
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
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/54">{modelForm.description || "Profile preview updates as you type."}</p>
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
                    <div className="overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03]">
                      <div className="border-b border-white/8 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-white/44">Influencer library</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {filteredInfluencerModels.length} of {models.length} visible
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs font-semibold text-white/62">
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

                      <div className="max-h-[620px] divide-y divide-white/8 overflow-y-auto">
                        {filteredInfluencerModels.map((model) => {
                          const active = model.id === selectedInfluencer?.id;
                          return (
                            <button
                              key={model.id}
                              className={cx(
                                "grid w-full gap-3 px-4 py-4 text-left transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                                active
                                  ? "bg-lime-300/12"
                                  : "bg-[color:var(--surface-card)] hover:bg-[color:var(--surface-soft-hover)]",
                              )}
                              onClick={() => setSelectedInfluencerId(model.id)}
                              type="button"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <InfluencerAvatar model={model} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-white">{model.name}</p>
                                    {active ? (
                                      <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-black">Selected</span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-white/46">{model.handle}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="rounded-full border border-white/8 bg-black/16 px-2 py-1 text-[11px] font-semibold text-white/50">
                                      {model.outputCount} outputs
                                    </span>
                                    <span className="rounded-full border border-white/8 bg-black/16 px-2 py-1 text-[11px] font-semibold text-white/50">
                                      {model.platformWorkflowCount + model.customWorkflowCount} workflows
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 sm:justify-end">
                                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
                                  {model.assignedAgencyNames[0] || "Unassigned"}
                                </span>
                                <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", active ? "bg-lime-300" : "bg-white/18")} />
                              </div>
                            </button>
                          );
                        })}

                        {!filteredInfluencerModels.length ? (
                          <div className="m-4 rounded-2xl border border-dashed border-white/10 bg-black/14 p-4 text-sm text-white/50">
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
                              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/56">
                                {modelProfileDraft.description || "No description provided yet."}
                              </p>
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
                            <textarea
                              className={theme.input + " min-h-28 resize-y sm:col-span-2"}
                              placeholder="Profile description"
                              value={modelProfileDraft.description}
                              onChange={(event) => setModelProfileDraft((current) => ({ ...current, description: event.target.value }))}
                            />
                          </div>

                          {renderNotice("influencerProfile", "mt-4")}

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
                                  description: selectedInfluencer.description,
                                  avatarImageUrl: selectedInfluencer.avatarImageUrl || "",
                                })
                              }
                              type="button"
                            >
                              Reset
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
          </section>
        </div>
      ) : null}

      {isAgencyAdmin ? (
        <section id="access-create-accounts" className={theme.cardStrong + " glass-panel scroll-mt-32 p-6"}>
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
              {renderNotice("createAccount")}
              <button className={theme.buttonPrimary + " w-full"} type="submit">
                Create account
              </button>
            </div>
          </form>
        </section>
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
