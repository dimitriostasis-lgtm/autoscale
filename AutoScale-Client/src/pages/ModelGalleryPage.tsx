import { useState } from "react";
import { useQuery } from "@apollo/client/react";

import { GalleryMasonry } from "../components/gallery/GalleryMasonry";
import { INFLUENCER_MODEL_QUERY, MODEL_ASSETS_QUERY } from "../queries/model";
import { theme } from "../styles/theme";
import type { GeneratedAsset, InfluencerModel } from "../types";

interface ModelGalleryPageProps {
  slug: string;
}

export function ModelGalleryPage({ slug }: ModelGalleryPageProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: modelData, loading: modelLoading } = useQuery<{ influencerModel: InfluencerModel | null }>(INFLUENCER_MODEL_QUERY, {
    variables: { slug },
    fetchPolicy: "cache-and-network",
  });

  const model = modelData?.influencerModel ?? null;

  const { data: assetsData } = useQuery<{ modelAssets: GeneratedAsset[] }>(MODEL_ASSETS_QUERY, {
    skip: !model?.id,
    variables: { influencerModelId: model?.id || "", limit: 180 },
    fetchPolicy: "cache-and-network",
  });

  const assets = assetsData?.modelAssets || [];

  if (modelLoading && !model) {
    return <div className="h-[60vh] animate-pulse rounded-[32px] border border-white/8 bg-white/[0.03]" />;
  }

  if (!model) {
    return <div className={theme.cardStrong + " glass-panel p-10 text-white/58"}>This gallery is not available.</div>;
  }

  return (
    <div className="space-y-5">
      <section className={theme.cardStrong + " glass-panel p-6 sm:p-7"}>
        <p className="text-xs uppercase tracking-[0.24em] text-white/42">Higgsfield-style gallery</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-white">{model.name} gallery</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58">
              This visual surface is intentionally built to expand into masking, inpainting, multi-select workflows, and bulk actions later. The current implementation keeps selection state and tile-level metadata without blocking those future features.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/68">
            {assets.length} generated images
          </div>
        </div>
      </section>

      <GalleryMasonry
        assets={assets}
        onToggle={(assetId) =>
          setSelectedIds((current) => (current.includes(assetId) ? current.filter((entry) => entry !== assetId) : [...current, assetId]))
        }
        selectedIds={selectedIds}
      />
    </div>
  );
}