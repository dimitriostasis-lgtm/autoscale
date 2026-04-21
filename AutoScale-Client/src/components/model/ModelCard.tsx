import { cx } from "../../lib/cx";
import type { InfluencerModel } from "../../types";
import { theme } from "../../styles/theme";

interface ModelCardProps {
  model: InfluencerModel;
  onSelect: (model: InfluencerModel) => void;
}

export function ModelCard({ model, onSelect }: ModelCardProps) {
  return (
    <button
      className={cx(theme.card, "group flex h-full flex-col justify-between gap-6 overflow-hidden p-6 text-left transition hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.04]")}
      onClick={() => onSelect(model)}
      type="button"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/42">AI influencer</p>
          <div className="mt-3">
            <p className="font-display text-3xl text-white">{model.name}</p>
            <p className="mt-2 text-sm uppercase tracking-[0.22em] text-white/48">{model.handle}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-white/8 bg-black/16 px-4 py-3">
        <span className="text-xs uppercase tracking-[0.2em] text-white/44">Open workspace</span>
        <span className="text-sm font-semibold text-lime-300 transition group-hover:translate-x-1">Open</span>
      </div>
    </button>
  );
}