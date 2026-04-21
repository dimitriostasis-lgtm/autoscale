import { useDeferredValue, useState } from "react";

import { cx } from "../../lib/cx";
import type { GeneratedAsset } from "../../types";
import { theme } from "../../styles/theme";

interface ImagePickerModalProps {
  open: boolean;
  assets: GeneratedAsset[];
  onClose: () => void;
  onSelect: (asset: GeneratedAsset) => void;
}

export function ImagePickerModal({ open, assets, onClose, onSelect }: ImagePickerModalProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  if (!open) {
    return null;
  }

  const search = deferredQuery.trim().toLowerCase();
  const filteredAssets = assets.filter((asset) => {
    if (!search) {
      return true;
    }
    return `${asset.fileName} ${asset.promptSnapshot}`.toLowerCase().includes(search);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md">
      <div className={cx(theme.cardStrong, "flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden p-5") + " glass-panel"}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/42">Reference Gallery</p>
            <h3 className="font-display mt-2 text-2xl text-white">Select an existing generated image</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              className={theme.input + " min-w-[260px]"}
              placeholder="Search prompts or filenames"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className={theme.buttonSecondary} onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="mt-5 grid flex-1 gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">
          {filteredAssets.map((asset) => (
            <button
              key={asset.id}
              className="group flex flex-col overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] text-left transition hover:border-lime-300/25 hover:bg-white/[0.05]"
              onClick={() => onSelect(asset)}
              type="button"
            >
              <div className="aspect-[3/4] overflow-hidden bg-black/30">
                <img alt={asset.fileName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={asset.url} />
              </div>
              <div className="space-y-2 p-4">
                <p className="line-clamp-2 text-sm font-semibold text-white">{asset.fileName}</p>
                <p className="line-clamp-3 text-xs leading-6 text-white/58">{asset.promptSnapshot}</p>
              </div>
            </button>
          ))}
          {!filteredAssets.length ? (
            <div className="col-span-full flex items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/48">
              No generated images match this search yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}