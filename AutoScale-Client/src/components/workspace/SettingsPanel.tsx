import type { BoardSettings } from "../../types";
import {
  aspectRatioOptions,
  generationModelOptions,
  getMaxQuantityForGenerationModel,
  getQualityOptionsForGenerationModel,
  getResolutionOptionsForGenerationModel,
  normalizeQualityForGenerationModel,
  normalizeResolutionForGenerationModel,
  qualityLabels,
  resolutionLabels,
  theme,
  workerModelLabels,
} from "../../styles/theme";

interface SettingsPanelProps {
  settings: BoardSettings;
  allowedGenerationModels: string[];
  promptPrefix: string;
  onSettingsChange: (nextSettings: BoardSettings) => void;
  onUploadReference: (slotIndex: number, file: File) => Promise<void> | void;
  onPickReference: (slotIndex: number) => void;
}

export function SettingsPanel({
  settings,
  allowedGenerationModels,
  promptPrefix,
  onSettingsChange,
  onUploadReference,
  onPickReference,
}: SettingsPanelProps) {
  const posePromptTemplates = Array.from({ length: 4 }, (_, index) => settings.posePromptTemplates[index] ?? settings.posePromptTemplate);
  const visiblePosePromptCount = Math.max(1, Math.min(4, settings.poseMultiplier));
  const poseMultiplierAllowed = settings.quantity === 1;
  const poseMultiplierEnabled = poseMultiplierAllowed && settings.poseMultiplierEnabled;
  const maxQuantity = getMaxQuantityForGenerationModel(settings.generationModel);
  const allowedResolutionOptions = getResolutionOptionsForGenerationModel(settings.generationModel);
  const allowedQualityOptions = getQualityOptionsForGenerationModel(settings.generationModel);
  const quantityOptions = Array.from({ length: maxQuantity }, (_, index) => index + 1);

  return (
    <section className="h-full bg-[#202020] text-white">
      <div className="border-b border-white/8 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Workspace rail</p>
          <h3 className="font-display mt-2 text-xl text-white">Shared controls</h3>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Worker model</span>
              <select
                className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                value={settings.generationModel}
                onChange={(event) => {
                  const nextGenerationModel = event.target.value;
                  const nextQuantity = Math.min(settings.quantity, getMaxQuantityForGenerationModel(nextGenerationModel));
                  const nextResolution = normalizeResolutionForGenerationModel(nextGenerationModel, settings.resolution);
                  const nextQuality = normalizeQualityForGenerationModel(nextGenerationModel, settings.quality);
                  onSettingsChange({
                    ...settings,
                    generationModel: nextGenerationModel,
                    resolution: nextResolution,
                    quality: nextQuality,
                    quantity: nextQuantity,
                    poseMultiplierEnabled: nextQuantity === 1 ? settings.poseMultiplierEnabled : false,
                  });
                }}
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
              <span className="text-sm font-semibold text-white/76">Resolution</span>
              <select
                className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                value={settings.resolution}
                onChange={(event) => onSettingsChange({ ...settings, resolution: event.target.value })}
              >
                {allowedResolutionOptions.map((option) => (
                  <option key={option} value={option}>
                    {resolutionLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            {settings.generationModel === "gpt_2" ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Quality</span>
                <select
                  className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                  value={settings.quality}
                  onChange={(event) => onSettingsChange({ ...settings, quality: event.target.value })}
                >
                  {allowedQualityOptions.map((option) => (
                    <option key={option} value={option}>
                      {qualityLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Aspect ratio</span>
              <select
                className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
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
              <span className="text-sm font-semibold text-white/76">Quantity</span>
              <select
                className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                value={settings.quantity}
                onChange={(event) => {
                  const nextQuantity = Number(event.target.value);
                  onSettingsChange({
                    ...settings,
                    quantity: nextQuantity,
                    poseMultiplierEnabled: nextQuantity === 1 ? settings.poseMultiplierEnabled : false,
                  });
                }}
              >
                {quantityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Prompt automation</span>
              <button
                className={
                  settings.autoPromptGen
                    ? "inline-flex w-full items-center justify-between rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                    : "inline-flex w-full items-center justify-between rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                }
                onClick={() => onSettingsChange({ ...settings, autoPromptGen: !settings.autoPromptGen })}
                type="button"
              >
                <span>{settings.autoPromptGen ? "Auto Prompt On" : "Auto Prompt Off"}</span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-xs">*</span>
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Prompt image automation</span>
              <button
                className={
                  settings.autoPromptImage
                    ? "inline-flex w-full items-center justify-between rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                    : "inline-flex w-full items-center justify-between rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                }
                onClick={() => {
                  const nextAutoPromptImage = !settings.autoPromptImage;
                  onSettingsChange({
                    ...settings,
                    autoPromptImage: nextAutoPromptImage,
                    autoPromptGen: nextAutoPromptImage ? true : settings.autoPromptGen,
                  });
                }}
                type="button"
              >
                <span>{settings.autoPromptImage ? "Auto Image On" : "Auto Image Off"}</span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-xs">*</span>
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Pose multiplier</span>
              <div className="group/pose relative">
                <button
                  className={
                    poseMultiplierEnabled
                      ? "inline-flex w-full items-center justify-between rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                      : "inline-flex w-full items-center justify-between rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131] disabled:cursor-not-allowed disabled:opacity-45"
                  }
                  disabled={!poseMultiplierAllowed}
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      poseMultiplierEnabled: !poseMultiplierEnabled,
                    })
                  }
                  type="button"
                >
                  <span>{poseMultiplierEnabled ? "Pose Multiplier On" : "Pose Multiplier Off"}</span>
                  <span className="flex items-center gap-2">
                    {!poseMultiplierAllowed ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/12 text-[11px] font-semibold text-white/58 opacity-0 transition group-hover/pose:opacity-100">
                        i
                      </span>
                    ) : null}
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-xs">*</span>
                  </span>
                </button>
                {!poseMultiplierAllowed ? (
                  <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 max-w-56 rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs leading-5 text-white/62 opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition duration-150 group-hover/pose:translate-y-0 group-hover/pose:opacity-100 group-hover/pose:delay-75">
                    You can only turn on pose multiplier when quantity is set to 1.
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-[#262626] p-2">
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/8 bg-[#202020] text-lg font-semibold text-white/78 transition hover:bg-[#2c2c2c] disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={!poseMultiplierEnabled || settings.poseMultiplier <= 1}
                  onClick={() => onSettingsChange({ ...settings, poseMultiplier: Math.max(1, settings.poseMultiplier - 1) })}
                  type="button"
                >
                  -
                </button>
                <div className="flex-1 rounded-lg border border-white/8 bg-[#202020] px-3 py-2 text-center text-sm font-semibold text-white">
                  {poseMultiplierEnabled ? `${settings.poseMultiplier}x` : "Off"}
                </div>
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/8 bg-[#202020] text-lg font-semibold text-white/78 transition hover:bg-[#2c2c2c] disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={!poseMultiplierEnabled || settings.poseMultiplier >= 4}
                  onClick={() => onSettingsChange({ ...settings, poseMultiplier: Math.min(4, settings.poseMultiplier + 1) })}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Pose multiplier prompt mode</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={
                    settings.posePromptMode === "AUTO"
                      ? "inline-flex items-center justify-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                      : "inline-flex items-center justify-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                  }
                  onClick={() => onSettingsChange({ ...settings, posePromptMode: "AUTO" })}
                  type="button"
                >
                  Auto mode
                </button>
                <button
                  className={
                    settings.posePromptMode === "CUSTOM"
                      ? "inline-flex items-center justify-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                      : "inline-flex items-center justify-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                  }
                  onClick={() => onSettingsChange({ ...settings, posePromptMode: "CUSTOM" })}
                  type="button"
                >
                  Custom prompt
                </button>
              </div>
              {settings.posePromptMode === "AUTO" ? (
                <div className="rounded-xl border border-white/8 bg-[#262626] px-3 py-3 text-sm leading-6 text-white/58">
                  Backend default pose-expansion prompt will be used automatically for the selected multiplier.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-white/54">Each prompt maps to one generated image in the multiplied output set.</p>
                  {posePromptTemplates.slice(0, visiblePosePromptCount).map((template, index) => (
                    <label key={index} className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Generated image {index + 1}</span>
                      <textarea
                        className={theme.input + " min-h-[96px] rounded-xl border-white/8 bg-[#262626] px-3 py-2.5 text-sm leading-6"}
                        value={template}
                        onChange={(event) => {
                          const nextPosePromptTemplates = posePromptTemplates.map((currentTemplate, templateIndex) =>
                            templateIndex === index ? event.target.value : currentTemplate,
                          );
                          onSettingsChange({
                            ...settings,
                            posePromptTemplate: nextPosePromptTemplates[0] || settings.posePromptTemplate,
                            posePromptTemplates: nextPosePromptTemplates,
                          });
                        }}
                        placeholder={`Describe the pose direction for generated image ${index + 1}`}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Face swap</span>
              <button
                className={
                  settings.faceSwap
                    ? "inline-flex w-full items-center justify-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                    : "inline-flex w-full items-center justify-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                }
                onClick={() => onSettingsChange({ ...settings, faceSwap: !settings.faceSwap })}
                type="button"
              >
                {settings.faceSwap ? "Enabled for all rows" : "Disabled for all rows"}
              </button>
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#262626] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Default prompt context</p>
              <p className="mt-3 text-sm leading-6 text-white/58">{promptPrefix}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/8 pt-5">
            <div>
              <p className="text-sm font-semibold text-white">Global reference images</p>
              <p className="mt-2 text-sm leading-6 text-white/54">
                These match the shared workflow inputs that should not be repeated row by row. Each slot can pull from uploads or the model gallery.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {settings.globalReferences.map((selection) => {
                const previewSrc = selection.asset?.url || selection.assetUrl || selection.uploadUrl || null;
                return (
                  <div key={selection.id} className="rounded-2xl border border-white/8 bg-[#262626] p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Slot {selection.slotIndex + 1}</p>
                      <span className="text-xs uppercase tracking-[0.18em] text-white/40">Global</span>
                    </div>
                    <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl border border-white/8 bg-[#1d1d1d]">
                      {previewSrc ? (
                        <img alt={selection.label} className="h-full w-full object-cover" src={previewSrc} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.24em] text-white/28">Empty</div>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <label className={theme.buttonSecondary + " cursor-pointer rounded-xl border-white/8 bg-[#2f2f2f] text-center text-xs text-white/78 hover:bg-[#353535]"}>
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
                      <button className={theme.buttonSecondary + " rounded-xl border-white/8 bg-[#2f2f2f] text-xs text-white/78 hover:bg-[#353535]"} onClick={() => onPickReference(selection.slotIndex)} type="button">
                        Use gallery image
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      </div>
    </section>
  );
}