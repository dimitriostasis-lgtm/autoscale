import { env } from "../config/env.js";
import { HIGGSFIELD_MODEL_COSTS } from "../config/higgsfield.js";
import { readStore } from "../lib/store.js";
import type { AuthUser, InfluencerModel } from "../types/domain.js";

import { canManageAccounts, requireAuthenticatedUser } from "./permissions.service.js";

interface WorkerHiggsfieldAccountPayload {
  account_key: string;
  connected?: boolean;
  status?: string;
  email?: string | null;
  credits?: number | string | null;
  subscription_plan_type?: string | null;
  last_checked_at?: string | null;
  error?: string | null;
}

export interface HiggsfieldAccountConnection {
  influencerModelId: string;
  influencerModelName: string;
  influencerModelHandle: string;
  connected: boolean;
  status: string;
  email: string | null;
  credits: number | null;
  subscriptionPlanType: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  costTable: typeof HIGGSFIELD_MODEL_COSTS;
}

function assertPlatformAdmin(currentUser: AuthUser | null): AuthUser {
  const viewer = requireAuthenticatedUser(currentUser);
  if (!canManageAccounts(viewer)) {
    throw new Error("Platform admin access required");
  }
  return viewer;
}

function workerHeaders(): HeadersInit {
  return {
    "x-api-key": env.workerApiKey,
  };
}

async function fetchWorkerJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.workerUrl}${path}`, {
    ...init,
    headers: {
      ...workerHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Higgsfield worker request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeCredits(value: WorkerHiggsfieldAccountPayload["credits"]): number | null {
  const numericValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? numericValue : null;
}

function presentConnection(model: InfluencerModel, payload?: WorkerHiggsfieldAccountPayload | null): HiggsfieldAccountConnection {
  return {
    influencerModelId: model.id,
    influencerModelName: model.name,
    influencerModelHandle: model.handle,
    connected: Boolean(payload?.connected),
    status: payload?.status || (payload?.connected ? "connected" : "not_connected"),
    email: payload?.email || null,
    credits: normalizeCredits(payload?.credits),
    subscriptionPlanType: payload?.subscription_plan_type || null,
    lastCheckedAt: payload?.last_checked_at || null,
    error: payload?.error || null,
    costTable: HIGGSFIELD_MODEL_COSTS,
  };
}

async function getWorkerConnection(model: InfluencerModel): Promise<HiggsfieldAccountConnection> {
  try {
    const payload = await fetchWorkerJson<WorkerHiggsfieldAccountPayload>(
      `/api/v1/higgsfield/accounts/${encodeURIComponent(model.id)}`,
    );
    return presentConnection(model, payload);
  } catch (error) {
    return presentConnection(model, {
      account_key: model.id,
      connected: false,
      status: "worker_unavailable",
      error: error instanceof Error ? error.message : "Could not reach Higgsfield worker",
    });
  }
}

async function getModelForAdmin(currentUser: AuthUser | null, influencerModelId: string): Promise<InfluencerModel> {
  assertPlatformAdmin(currentUser);
  const store = await readStore();
  const model = store.influencerModels.find((entry) => entry.id === influencerModelId);
  if (!model) {
    throw new Error("Influencer model not found");
  }
  return model;
}

export async function listHiggsfieldAccountConnections(currentUser: AuthUser | null): Promise<HiggsfieldAccountConnection[]> {
  assertPlatformAdmin(currentUser);
  const store = await readStore();
  const models = [...store.influencerModels].sort((left, right) => left.name.localeCompare(right.name));
  return Promise.all(models.map((model) => getWorkerConnection(model)));
}

export async function connectHiggsfieldAccount(currentUser: AuthUser | null, influencerModelId: string): Promise<HiggsfieldAccountConnection> {
  const model = await getModelForAdmin(currentUser, influencerModelId);
  const payload = await fetchWorkerJson<WorkerHiggsfieldAccountPayload>(
    `/api/v1/higgsfield/accounts/${encodeURIComponent(model.id)}/login`,
    { method: "POST" },
  );
  return presentConnection(model, payload);
}
export async function refreshHiggsfieldAccountBalance(currentUser: AuthUser | null, influencerModelId: string): Promise<HiggsfieldAccountConnection> {
  const model = await getModelForAdmin(currentUser, influencerModelId);
  return getWorkerConnection(model);
}

export async function disconnectHiggsfieldAccount(currentUser: AuthUser | null, influencerModelId: string): Promise<HiggsfieldAccountConnection> {
  const model = await getModelForAdmin(currentUser, influencerModelId);
  const payload = await fetchWorkerJson<WorkerHiggsfieldAccountPayload>(
    `/api/v1/higgsfield/accounts/${encodeURIComponent(model.id)}`,
    { method: "DELETE" },
  );
  return presentConnection(model, payload);
}
