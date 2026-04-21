import { useQuery } from "@apollo/client/react";

import { ModelCard } from "../components/model/ModelCard";
import { INFLUENCER_MODELS_QUERY } from "../queries/model";
import type { InfluencerModel } from "../types";
import { theme } from "../styles/theme";

interface ModelSelectionPageProps {
  onOpenModel: (model: InfluencerModel) => void;
}

export function ModelSelectionPage({ onOpenModel }: ModelSelectionPageProps) {
  const { data, loading } = useQuery<{ influencerModels: InfluencerModel[] }>(INFLUENCER_MODELS_QUERY, {
    fetchPolicy: "cache-and-network",
  });

  const models = data?.influencerModels || [];

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
            {models.length} accessible models
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {loading && !models.length
          ? Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-[320px] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />
            ))
          : models.map((model) => <ModelCard key={model.id} model={model} onSelect={onOpenModel} />)}
      </div>
    </div>
  );
}