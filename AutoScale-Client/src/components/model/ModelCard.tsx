import { cx } from "../../lib/cx";
import type { InfluencerModel } from "../../types";
import { theme } from "../../styles/theme";
import { InfluencerAvatar } from "./InfluencerAvatar";

interface ModelCardProps {
  model: InfluencerModel;
  onSelect: (model: InfluencerModel) => void;
}

export function ModelCard({ model, onSelect }: ModelCardProps) {
  return (
    <button
      className={cx(theme.card, "group relative flex h-full flex-col justify-between gap-6 overflow-hidden p-6 text-left transition hover:-translate-y-1 hover:border-white/16")}
      onClick={() => onSelect(model)}
      type="button"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in srgb, var(--accent-main) 28%, transparent) 0%, transparent 42%), linear-gradient(180deg, color-mix(in srgb, var(--accent-main) 10%, transparent) 0%, transparent 72%)",
        }}
      />

      <div className="relative z-10 space-y-5">
        <div className="flex justify-end">
          <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
            {model.assignedAgencyNames[0] || "Unassigned"}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <InfluencerAvatar model={model} size="2xl" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-white/42">AI influencer</p>
            <p className="mt-3 font-display text-3xl text-white">{model.name}</p>
            <p className="mt-2 truncate text-sm uppercase tracking-[0.22em] text-white/48">{model.handle}</p>
          </div>
        </div>

        <div>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/56">{model.description}</p>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between rounded-3xl border border-white/8 bg-black/16 px-4 py-3">
        <span className="text-xs uppercase tracking-[0.2em] text-white/44">Open workspace</span>
        <span className="text-sm font-semibold text-lime-300 transition group-hover:translate-x-1">Open</span>
      </div>
    </button>
  );
}
