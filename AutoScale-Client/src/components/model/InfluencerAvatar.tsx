import { cx } from "../../lib/cx";
import type { InfluencerModel } from "../../types";

interface InfluencerAvatarProps {
  model: Pick<InfluencerModel, "accentFrom" | "accentTo" | "avatarImageUrl" | "avatarLabel" | "name">;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-11 w-11 text-sm",
  md: "h-14 w-14 text-base",
  lg: "h-20 w-20 text-2xl",
  xl: "h-32 w-32 text-4xl",
  "2xl": "h-40 w-40 text-5xl",
  "3xl": "h-44 w-44 text-6xl",
};

export function InfluencerAvatar({ model, size = "md", className }: InfluencerAvatarProps) {
  return (
    <div
      className={cx(
        "relative shrink-0 overflow-hidden rounded-full border border-white/12 bg-white/[0.04] shadow-[0_16px_40px_rgba(0,0,0,0.18)]",
        sizeClasses[size],
        className,
      )}
    >
      {model.avatarImageUrl ? (
        <img alt={`${model.name} profile`} className="h-full w-full object-cover" src={model.avatarImageUrl} />
      ) : (
        <div className={cx("flex h-full w-full items-center justify-center bg-gradient-to-br font-display font-semibold text-black", model.accentFrom, model.accentTo)}>
          {model.avatarLabel}
        </div>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
    </div>
  );
}
