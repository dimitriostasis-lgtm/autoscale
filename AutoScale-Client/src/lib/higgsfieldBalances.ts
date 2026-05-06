import type { HiggsfieldAccountConnection, InfluencerModel } from "../types";

export interface HiggsfieldBalanceSummary {
  creditBalance: number;
  accountCount: number;
  connectedInfluencerCount: number;
  accountEmails: string[];
}

interface UniqueHiggsfieldAccount {
  credits: number;
  email: string;
  influencerCount: number;
  lastCheckedAt: string | null;
}

function isUsableHiggsfieldConnection(connection: HiggsfieldAccountConnection): boolean {
  return Boolean(
    connection.connected &&
      connection.email?.trim() &&
      typeof connection.credits === "number" &&
      Number.isFinite(connection.credits),
  );
}

function getCheckedAtTime(value: string | null): number {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function summarizeHiggsfieldConnections(connections: Iterable<HiggsfieldAccountConnection>): HiggsfieldBalanceSummary {
  const uniqueAccounts = new Map<string, UniqueHiggsfieldAccount>();

  for (const connection of connections) {
    if (!isUsableHiggsfieldConnection(connection)) {
      continue;
    }

    const email = connection.email?.trim() || "";
    const accountKey = email.toLocaleLowerCase();
    const existingAccount = uniqueAccounts.get(accountKey);

    if (!existingAccount) {
      uniqueAccounts.set(accountKey, {
        credits: connection.credits ?? 0,
        email,
        influencerCount: 1,
        lastCheckedAt: connection.lastCheckedAt,
      });
      continue;
    }

    existingAccount.influencerCount += 1;

    if (getCheckedAtTime(connection.lastCheckedAt) > getCheckedAtTime(existingAccount.lastCheckedAt)) {
      existingAccount.credits = connection.credits ?? 0;
      existingAccount.email = email;
      existingAccount.lastCheckedAt = connection.lastCheckedAt;
    }
  }

  const accounts = Array.from(uniqueAccounts.values());

  return {
    accountCount: accounts.length,
    accountEmails: accounts.map((account) => account.email),
    connectedInfluencerCount: accounts.reduce((sum, account) => sum + account.influencerCount, 0),
    creditBalance: accounts.reduce((sum, account) => sum + account.credits, 0),
  };
}

export function buildAgencyHiggsfieldBalance(
  agencyId: string,
  models: InfluencerModel[],
  connectionsByModelId: ReadonlyMap<string, HiggsfieldAccountConnection>,
): HiggsfieldBalanceSummary {
  if (!agencyId) {
    return { accountCount: 0, accountEmails: [], connectedInfluencerCount: 0, creditBalance: 0 };
  }

  const agencyConnections = models
    .filter((model) => model.assignedAgencyIds.includes(agencyId))
    .map((model) => connectionsByModelId.get(model.id))
    .filter((connection): connection is HiggsfieldAccountConnection => Boolean(connection));

  return summarizeHiggsfieldConnections(agencyConnections);
}
