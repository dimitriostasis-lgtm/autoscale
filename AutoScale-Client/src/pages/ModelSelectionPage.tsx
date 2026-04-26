import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";

import { ModelCard } from "../components/model/ModelCard";
import { cx } from "../lib/cx";
import { INFLUENCER_MODELS_QUERY } from "../queries/model";
import { AGENCIES_QUERY } from "../queries/user";
import type { AgencyRecord, InfluencerModel, UserRecord } from "../types";
import { theme } from "../styles/theme";

interface ModelSelectionPageProps {
  currentUser: UserRecord;
  onOpenModel: (model: InfluencerModel) => void;
}

interface AgencyModelGroup {
  id: string;
  label: string;
  models: InfluencerModel[];
}

const allAgencyFilterId = "all-agencies";
const unassignedAgencyFilterId = "unassigned-models";

function sortModelsByName(models: InfluencerModel[]): InfluencerModel[] {
  return [...models].sort((first, second) => first.name.localeCompare(second.name));
}

function formatModelCount(count: number, qualifier: "accessible" | "agency"): string {
  return `${count} ${qualifier} model${count === 1 ? "" : "s"}`;
}

function formatPlainModelCount(count: number): string {
  return `${count} model${count === 1 ? "" : "s"}`;
}

function buildAgencyModelGroups(agencies: AgencyRecord[], models: InfluencerModel[]): AgencyModelGroup[] {
  const groups = agencies
    .map((agency) => ({
      id: agency.id,
      label: agency.name,
      models: sortModelsByName(models.filter((model) => model.assignedAgencyIds.includes(agency.id))),
    }))
    .sort((first, second) => first.label.localeCompare(second.label));

  const unassignedModels = sortModelsByName(models.filter((model) => model.assignedAgencyIds.length === 0));

  return unassignedModels.length > 0
    ? [...groups, { id: unassignedAgencyFilterId, label: "Unassigned", models: unassignedModels }]
    : groups;
}

export function ModelSelectionPage({ currentUser, onOpenModel }: ModelSelectionPageProps) {
  const isPlatformAdmin = currentUser.role === "PLATFORM_ADMIN";
  const [selectedAgencyId, setSelectedAgencyId] = useState(allAgencyFilterId);
  const [agencySearchQuery, setAgencySearchQuery] = useState("");
  const { data, loading } = useQuery<{ influencerModels: InfluencerModel[] }>(INFLUENCER_MODELS_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { includeInactive: isPlatformAdmin },
  });
  const { data: agenciesData } = useQuery<{ agencies: AgencyRecord[] }>(AGENCIES_QUERY, {
    fetchPolicy: "cache-and-network",
    skip: !isPlatformAdmin,
  });

  const models = data?.influencerModels || [];
  const agencies = agenciesData?.agencies || [];
  const agencyGroups = useMemo(() => buildAgencyModelGroups(agencies, models), [agencies, models]);
  const filteredAgencyGroups = useMemo(() => {
    const normalizedQuery = agencySearchQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return agencyGroups;
    }

    return agencyGroups.filter((group) => group.label.toLocaleLowerCase().includes(normalizedQuery));
  }, [agencyGroups, agencySearchQuery]);
  const selectedAgencyGroup = agencyGroups.find((group) => group.id === selectedAgencyId);
  const selectedDirectoryLabel = selectedAgencyId === allAgencyFilterId ? "All agencies" : selectedAgencyGroup?.label || "Agency";
  const visibleGroups = isPlatformAdmin
    ? selectedAgencyId === allAgencyFilterId
      ? agencyGroups.filter((group) => group.models.length > 0)
      : selectedAgencyGroup
        ? [selectedAgencyGroup]
        : []
    : [{ id: "accessible-models", label: "Accessible models", models: sortModelsByName(models) }];
  const visibleModelCount = selectedAgencyId === allAgencyFilterId ? models.length : selectedAgencyGroup?.models.length ?? 0;

  return (
    <div className="space-y-6">
      <section className={theme.cardStrong + " glass-panel p-6 sm:p-8"}>
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">Influencer model index</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-white">Select an AI influencer workspace</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
              Each influencer model keeps its own defaults, role-controlled access, isolated Airtable-style boards, and its own generated gallery. Choose the persona first, then operate inside that dedicated space.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/70">
            {formatModelCount(visibleModelCount, isPlatformAdmin && selectedAgencyId !== allAgencyFilterId ? "agency" : "accessible")}
          </div>
        </div>
      </section>

      {isPlatformAdmin ? (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={cx(theme.cardStrong, "glass-panel overflow-hidden xl:sticky xl:top-28 xl:self-start")}>
            <div className="border-b border-white/8 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/38">Platform admin</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-white">Agency directory</h2>
                  <p className="mt-1 text-sm text-white/50">
                    {agencies.length} agencies · {models.length} models
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <input
                className={theme.input}
                onChange={(event) => setAgencySearchQuery(event.target.value)}
                placeholder="Search agencies"
                type="search"
                value={agencySearchQuery}
              />

              <button
                className={cx(
                  "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition",
                  selectedAgencyId === allAgencyFilterId
                    ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                    : "border border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.07]",
                )}
                onClick={() => setSelectedAgencyId(allAgencyFilterId)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">All agencies</span>
                  <span className="mt-0.5 block text-xs opacity-70">Grouped model directory</span>
                </span>
                <span className="ml-3 rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold">{models.length}</span>
              </button>

              <div className="max-h-[min(62vh,720px)] space-y-2 overflow-y-auto pr-1">
                {filteredAgencyGroups.map((group) => {
                  const selected = selectedAgencyId === group.id;

                  return (
                    <button
                      className={cx(
                        "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition",
                        selected
                          ? "bg-[color:var(--accent-main)] text-[color:var(--accent-foreground)]"
                          : "border border-white/10 bg-white/[0.025] text-white/70 hover:bg-white/[0.07]",
                      )}
                      key={group.id}
                      onClick={() => setSelectedAgencyId(group.id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{group.label}</span>
                        <span className="mt-0.5 block text-xs opacity-65">{formatPlainModelCount(group.models.length)}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold">{group.models.length}</span>
                    </button>
                  );
                })}

                {filteredAgencyGroups.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/52">
                    No agencies match that search.
                  </div>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <section className={cx(theme.card, "p-5")}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/38">Model access view</p>
                  <h2 className="font-display mt-1 text-2xl text-white">{selectedDirectoryLabel}</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/52">
                  {formatPlainModelCount(visibleModelCount)}
                </span>
              </div>
            </section>

            {loading && !models.length ? (
              <div className="grid gap-5 2xl:grid-cols-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-[320px] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {visibleGroups.map((group) => (
                  <section className="space-y-4" key={group.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-white/38">Agency model access</p>
                        <h3 className="font-display mt-1 text-2xl text-white">{group.label}</h3>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/52">
                        {formatPlainModelCount(group.models.length)}
                      </span>
                    </div>

                    {group.models.length > 0 ? (
                      <div className="grid gap-5 2xl:grid-cols-2">
                        {group.models.map((model) => (
                          <ModelCard key={model.id} model={model} onSelect={onOpenModel} />
                        ))}
                      </div>
                    ) : (
                      <div className={theme.card + " p-8 text-sm text-white/56"}>No models are assigned to this agency yet.</div>
                    )}
                  </section>
                ))}

                {visibleGroups.length === 0 ? (
                  <div className={theme.card + " p-8 text-sm text-white/56"}>No model groups are available for this view.</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : loading && !models.length ? (
        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-[320px] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map((group) => (
            <section className="space-y-4" key={group.id}>
              {group.models.length > 0 ? (
                <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
                  {group.models.map((model) => (
                    <ModelCard key={model.id} model={model} onSelect={onOpenModel} />
                  ))}
                </div>
              ) : (
                <div className={theme.card + " p-8 text-sm text-white/56"}>No models are assigned to this agency yet.</div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}