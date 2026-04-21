import { cx } from "../../lib/cx";
import type { BoardSettings } from "../../types";
import { aspectRatioOptions, generationModelOptions, resolutionLabels, resolutionOptions, theme, workerModelLabels } from "../../styles/theme";

interface SettingsPanelProps {
  open: boolean;
  settings: BoardSettings;
  allowedGenerationModels: string[];
  promptPrefix: string;
  onToggle: () => void;
  onSettingsChange: (nextSettings: BoardSettings) => void;
  onUploadReference: (slotIndex: number, file: File) => Promise<void> | void;
  onPickReference: (slotIndex: number) => void;
}

export function SettingsPanel({
  open,
  settings,
  allowedGenerationModels,
  promptPrefix,
  onToggle,
  onSettingsChange,
  onUploadReference,
  onPickReference,
}: SettingsPanelProps) {
  return (
    <section className={cx(theme.cardStrong, "overflow-hidden") + " glass-panel"}>
      <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={onToggle} type="button">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">Generation Settings</p>
          <h3 className="font-display mt-2 text-2xl text-white">Shared workflow controls</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/64">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>

      {open ? (
        <div className="grid gap-6 border-t border-white/8 px-5 py-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/82">Worker model</span>
              <select
                className={theme.input}
                value={settings.generationModel}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    generationModel: event.target.value,
                  })
                }
              >
                {generationModelOptions
                  .filter((option) => allowedGenerationModels.includes(option))
                  .map((option) => (
                    <option key={option} value={option}>
                      {workerModelLabels[option]}
                    </option>
                  ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/82">Resolution</span>
              <select
                className={theme.input}
                value={settings.resolution}
                onChange={(event) => onSettingsChange({ ...settings, resolution: event.target.value })}
              >
                {resolutionOptions.map((option) => (
                  <option key={option} value={option}>
                    {resolutionLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/82">Aspect ratio</span>
              <select
                className={theme.input}
                value={settings.aspectRatio}
                onChange={(event) => onSettingsChange({ ...settings, aspectRatio: event.target.value })}
              >
                {aspectRatioOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/82">Quantity</span>
              <select
                className={theme.input}
                value={settings.quantity}
                onChange={(event) => onSettingsChange({ ...settings, quantity: Number(event.target.value) })}
              >
                {[1, 2, 3, 4].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 md:col-span-2 xl:col-span-4">
              <p className="text-sm font-semibold text-white">Influencer prompt defaults</p>
              <p className="mt-3 text-sm leading-7 text-white/58">{promptPrefix}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-white">Global reference images</p>
              <p className="mt-2 text-sm leading-6 text-white/54">
                These match the shared workflow inputs that should not be repeated row by row. Each slot can pull from uploads or the model gallery.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {settings.globalReferences.map((selection) => {
                const previewSrc = selection.asset?.url || selection.assetUrl || selection.uploadUrl || null;
                return (
                  <div key={selection.id} className="rounded-[24px] border border-white/8 bg-black/16 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Slot {selection.slotIndex + 1}</p>
                      <span className="text-xs uppercase tracking-[0.18em] text-white/40">Global</span>
                    </div>
                    <div className="mb-3 aspect-[4/3] overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                      {previewSrc ? (
                        <img alt={selection.label} className="h-full w-full object-cover" src={previewSrc} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.24em] text-white/28">Empty</div>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <label className={theme.buttonSecondary + " cursor-pointer text-center"}>
                        Upload
                        <input
                          className="hidden"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void onUploadReference(selection.slotIndex, file);
                            }
                          }}
                          type="file"
                        />
                      </label>
                      <button className={theme.buttonSecondary} onClick={() => onPickReference(selection.slotIndex)} type="button">
                        Use gallery image
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}