import type { BoardSettings } from "../../types";
import { cx } from "../../lib/cx";
import { AUTO_IMAGE_CREDITS, TEXT_PROMPT_AUTOMATION_CREDITS, formatCreditCost } from "../../lib/generationCosts";
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
  onCollapse?: () => void;
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
  onCollapse,
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
  const showResolutionControl = allowedResolutionOptions.length > 0;
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
  const promptAutomationUnsupported = settings.generationModel === "kling_motion_control";
  const promptAutomationReferenceLocked = showImageReferenceAutomation && settings.autoPromptImage && !promptAutomationUnsupported;
  const promptAutomationLocked = promptAutomationUnsupported || promptAutomationReferenceLocked;
  const promptAutomationOn = (settings.autoPromptGen || promptAutomationReferenceLocked) && !promptAutomationUnsupported;
  const promptAutomationLockReason = promptAutomationUnsupported
    ? "Kling Motion Control does not support text prompts or text prompt automation."
    : promptAutomationReferenceLocked
      ? videoGenerationModel
        ? "Auto Prompt stays on while Auto Video is enabled because the video reference needs a generated text prompt."
        : "Auto Prompt stays on while Auto Image is enabled because the image reference needs a generated text prompt."
      : undefined;
  const referenceAutomationOn = settings.autoPromptImage;
  const autoReferenceCostLabel = `${formatCreditCost(AUTO_IMAGE_CREDITS)} credits/row`;
  const promptAutomationCostLabel = `${formatCreditCost(TEXT_PROMPT_AUTOMATION_CREDITS)} credits/row`;
  const autoReferenceCostTitle = `${videoGenerationModel ? "Auto Video" : "Auto Image"} adds ${autoReferenceCostLabel}.`;
  const promptAutomationCostTitle = `Text Prompt Automation adds ${promptAutomationCostLabel}.`;
  const aspectRatioLocked = settings.generationModel === "kling_motion_control" || isPoseMultiplierWorkspaceLayout;
  const displayedAspectRatioOptions = aspectRatioLocked && allowedAspectRatioOptions.includes("auto") ? (["auto"] as const) : allowedAspectRatioOptions;
  const poseWorkerModelControlLocked = poseWorkerModelLocked || isNsfwPoseMultiplierLayout;
  const faceSwapOn = isFaceSwapWorkspaceLayout || settings.faceSwap;
  const upscaleFactor = [1, 1.5, 2].includes(settings.upscaleFactor) ? settings.upscaleFactor : 1;
  const upscaleDenoise = Math.max(0, Math.min(0.4, settings.upscaleDenoise ?? 0));
  const faceSwapModelStrength = Math.max(0.3, Math.min(0.6, settings.faceSwapModelStrength ?? 0.5));
  return (
    <section className="h-full bg-[#202020] text-white">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Workspace rail</p>
            <h3 className="font-display mt-2 text-xl text-white">Shared controls</h3>
          </div>
          {onCollapse ? (
            <button
              className="inline-flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-base font-bold leading-none text-white/68 transition hover:bg-white/[0.08] hover:text-white"
              onClick={onCollapse}
              title="Hide shared controls"
              type="button"
            >
              <svg aria-hidden="true" className="size-4 xl:-rotate-90" viewBox="0 0 20 20">
                <path
                  d="M5.25 12.25 10 7.5l4.75 4.75"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          ) : null}
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
                    autoPromptGen: nextGenerationModel === "kling_motion_control" ? false : settings.autoPromptImage ? true : settings.autoPromptGen,
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

              {!isVoiceWorkspace && showResolutionControl && !isPoseMultiplierWorkspaceLayout && !isFaceSwapWorkspaceLayout ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Resolution</span>
                <select
                  className={theme.input + " rounded-xl border-white/8 bg-[#262626] px-3 py-2.5"}
                  value={normalizeResolutionForGenerationModel(settings.generationModel, settings.resolution)}
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

            {isPoseMultiplierWorkspaceLayout && allowedPoseMultiplierResolutionOptions.length > 0 ? (
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

            {showImageReferenceAutomation ? (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/76">{promptImageAutomationLabel}</span>
                <button
                  className={cx(
                    "workspace-auto-reference-toggle relative grid w-full grid-cols-[1.75rem_1fr_1.75rem] items-center overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                    referenceAutomationOn
                      ? "workspace-auto-reference-toggle--on border-[#7aa321]/70 text-[#f4ffd8] hover:brightness-105"
                      : "border-white/8 bg-[#262626] text-white/76 hover:bg-[#313131]",
                  )}
                  onClick={() => {
                    const nextAutoPromptImage = !settings.autoPromptImage;
                    onSettingsChange({
                      ...settings,
                      autoPromptImage: nextAutoPromptImage,
                      autoPromptGen: nextAutoPromptImage && !promptAutomationLocked ? true : settings.autoPromptGen,
                    });
                  }}
                  title={autoReferenceCostTitle}
                  type="button"
                >
                  <span
                    className={cx(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full border",
                      referenceAutomationOn ? "border-[#c7ff27]/25 bg-[#c7ff27]/12 text-[#f4ffd8]" : "border-current/12 text-white/44",
                    )}
                    aria-hidden="true"
                  >
                    {videoGenerationModel ? (
                      <svg className="size-3.5" viewBox="0 0 20 20">
                        <path
                          d="M4.5 5.75A2.25 2.25 0 0 1 6.75 3.5h5.5a2.25 2.25 0 0 1 2.25 2.25v8.5a2.25 2.25 0 0 1-2.25 2.25h-5.5a2.25 2.25 0 0 1-2.25-2.25v-8.5Zm10 3.05 2.64-1.5a.65.65 0 0 1 .98.56v4.28a.65.65 0 0 1-.98.56l-2.64-1.5V8.8Z"
                          fill="currentColor"
                        />
                      </svg>
                    ) : (
                      <svg className="size-3.5" viewBox="0 0 20 20">
                        <path
                          d="M4.75 3.75h10.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4.75a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Zm0 1.5a.5.5 0 0 0-.5.5v6.2l2.76-2.76a1.5 1.5 0 0 1 2.12 0l1.01 1.01.7-.7a1.5 1.5 0 0 1 2.12 0l2.29 2.29V5.75a.5.5 0 0 0-.5-.5H4.75Zm3.5 3.25a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
                          fill="currentColor"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center leading-tight">
                    <span className="truncate">{promptImageAutomationButtonLabel}</span>
                    {referenceAutomationOn ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#f4ffd8]/72">{autoReferenceCostLabel}</span>
                    ) : null}
                  </span>
                  <span
                    className={cx(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                      referenceAutomationOn ? "border-[#c7ff27]/25 bg-[#c7ff27]/12" : "border-current/20",
                    )}
                    aria-hidden="true"
                  >
                    {referenceAutomationOn ? <span className="workspace-auto-prompt-live-dot" /> : "*"}
                  </span>
                </button>
              </div>
            ) : null}

            {!isFaceSwapWorkspaceLayout ? (
            <div className="space-y-2">
              <span className="text-sm font-semibold text-white/76">{promptAutomationLabel}</span>
              <div className="group/prompt-lock relative" title={promptAutomationLockReason || promptAutomationCostTitle}>
              <button
                className={cx(
                  "workspace-auto-prompt-toggle relative grid w-full grid-cols-[1.75rem_1fr_1.75rem] items-center overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                  promptAutomationOn
                    ? "workspace-auto-prompt-toggle--on border-[#7aa321]/70 text-[#f4ffd8] hover:brightness-105"
                    : "border-white/8 bg-[#262626] text-white/76 hover:bg-[#313131]",
                )}
                disabled={promptAutomationLocked}
                title={promptAutomationLockReason || promptAutomationCostTitle}
                onClick={() => {
                  if (!promptAutomationLocked) {
                    onSettingsChange({ ...settings, autoPromptGen: !settings.autoPromptGen });
                  }
                }}
                type="button"
              >
                <span
                  className={cx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border",
                    promptAutomationOn ? "border-[#c7ff27]/25 bg-[#c7ff27]/12 text-[#f4ffd8]" : "border-current/12 text-white/44",
                  )}
                  aria-hidden="true"
                >
                  <svg className="size-3.5" viewBox="0 0 20 20">
                    <path
                      d="M9.1 2.4a.9.9 0 0 1 1.8 0l.16 1.26a4.5 4.5 0 0 0 3.88 3.88l1.26.16a.9.9 0 0 1 0 1.8l-1.26.16a4.5 4.5 0 0 0-3.88 3.88l-.16 1.26a.9.9 0 0 1-1.8 0l-.16-1.26a4.5 4.5 0 0 0-3.88-3.88L3.8 9.5a.9.9 0 0 1 0-1.8l1.26-.16a4.5 4.5 0 0 0 3.88-3.88L9.1 2.4Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <span className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center leading-tight">
                  <span className="truncate">{promptAutomationUnsupported ? "Unsupported" : promptAutomationOn ? "Auto Prompt On" : "Auto Prompt Off"}</span>
                  {promptAutomationOn ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#f4ffd8]/72">{promptAutomationCostLabel}</span>
                  ) : null}
                </span>
                <span
                  className={cx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                    promptAutomationOn ? "border-[#c7ff27]/25 bg-[#c7ff27]/12" : "border-current/20",
                  )}
                  aria-hidden="true"
                >
                  {promptAutomationOn ? <span className="workspace-auto-prompt-live-dot" /> : "*"}
                </span>
              </button>
              {promptAutomationLockReason ? (
                <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 max-w-64 rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs leading-5 text-white/66 opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition duration-150 group-hover/prompt-lock:opacity-100">
                  {promptAutomationLockReason}
                </div>
              ) : null}
              </div>
              {promptAutomationUnsupported ? (
                <p className="text-xs leading-5 text-white/48">{promptAutomationLockReason}</p>
              ) : null}
            </div>
            ) : null}

            {showPoseMultiplierSharedOptions ? (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Pose Multiplier</span>
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
                {!isPoseMultiplierWorkspaceLayout && poseMultiplierEnabled && allowedPoseMultiplierResolutionOptions.length > 0 ? (
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

            {showPoseMultiplierSharedOptions && poseMultiplierEnabled ? (
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/76">Pose Multiplier Prompt Guide</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={
                      settings.posePromptMode === "AUTO"
                        ? "inline-flex items-center justify-center gap-2 rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                        : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                    }
                    onClick={() => onSettingsChange({ ...settings, posePromptMode: "AUTO" })}
                    type="button"
                  >
                    <span>Auto Mode</span>
                    {settings.posePromptMode === "AUTO" ? <span className="workspace-auto-prompt-live-dot" aria-hidden="true" /> : null}
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
                    Custom Prompt
                  </button>
                </div>
                {settings.posePromptMode === "CUSTOM" ? (
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
                ) : null}
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
                      {settings.upscale ? "On" : "Off"}
                    </button>
                    {settings.upscale ? (
                      <div className="space-y-3 rounded-xl border border-white/8 bg-[#262626] p-3">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Upscale Factor</span>
                          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/8 bg-[#202020] p-1">
                            {[1, 1.5, 2].map((factor) => (
                              <button
                                className={
                                  upscaleFactor === factor
                                    ? "rounded-lg bg-[#4d7311] px-2 py-2 text-xs font-bold text-[#f4ffd8]"
                                    : "rounded-lg px-2 py-2 text-xs font-semibold text-white/62 transition hover:bg-white/[0.06] hover:text-white"
                                }
                                key={factor}
                                onClick={() => onSettingsChange({ ...settings, upscaleFactor: factor })}
                                type="button"
                              >
                                {factor}x
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Denoise</span>
                              <span className="group/upscale-denoise relative inline-flex">
                                <button
                                  aria-label="Denoise info"
                                  className="inline-flex size-5 items-center justify-center rounded-full border border-white/14 bg-[#202020] text-[11px] font-bold text-white/62"
                                  type="button"
                                >
                                  i
                                </button>
                                <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs font-medium leading-5 text-white/66 opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition duration-150 group-hover/upscale-denoise:opacity-100 sm:w-64">
                                  The amount of denoising applied, lower values will maintain the structure of the initial image allowing for image to image sampling
                                </span>
                              </span>
                            </div>
                            <output className="rounded-lg border border-white/8 bg-[#202020] px-2 py-1 text-xs font-bold text-white/82">
                              {upscaleDenoise.toFixed(2)}
                            </output>
                          </div>
                          <input
                            aria-label="Denoise"
                            className="h-2 w-full cursor-pointer accent-[#c7ff27]"
                            max={0.4}
                            min={0}
                            onChange={(event) =>
                              onSettingsChange({
                                ...settings,
                                upscaleDenoise: Math.max(0, Math.min(0.4, Number(event.target.value))),
                              })
                            }
                            step={0.01}
                            type="range"
                            value={upscaleDenoise}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-white/76">Face Swap</span>
                  <button
                    className={
                      faceSwapOn
                        ? "inline-flex w-full items-center justify-center rounded-xl border border-[#4e6b22] bg-[#4d7311] px-3 py-2.5 text-sm font-semibold text-[#f4ffd8] transition hover:bg-[#598515]"
                        : "inline-flex w-full items-center justify-center rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm font-semibold text-white/76 transition hover:bg-[#313131]"
                    }
                    disabled={isFaceSwapWorkspaceLayout}
                    onClick={() => {
                      if (!isFaceSwapWorkspaceLayout) {
                        onSettingsChange({
                          ...settings,
                          faceSwap: !settings.faceSwap,
                          faceSwapModelStrength: settings.faceSwap ? faceSwapModelStrength : 0.5,
                        });
                      }
                    }}
                    type="button"
                  >
                    {faceSwapOn ? "On" : "Off"}
                  </button>
                  {faceSwapOn ? (
                    <div className="space-y-2 rounded-xl border border-white/8 bg-[#262626] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Model Strength</span>
                          <span className="group/face-strength relative inline-flex">
                            <button
                              aria-label="Model strength info"
                              className="inline-flex size-5 items-center justify-center rounded-full border border-white/14 bg-[#202020] text-[11px] font-bold text-white/62"
                              type="button"
                            >
                              i
                            </button>
                            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs font-medium leading-5 text-white/66 opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition duration-150 group-hover/face-strength:opacity-100">
                              Optional: Set face strength. Default 0.50, you can go up to 0.6 and see result change.
                            </span>
                          </span>
                        </div>
                        <output className="rounded-lg border border-white/8 bg-[#202020] px-2 py-1 text-xs font-bold text-white/82">
                          {faceSwapModelStrength.toFixed(2)}
                        </output>
                      </div>
                      <input
                        aria-label="Model Strength"
                        className="h-2 w-full cursor-pointer accent-[#c7ff27]"
                        max={0.6}
                        min={0.3}
                        onChange={(event) =>
                          onSettingsChange({
                            ...settings,
                            faceSwapModelStrength: Math.max(0.3, Math.min(0.6, Number(event.target.value))),
                          })
                        }
                        step={0.01}
                        type="range"
                        value={faceSwapModelStrength}
                      />
                    </div>
                  ) : null}
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
