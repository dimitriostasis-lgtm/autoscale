import type { BoardSettings } from "../../types";
import {
  generationModelOptions,
  getAspectRatioOptionsForGenerationModel,
  getMaxQuantityForGenerationModel,
  getPoseMultiplierResolutionOptionsForGenerationModel,
  getQualityOptionsForGenerationModel,
  getResolutionOptionsForGenerationModel,
  getVideoDurationOptionsForGenerationModel,
  isNsfwPoseMultiplierWorkspace,
  isPoseMultiplierWorkspace,
  isVideoGenerationModel,
  normalizeBoardAspectRatio,
  normalizePoseMultiplierResolution,
  normalizeQualityForGenerationModel,
  normalizePoseMultiplierGenerationModel,
  normalizeResolutionForGenerationModel,
  normalizeVideoDurationForGenerationModel,
  poseMultiplierGenerationModelOptions,
  qualityLabels,
  resolutionLabels,
  theme,
  workerModelLabels,
} from "../../styles/theme";

interface SettingsPanelProps {
  settings: BoardSettings;
  allowedGenerationModels: string[];
  generationKind: "image" | "video" | "voice";
  workspaceSafety?: "SFW" | "NSFW";
  poseWorkerModelLocked?: boolean;
  onSettingsChange: (nextSettings: BoardSettings) => void;
  onUploadReference: (slotIndex: number, file: File) => Promise<void> | void;
  onPickReference: (slotIndex: number) => void;
}

export function SettingsPanel({
  settings,
  allowedGenerationModels,
  generationKind,
  workspaceSafety = "SFW",
  poseWorkerModelLocked = false,
  onSettingsChange,
  onUploadReference,
  onPickReference,
}: SettingsPanelProps) {
  const posePromptTemplates = Array.from({ length: 4 }, (_, index) => settings.posePromptTemplates[index] ?? settings.posePromptTemplate);
  const isPoseMultiplierWorkspaceLayout = isPoseMultiplierWorkspace(settings.generationModel, settings.sdxlWorkspaceMode);
  const isFaceSwapWorkspaceLayout = settings.sdxlWorkspaceMode === "FACE_SWAP";
  const isSdxlDefaultWorkspace = settings.generationModel === "sdxl" && !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout;
  const isNsfwPoseMultiplierLayout = isNsfwPoseMultiplierWorkspace(settings.generationModel, settings.sdxlWorkspaceMode, workspaceSafety);
  const videoGenerationModel = isVideoGenerationModel(settings.generationModel);
  const visiblePosePromptCount = Math.max(1, Math.min(4, settings.poseMultiplier));
  const poseMultiplierAllowed = (isPoseMultiplierWorkspaceLayout || settings.quantity === 1) && !videoGenerationModel;
  const poseMultiplierEnabled = poseMultiplierAllowed && settings.poseMultiplierEnabled;
  const poseMultiplierGenerationModel = normalizePoseMultiplierGenerationModel(settings.poseMultiplierGenerationModel, settings.generationModel);
  const showWorkerQualityControl = settings.generationModel === "gpt_2" && !isPoseMultiplierWorkspaceLayout;
  const showPoseWorkerQualityControl = poseMultiplierEnabled && poseMultiplierGenerationModel === "gpt_2";
  const poseMultiplierResolution = normalizePoseMultiplierResolution(settings.poseMultiplierResolution, poseMultiplierGenerationModel, isNsfwPoseMultiplierLayout);
  const allowedPoseMultiplierResolutionOptions = getPoseMultiplierResolutionOptionsForGenerationModel(poseMultiplierGenerationModel, isNsfwPoseMultiplierLayout);
  const maxQuantity = getMaxQuantityForGenerationModel(settings.generationModel);
  const allowedAspectRatioOptions = getAspectRatioOptionsForGenerationModel(settings.generationModel);
  const allowedResolutionOptions = getResolutionOptionsForGenerationModel(settings.generationModel);
  const allowedVideoDurationOptions = getVideoDurationOptionsForGenerationModel(settings.generationModel);
  const selectedVideoDuration = normalizeVideoDurationForGenerationModel(settings.generationModel, settings.videoDurationSeconds);
  const firstVideoDuration = allowedVideoDurationOptions[0] ?? null;
  const lastVideoDuration = allowedVideoDurationOptions[allowedVideoDurationOptions.length - 1] ?? null;
  const resolvedVideoDuration = selectedVideoDuration ?? firstVideoDuration;
  const videoDurationProgress =
    resolvedVideoDuration !== null && firstVideoDuration !== null && lastVideoDuration !== null && lastVideoDuration > firstVideoDuration
      ? ((resolvedVideoDuration - firstVideoDuration) / (lastVideoDuration - firstVideoDuration)) * 100
      : 0;
  const allowedQualityOptions = getQualityOptionsForGenerationModel(showPoseWorkerQualityControl ? poseMultiplierGenerationModel : settings.generationModel);
  const quantityOptions = Array.from({ length: maxQuantity }, (_, index) => index + 1);
  const promptAutomationLabel = generationKind === "image" || videoGenerationModel ? "Text Prompt Automation" : "Prompt automation";
  const promptImageAutomationLabel = videoGenerationModel
    ? "Video Reference Automation"
    : generationKind === "image"
      ? "Image Reference Automation"
      : "Prompt image automation";
  const promptImageAutomationButtonLabel = videoGenerationModel
    ? settings.autoPromptImage
      ? "Auto Video On"
      : "Auto Video Off"
    : settings.autoPromptImage
      ? "Auto Image On"
      : "Auto Image Off";
  const isVoiceWorkspace = generationKind === "voice";
  const showImageReferenceAutomation = !isVoiceWorkspace && !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout;
  const showPoseMultiplierSharedOptions = generationKind === "image" && !isSdxlDefaultWorkspace && !isFaceSwapWorkspaceLayout;
  const showUpscaleControls = generationKind === "image" && isSdxlDefaultWorkspace;
  const showFaceSwapControls = generationKind === "image";
  const showGlobalReferences = false;
  const promptAutomationLocked = settings.generationModel === "kling_motion_control";
  const aspectRatioLocked = settings.generationModel === "kling_motion_control" || isPoseMultiplierWorkspaceLayout;
  const displayedAspectRatioOptions = aspectRatioLocked ? (["auto"] as const) : allowedAspectRatioOptions;
  const poseWorkerModelControlLocked = poseWorkerModelLocked || isNsfwPoseMultiplierLayout;
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
            {!isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout ? (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-white/76">Worker model</span>
              <select
                className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                value={settings.generationModel}
                onChange={(event) => {
                  const nextGenerationModel = event.target.value;
                  const nextVideoGenerationModel = isVideoGenerationModel(nextGenerationModel);
                  const nextQuantity = Math.min(settings.quantity, getMaxQuantityForGenerationModel(nextGenerationModel));
                  const nextSdxlWorkspaceMode = !nextVideoGenerationModel ? settings.sdxlWorkspaceMode ?? "DEFAULT" : "DEFAULT";
                  const nextPoseMultiplierWorkspace = isPoseMultiplierWorkspace(nextGenerationModel, nextSdxlWorkspaceMode);
                  const nextSdxlDefaultWorkspace = nextGenerationModel === "sdxl" && !nextPoseMultiplierWorkspace;
                  const nextNsfwPoseMultiplierWorkspace = isNsfwPoseMultiplierWorkspace(nextGenerationModel, nextSdxlWorkspaceMode, workspaceSafety);
                  const nextResolution = normalizeResolutionForGenerationModel(nextGenerationModel, settings.resolution);
                  const nextPoseMultiplierGenerationModel = nextNsfwPoseMultiplierWorkspace
                    ? "sdxl"
                    : normalizePoseMultiplierGenerationModel(settings.poseMultiplierGenerationModel, nextGenerationModel);
                  const nextQuality = normalizeQualityForGenerationModel(nextGenerationModel, settings.quality);
                  onSettingsChange({
                    ...settings,
                    generationModel: nextGenerationModel,
                    resolution: nextResolution,
                    poseMultiplierResolution: normalizePoseMultiplierResolution(
                      settings.poseMultiplierResolution ?? nextResolution,
                      nextPoseMultiplierGenerationModel,
                      nextNsfwPoseMultiplierWorkspace,
                    ),
                    videoDurationSeconds: normalizeVideoDurationForGenerationModel(nextGenerationModel, settings.videoDurationSeconds),
                    quality: nextQuality,
                    aspectRatio: normalizeBoardAspectRatio(nextGenerationModel, settings.aspectRatio, nextSdxlWorkspaceMode),
                    quantity: nextPoseMultiplierWorkspace ? 1 : nextQuantity,
                    sdxlWorkspaceMode: nextSdxlWorkspaceMode,
                    autoPromptGen: nextGenerationModel === "kling_motion_control" ? false : settings.autoPromptGen,
                    autoPromptImage: nextPoseMultiplierWorkspace ? false : settings.autoPromptImage,
                    poseMultiplierEnabled: nextPoseMultiplierWorkspace ? true : nextSdxlDefaultWorkspace ? false : nextQuantity === 1 && !nextVideoGenerationModel ? settings.poseMultiplierEnabled : false,
                    poseMultiplierGenerationModel: nextPoseMultiplierGenerationModel,
                    upscale: nextSdxlDefaultWorkspace ? settings.upscale : false,
                    faceSwap: settings.faceSwap,
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
              ) : null}

              {!isVoiceWorkspace && !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout ? (
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
            ) : null}

            {isPoseMultiplierWorkspaceLayout ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-white/76">Pose Worker Model</span>
                  {isNsfwPoseMultiplierLayout ? (
                    <select
                      className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-55"}
                      disabled
                      value="automatic"
                    >
                      <option value="automatic">AUTO</option>
                    </select>
                  ) : (
                    <select
                      className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                      value={poseMultiplierGenerationModel}
                      onChange={(event) => {
                        const nextPoseMultiplierGenerationModel = event.target.value;
                        onSettingsChange({
                          ...settings,
                          poseMultiplierGenerationModel: nextPoseMultiplierGenerationModel,
                          poseMultiplierResolution: normalizePoseMultiplierResolution(
                            settings.poseMultiplierResolution,
                            nextPoseMultiplierGenerationModel,
                          ),
                        });
                      }}
                    >
                      {poseMultiplierGenerationModelOptions.map((option) => (
                        <option key={option} value={option}>
                          {workerModelLabels[option]}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                {showPoseWorkerQualityControl ? (
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
              </>
            ) : null}

            {isPoseMultiplierWorkspaceLayout ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Pose Multiplier Resolution</span>
                <select
                  className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                  value={poseMultiplierResolution}
                  onChange={(event) => onSettingsChange({ ...settings, poseMultiplierResolution: event.target.value })}
                >
                  {allowedPoseMultiplierResolutionOptions.map((option) => (
                    <option key={option} value={option}>
                      {resolutionLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {showWorkerQualityControl && !isFaceSwapWorkspaceLayout ? (
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

            {!isVoiceWorkspace && !isFaceSwapWorkspaceLayout ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Aspect ratio</span>
                <select
                  className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-55"}
                  disabled={aspectRatioLocked}
                  value={normalizeBoardAspectRatio(settings.generationModel, settings.aspectRatio, settings.sdxlWorkspaceMode)}
                  onChange={(event) => onSettingsChange({ ...settings, aspectRatio: event.target.value })}
                >
                  {displayedAspectRatioOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {allowedVideoDurationOptions.length && !isFaceSwapWorkspaceLayout ? (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Duration</span>
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-2 shadow-[var(--shadow-soft)]">
                  <div className="rounded-xl bg-[color:var(--surface-card)] p-2">
                    <p className="mb-2 text-sm font-semibold text-[color:var(--text-strong)]">Choose duration</p>
                    <div className="w-full" role="group" aria-label="Choose duration">
                      <div className="group relative h-9 w-full overflow-hidden rounded-md border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] transition hover:border-[color:var(--surface-border-strong)]">
                        <output className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-left text-xs font-semibold text-[color:var(--text-strong)]">
                          {resolvedVideoDuration}s
                        </output>
                        <div
                          className="pointer-events-none absolute inset-y-0 left-0 bg-[color:var(--accent-soft)] transition-[width]"
                          style={{ width: `${videoDurationProgress}%` }}
                        />
                        <input
                          aria-label="Choose duration"
                          aria-valuetext={resolvedVideoDuration !== null ? `${resolvedVideoDuration}s` : undefined}
                          className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                          max={lastVideoDuration ?? 0}
                          min={firstVideoDuration ?? 0}
                          onChange={(event) => onSettingsChange({ ...settings, videoDurationSeconds: Number(event.target.value) })}
                          step={1}
                          type="range"
                          value={resolvedVideoDuration ?? firstVideoDuration ?? 0}
                        />
                        <div
                          className="pointer-events-none absolute top-1/2 z-10 h-full w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--accent-main)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-main)_32%,transparent)] transition-[left]"
                          style={{ left: `${videoDurationProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!videoGenerationModel && !isVoiceWorkspace && !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout ? (
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
            ) : null}

            {!isFaceSwapWorkspaceLayout ? (
            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">{promptAutomationLabel}</span>
              <button
                className={
                  settings.autoPromptGen && !promptAutomationLocked
                    ? "grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                    : "grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131] disabled:cursor-not-allowed disabled:opacity-50"
                }
                disabled={promptAutomationLocked}
                onClick={() => {
                  if (!promptAutomationLocked) {
                    onSettingsChange({ ...settings, autoPromptGen: !settings.autoPromptGen });
                  }
                }}
                type="button"
              >
                <span aria-hidden="true" />
                <span className="text-center">{promptAutomationLocked ? "Unsupported" : settings.autoPromptGen ? "Auto Prompt On" : "Auto Prompt Off"}</span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-xs">*</span>
              </button>
              {promptAutomationLocked ? (
                <p className="text-xs leading-5 text-white/48">Kling Motion Control does not support text prompts or text prompt automation.</p>
              ) : null}
            </div>
            ) : null}

            {showImageReferenceAutomation ? (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/76">{promptImageAutomationLabel}</span>
                <button
                  className={
                    settings.autoPromptImage
                      ? "grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                      : "grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                  }
                  onClick={() => {
                    const nextAutoPromptImage = !settings.autoPromptImage;
                    onSettingsChange({
                      ...settings,
                      autoPromptImage: nextAutoPromptImage,
                      autoPromptGen: nextAutoPromptImage && !promptAutomationLocked ? true : settings.autoPromptGen,
                    });
                  }}
                  type="button"
                >
                  <span aria-hidden="true" />
                  <span className="text-center">{promptImageAutomationButtonLabel}</span>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-xs">*</span>
                </button>
              </div>
            ) : null}

            {showPoseMultiplierSharedOptions ? (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Pose multiplier</span>
                {!isSdxlDefaultWorkspace ? (
                  <>
                <div className="group/pose relative">
                  <button
                    className={
                      poseMultiplierEnabled
                        ? "inline-flex w-full items-center justify-between rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515] disabled:cursor-not-allowed disabled:opacity-70"
                        : "inline-flex w-full items-center justify-between rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131] disabled:cursor-not-allowed disabled:opacity-45"
                    }
                    disabled={!poseMultiplierAllowed || isPoseMultiplierWorkspaceLayout}
                    onClick={() => {
                      if (!isPoseMultiplierWorkspaceLayout) {
                        onSettingsChange({
                          ...settings,
                          poseMultiplierEnabled: !poseMultiplierEnabled,
                        });
                      }
                    }}
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
                {!isPoseMultiplierWorkspaceLayout && poseMultiplierEnabled ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/76">Pose Worker Model</span>
                    <select
                      className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                      disabled={poseWorkerModelControlLocked || !poseMultiplierAllowed}
                      value={poseWorkerModelControlLocked ? "automatic" : poseMultiplierGenerationModel}
                      onChange={(event) => {
                        const nextPoseMultiplierGenerationModel = event.target.value;
                        onSettingsChange({
                          ...settings,
                          poseMultiplierGenerationModel: nextPoseMultiplierGenerationModel,
                          poseMultiplierResolution: normalizePoseMultiplierResolution(
                            settings.poseMultiplierResolution,
                            nextPoseMultiplierGenerationModel,
                          ),
                        });
                      }}
                    >
                      {poseWorkerModelControlLocked ? (
                        <option value="automatic">AUTO</option>
                      ) : (
                        poseMultiplierGenerationModelOptions.map((option) => (
                          <option key={option} value={option}>
                            {workerModelLabels[option]}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                ) : null}
                {!isPoseMultiplierWorkspaceLayout && showPoseWorkerQualityControl ? (
                  <label className="block space-y-2">
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
                {!isPoseMultiplierWorkspaceLayout && poseMultiplierEnabled ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/76">Pose Multiplier Resolution</span>
                    <select
                      className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                      value={poseMultiplierResolution}
                      onChange={(event) => onSettingsChange({ ...settings, poseMultiplierResolution: event.target.value })}
                    >
                      {allowedPoseMultiplierResolutionOptions.map((option) => (
                        <option key={option} value={option}>
                          {resolutionLabels[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {showPoseMultiplierSharedOptions ? (
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
            ) : null}

            {showFaceSwapControls ? (
              <>
                {showUpscaleControls ? (
                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-white/76">Upscale</span>
                    <button
                      className={
                        settings.upscale
                          ? "inline-flex w-full items-center justify-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                          : "inline-flex w-full items-center justify-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                      }
                      onClick={() => onSettingsChange({ ...settings, upscale: !settings.upscale })}
                      type="button"
                    >
                      {settings.upscale ? "Enabled for all rows" : "Disabled for all rows"}
                    </button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-white/76">Face swap</span>
                  <button
                    className={
                      isFaceSwapWorkspaceLayout || settings.faceSwap
                        ? "inline-flex w-full items-center justify-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                        : "inline-flex w-full items-center justify-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                    }
                    disabled={isFaceSwapWorkspaceLayout}
                    onClick={() => {
                      if (!isFaceSwapWorkspaceLayout) {
                        onSettingsChange({ ...settings, faceSwap: !settings.faceSwap });
                      }
                    }}
                    type="button"
                  >
                    {isFaceSwapWorkspaceLayout || settings.faceSwap ? "Enabled for all rows" : "Disabled for all rows"}
                  </button>
                </div>
              </>
            ) : null}

          </div>

          {showGlobalReferences ? (
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
          ) : null}
      </div>
    </section>
  );
}
