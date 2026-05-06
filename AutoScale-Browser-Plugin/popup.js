const els = {
  authStatus: document.querySelector("#authStatus"),
  pluginToggle: document.querySelector("#pluginToggle"),
  pluginToggleLabel: document.querySelector("#pluginToggleLabel"),
  pluginPowerTitle: document.querySelector("#pluginPowerTitle"),
  pluginPowerCopy: document.querySelector("#pluginPowerCopy"),
  loginPanel: document.querySelector("#loginPanel"),
  workspacePanel: document.querySelector("#workspacePanel"),
  loginForm: document.querySelector("#loginForm"),
  defaultAdminButton: document.querySelector("#defaultAdminButton"),
  serverUrl: document.querySelector("#serverUrl"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  userLabel: document.querySelector("#userLabel"),
  modelSelect: document.querySelector("#modelSelect"),
  workflowSelect: document.querySelector("#workflowSelect"),
  runTargetSelect: document.querySelector("#runTargetSelect"),
  imageLayoutSelect: document.querySelector("#imageLayoutSelect"),
  imageModelSelect: document.querySelector("#imageModelSelect"),
  imageQualitySelect: document.querySelector("#imageQualitySelect"),
  imageResolutionSelect: document.querySelector("#imageResolutionSelect"),
  imageAspectRatioSelect: document.querySelector("#imageAspectRatioSelect"),
  imageQuantitySelect: document.querySelector("#imageQuantitySelect"),
  videoModelSelect: document.querySelector("#videoModelSelect"),
  videoResolutionSelect: document.querySelector("#videoResolutionSelect"),
  videoDurationSelect: document.querySelector("#videoDurationSelect"),
  audioModelSelect: document.querySelector("#audioModelSelect"),
  imageCount: document.querySelector("#imageCount"),
  videoCount: document.querySelector("#videoCount"),
  audioCount: document.querySelector("#audioCount"),
  refreshButton: document.querySelector("#refreshButton"),
  runButton: document.querySelector("#runButton"),
  message: document.querySelector("#message"),
};

const DEFAULT_ADMIN_EMAIL = "admin@autoscale.internal";
const DEFAULT_ADMIN_PASSWORD = "Admin!123";

const IMAGE_MODELS = ["nb_pro", "nb2", "sd_4_5", "gpt_2", "flux_2", "kling_o1", "flux_kontext", "z_image", "sdxl"];
const IMAGE_NSFW_MODELS = ["sd_4_5", "sdxl"];
const VIDEO_MODELS = ["sd_2_0", "kling_3_0"];
const VIDEO_NSFW_MODELS = ["sd_2_0"];
const VOICE_MODELS = [];
const NO_RESOLUTION_OPTION = "__no_resolution__";
const NO_AUDIO_MODEL_OPTION = "__no_audio_model__";
const COMMON_IMAGE_ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"];
const NANO_BANANA_PRO_ASPECT_RATIOS = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"];
const NANO_BANANA_2_ASPECT_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"];
const SEEDREAM_ASPECT_RATIOS = ["1:1", "4:3", "16:9", "3:2", "21:9", "3:4", "9:16", "2:3"];
const GPT_IMAGE_2_ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"];
const KLING_O1_ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"];
const SEEDANCE_ASPECT_RATIOS = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const KLING_3_ASPECT_RATIOS = ["16:9", "9:16", "1:1"];
const QUALITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const MODEL_LABELS = {
  nb_pro: "Nano Banana Pro",
  nb2: "Nano Banana 2",
  sd_4_5: "Seedream 4.5",
  gpt_2: "GPT Image 2",
  flux_2: "Flux 2 Pro",
  kling_o1: "Kling O1 Image",
  flux_kontext: "Flux Kontext Max",
  z_image: "Z Image",
  sdxl: "SDXL",
  sd_2_0: "Seedance 2.0",
  kling_3_0: "Kling 3.0",
};

const RESOLUTION_LABELS = {
  "480p": "480p",
  "720p": "720p",
  "1080p": "1080p",
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
  [NO_RESOLUTION_OPTION]: "N/A",
  [NO_AUDIO_MODEL_OPTION]: "No audio models",
};

let currentState = null;

function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, payload });
}

function setBusy(isBusy) {
  document.querySelectorAll("button, input, select").forEach((element) => {
    element.disabled = isBusy;
  });

  if (!isBusy && currentState) {
    renderState(currentState);
  }
}

function showMessage(text, tone = "") {
  els.message.textContent = text || "";
  els.message.className = `message ${tone}`.trim();
}

function selectedModel(state) {
  return state.models.find((model) => model.id === state.selectedModelId) || state.models[0] || null;
}

function allowedModelOptions(model, options) {
  const allowed = model?.allowedGenerationModels?.length ? model.allowedGenerationModels : options;
  return options.filter((option) => allowed.includes(option));
}

function getAllowedResolutions(generationModel) {
  if (generationModel === "sdxl") return ["1k", "2k"];
  if (generationModel === "nb_pro") return ["1k", "2k", "4k"];
  if (generationModel === "nb2") return ["1k", "2k", "4k"];
  if (generationModel === "gpt_2") return ["1k", "2k", "4k"];
  if (generationModel === "sd_4_5") return ["2k", "4k"];
  if (generationModel === "flux_2") return ["1k", "2k"];
  if (generationModel === "kling_o1") return ["1k", "2k"];
  if (generationModel === "flux_kontext" || generationModel === "z_image") return [];
  if (generationModel === "sd_2_0") return ["480p", "720p", "1080p"];
  if (generationModel === "kling_3_0") return ["1080p", "4k"];
  return ["1k", "2k", "4k"];
}

function getVideoDurations(generationModel) {
  if (generationModel === "sd_2_0") {
    return Array.from({ length: 12 }, (_, index) => index + 4);
  }

  if (generationModel === "kling_3_0") {
    return Array.from({ length: 13 }, (_, index) => index + 3);
  }

  return [];
}

function getQualityOptions(generationModel) {
  return generationModel === "gpt_2" ? ["low", "medium", "high"] : ["medium"];
}

function getAspectOptions(generationModel, imageLayout) {
  if (imageLayout === "POSE_MULTIPLIER") {
    return ["auto"];
  }

  if (generationModel === "sdxl") {
    return COMMON_IMAGE_ASPECT_RATIOS;
  }

  if (generationModel === "nb_pro") {
    return NANO_BANANA_PRO_ASPECT_RATIOS;
  }

  if (generationModel === "nb2") {
    return NANO_BANANA_2_ASPECT_RATIOS;
  }

  if (generationModel === "sd_4_5") {
    return SEEDREAM_ASPECT_RATIOS;
  }

  if (generationModel === "gpt_2") {
    return GPT_IMAGE_2_ASPECT_RATIOS;
  }

  if (generationModel === "kling_o1") {
    return KLING_O1_ASPECT_RATIOS;
  }

  if (generationModel === "sd_2_0") {
    return SEEDANCE_ASPECT_RATIOS;
  }

  if (generationModel === "kling_3_0") {
    return KLING_3_ASPECT_RATIOS;
  }

  return COMMON_IMAGE_ASPECT_RATIOS;
}

function selectValue(value, options, fallback = "") {
  return options.includes(value) ? value : options[0] || fallback;
}

function optionLabel(value) {
  return MODEL_LABELS[value] || RESOLUTION_LABELS[value] || String(value).toUpperCase();
}

function renderSelectOptions(select, values, selectedValue, labeler = optionLabel) {
  select.innerHTML = "";

  for (const value of values) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = labeler(value);
    option.selected = String(value) === String(selectedValue);
    select.append(option);
  }
}

function renderResolutionOptions(select, values, selectedValue) {
  if (!values.length) {
    renderSelectOptions(select, [NO_RESOLUTION_OPTION], NO_RESOLUTION_OPTION);
    return;
  }

  renderSelectOptions(select, values, selectValue(selectedValue, values));
}

function renderAudioModelOptions(values, selectedValue) {
  if (!values.length) {
    renderSelectOptions(els.audioModelSelect, [NO_AUDIO_MODEL_OPTION], NO_AUDIO_MODEL_OPTION);
    return;
  }

  renderSelectOptions(els.audioModelSelect, values, selectValue(selectedValue, values));
}

function buildWorkflowOptions(model) {
  if (!model) {
    return [{ id: "default-platform", label: "Default platform workflow" }];
  }

  const platformCount = Math.max(1, Number(model.platformWorkflowCount) || 1);
  const customCount = Math.max(0, Number(model.customWorkflowCount) || 0);
  const options = [{ id: "default-platform", label: model.defaultPlatformWorkflowName || "Default platform workflow" }];

  for (let index = 2; index <= platformCount; index += 1) {
    options.push({ id: `platform-${index}`, label: `Platform workflow ${index}` });
  }

  for (let index = 1; index <= customCount; index += 1) {
    options.push({ id: `custom-${index}`, label: `Custom workflow ${index}` });
  }

  return options;
}

function renderModels(state) {
  const selectedModelId = state.selectedModelId || "";
  els.modelSelect.innerHTML = "";

  if (!state.models.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No profiles available";
    els.modelSelect.append(option);
    return;
  }

  for (const model of state.models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = `${model.name} ${model.handle || ""}`.trim();
    option.selected = model.id === selectedModelId;
    els.modelSelect.append(option);
  }
}

function renderSafety(state) {
  document.querySelectorAll(".segmented").forEach((group) => {
    const kind = group.dataset.kind;
    const activeValue = state.safety?.[kind] || "sfw";

    group.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === activeValue);
    });
  });
}

function renderPluginPower(state) {
  const enabled = state.enabled !== false;
  els.pluginToggle.classList.toggle("is-on", enabled);
  els.pluginToggle.setAttribute("aria-pressed", String(enabled));
  els.pluginToggleLabel.textContent = enabled ? "On" : "Off";
  els.pluginPowerTitle.textContent = enabled ? "Always On" : "Paused";
  els.pluginPowerCopy.textContent = enabled
    ? "The capture button appears on supported media pages."
    : "The capture button is hidden on every page until you turn it back on.";
}

function renderCollapsedSections(state) {
  const collapsedSections = state.ui?.collapsedSections || {};

  document.querySelectorAll(".collapsible").forEach((card) => {
    const sectionId = card.dataset.section;
    const collapsed = Boolean(sectionId && collapsedSections[sectionId]);
    card.classList.toggle("collapsed", collapsed);
    card.querySelector(".section-toggle")?.setAttribute("aria-expanded", String(!collapsed));
  });
}

function renderWorkflowControls(state, model) {
  const workflowOptions = buildWorkflowOptions(model);
  const selectedWorkflowId = selectValue(state.workflow?.selectedWorkflowId, workflowOptions.map((option) => option.id), "default-platform");
  renderSelectOptions(els.workflowSelect, workflowOptions.map((option) => option.id), selectedWorkflowId, (value) => workflowOptions.find((option) => option.id === value)?.label || value);
  els.runTargetSelect.value = state.workflow?.runTarget || "captured";
}

function renderGenerationControls(state, model) {
  const config = state.config || {};
  const imageModelOptions = allowedModelOptions(model, state.safety?.image === "nsfw" ? IMAGE_NSFW_MODELS : IMAGE_MODELS);
  const videoModelOptions = allowedModelOptions(model, state.safety?.video === "nsfw" ? VIDEO_NSFW_MODELS : VIDEO_MODELS);
  const audioModelOptions = allowedModelOptions(model, VOICE_MODELS);
  const imageLayout = selectValue(config.imageLayout, ["DEFAULT", "POSE_MULTIPLIER", "FACE_SWAP"], "DEFAULT");
  const imageModel = selectValue(config.imageModel, imageModelOptions, imageModelOptions[0] || "nb_pro");
  const videoModel = selectValue(config.videoModel, videoModelOptions, videoModelOptions[0] || "sd_2_0");
  const imageResolutionOptions = getAllowedResolutions(imageModel);
  const videoResolutionOptions = getAllowedResolutions(videoModel);
  const imageAspectOptions = getAspectOptions(imageModel, imageLayout);
  const imageQualityOptions = getQualityOptions(imageModel);
  const quantityOptions = imageLayout === "DEFAULT"
    ? Array.from({ length: imageModel === "sdxl" ? 20 : 4 }, (_, index) => index + 1)
    : [1];
  const videoDurationOptions = getVideoDurations(videoModel);

  els.imageLayoutSelect.value = imageLayout;
  renderSelectOptions(els.imageModelSelect, imageModelOptions, imageModel);
  renderSelectOptions(
    els.imageQualitySelect,
    imageQualityOptions,
    selectValue(config.imageQuality, imageQualityOptions, "medium"),
    (value) => QUALITY_LABELS[value] || value,
  );
  renderResolutionOptions(els.imageResolutionSelect, imageResolutionOptions, config.imageResolution);
  renderSelectOptions(els.imageAspectRatioSelect, imageAspectOptions, selectValue(config.imageAspectRatio, imageAspectOptions));
  renderSelectOptions(els.imageQuantitySelect, quantityOptions, selectValue(Number(config.imageQuantity), quantityOptions, 1), (value) => String(value));
  renderSelectOptions(els.videoModelSelect, videoModelOptions, videoModel);
  renderResolutionOptions(els.videoResolutionSelect, videoResolutionOptions, config.videoResolution);

  if (videoDurationOptions.length) {
    renderSelectOptions(els.videoDurationSelect, videoDurationOptions, selectValue(Number(config.videoDurationSeconds), videoDurationOptions), (value) => `${value}s`);
  } else {
    renderSelectOptions(els.videoDurationSelect, ["auto"], "auto", () => "Auto");
  }

  renderAudioModelOptions(audioModelOptions, config.audioModel);
  renderAvailability(state);
}

function renderAvailability(state) {
  const imageLayout = state.config?.imageLayout || "DEFAULT";
  const imageResolutionOptions = getAllowedResolutions(state.config?.imageModel || "nb_pro");
  const videoResolutionOptions = getAllowedResolutions(state.config?.videoModel || "sd_2_0");
  const videoDurations = getVideoDurations(state.config?.videoModel || "sd_2_0");
  const qualityOptions = getQualityOptions(state.config?.imageModel || "nb_pro");

  els.imageAspectRatioSelect.disabled = imageLayout === "POSE_MULTIPLIER";
  els.imageResolutionSelect.disabled = imageResolutionOptions.length === 0;
  els.imageQuantitySelect.disabled = imageLayout !== "DEFAULT";
  els.imageQualitySelect.disabled = qualityOptions.length <= 1;
  els.videoResolutionSelect.disabled = videoResolutionOptions.length === 0;
  els.videoDurationSelect.disabled = videoDurations.length === 0;
  els.audioModelSelect.disabled = VOICE_MODELS.length === 0;
}

function renderState(state) {
  currentState = state;
  const signedIn = Boolean(state.user);
  const model = selectedModel(state);

  renderPluginPower(state);
  renderCollapsedSections(state);
  els.loginPanel.classList.toggle("hidden", signedIn);
  els.workspacePanel.classList.toggle("hidden", !signedIn);
  els.authStatus.textContent = state.enabled === false ? "Paused" : signedIn ? "Online" : "Offline";
  els.authStatus.classList.toggle("online", signedIn);
  els.authStatus.classList.toggle("paused", state.enabled === false);
  els.serverUrl.value = state.serverUrl || "http://localhost:4000";

  if (!signedIn) {
    return;
  }

  els.userLabel.textContent = state.user?.email || state.user?.name || "AutoScale user";
  renderModels(state);
  renderSafety(state);
  renderWorkflowControls(state, model);
  renderGenerationControls(state, model);

  els.imageCount.textContent = String(state.sessionCounts?.image || 0);
  els.videoCount.textContent = String(state.sessionCounts?.video || 0);
  els.audioCount.textContent = String(state.sessionCounts?.audio || 0);
  els.runButton.disabled = !state.touchedBoardIds?.length && (state.workflow?.runTarget || "captured") === "captured";
}

async function loadState() {
  try {
    const response = await sendMessage("AUTOSCALE_GET_STATE");
    if (!response?.ok) {
      throw new Error(response?.error || "Unable to load plugin state");
    }
    renderState(response.state);
    showMessage(response.state.lastMessage || "");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Unable to load plugin state", "error");
  }
}

async function loginWithCurrentFields(statusMessage = "Signing in...") {
  setBusy(true);
  showMessage(statusMessage);

  try {
    const response = await sendMessage("AUTOSCALE_LOGIN", {
      serverUrl: els.serverUrl.value,
      email: els.email.value,
      password: els.password.value,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Login failed");
    }
    els.password.value = "";
    renderState(response.state);
    showMessage("Signed in. Choose a profile, then capture assets from the page.", "ok");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Login failed", "error");
  } finally {
    setBusy(false);
  }
}

async function updateConfig(payload, message) {
  const response = await sendMessage("AUTOSCALE_SET_CONFIG", payload);
  if (response?.ok) {
    renderState(response.state);
    if (message) {
      showMessage(message, "ok");
    }
    return;
  }

  showMessage(response?.error || "Unable to update plugin settings", "error");
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loginWithCurrentFields();
});

els.pluginToggle.addEventListener("click", async () => {
  const enabled = currentState?.enabled !== false;
  await updateConfig(
    { enabled: !enabled },
    !enabled ? "AutoScale capture robot is always on." : "AutoScale capture robot is paused.",
  );
});

document.querySelectorAll(".section-toggle").forEach((button) => {
  button.addEventListener("click", async () => {
    const card = button.closest(".collapsible");
    const sectionId = card?.dataset.section;
    if (!sectionId) {
      return;
    }

    const collapsedSections = currentState?.ui?.collapsedSections || {};
    await updateConfig({
      ui: {
        collapsedSections: {
          ...collapsedSections,
          [sectionId]: !collapsedSections[sectionId],
        },
      },
    });
  });
});

els.defaultAdminButton.addEventListener("click", async () => {
  els.serverUrl.value = els.serverUrl.value || "http://localhost:4000";
  els.email.value = DEFAULT_ADMIN_EMAIL;
  els.password.value = DEFAULT_ADMIN_PASSWORD;
  await loginWithCurrentFields("Signing in as default admin...");
});

els.logoutButton.addEventListener("click", async () => {
  setBusy(true);
  try {
    const response = await sendMessage("AUTOSCALE_LOGOUT");
    if (!response?.ok) {
      throw new Error(response?.error || "Logout failed");
    }
    renderState(response.state);
    showMessage("Logged out.", "ok");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Logout failed", "error");
  } finally {
    setBusy(false);
  }
});

els.modelSelect.addEventListener("change", async () => {
  const modelId = els.modelSelect.value;
  const response = await sendMessage("AUTOSCALE_SET_MODEL", { modelId });
  if (response?.ok) {
    renderState(response.state);
    showMessage("Profile selected.", "ok");
  } else {
    showMessage(response?.error || "Unable to select profile", "error");
  }
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", async () => {
    const group = button.closest(".segmented");
    const kind = group?.dataset.kind;
    const value = button.dataset.value;

    if (!kind || !value) {
      return;
    }

    await updateConfig({ safety: { [kind]: value } }, `${kind === "image" ? "Image" : "Video"} routing set to ${value.toUpperCase()}.`);
  });
});

els.workflowSelect.addEventListener("change", () =>
  updateConfig({ workflow: { selectedWorkflowId: els.workflowSelect.value } }, "Workflow selected."),
);

els.runTargetSelect.addEventListener("change", () =>
  updateConfig({ workflow: { runTarget: els.runTargetSelect.value } }, "Run target selected."),
);

els.imageLayoutSelect.addEventListener("change", () =>
  updateConfig({ config: { imageLayout: els.imageLayoutSelect.value } }, "Image layout updated."),
);

els.imageModelSelect.addEventListener("change", () =>
  updateConfig({ config: { imageModel: els.imageModelSelect.value } }, "Image model updated."),
);

els.imageQualitySelect.addEventListener("change", () =>
  updateConfig({ config: { imageQuality: els.imageQualitySelect.value } }, "Image quality updated."),
);

els.imageResolutionSelect.addEventListener("change", () =>
  els.imageResolutionSelect.value === NO_RESOLUTION_OPTION
    ? undefined
    : updateConfig({ config: { imageResolution: els.imageResolutionSelect.value } }, "Image resolution updated."),
);

els.imageAspectRatioSelect.addEventListener("change", () =>
  updateConfig({ config: { imageAspectRatio: els.imageAspectRatioSelect.value } }, "Image aspect updated."),
);

els.imageQuantitySelect.addEventListener("change", () =>
  updateConfig({ config: { imageQuantity: Number(els.imageQuantitySelect.value) } }, "Image quantity updated."),
);

els.videoModelSelect.addEventListener("change", () =>
  updateConfig({ config: { videoModel: els.videoModelSelect.value } }, "Video model updated."),
);

els.videoResolutionSelect.addEventListener("change", () =>
  els.videoResolutionSelect.value === NO_RESOLUTION_OPTION
    ? undefined
    : updateConfig({ config: { videoResolution: els.videoResolutionSelect.value } }, "Video resolution updated."),
);

els.videoDurationSelect.addEventListener("change", () => {
  if (els.videoDurationSelect.value !== "auto") {
    void updateConfig({ config: { videoDurationSeconds: Number(els.videoDurationSelect.value) } }, "Video duration updated.");
  }
});

els.audioModelSelect.addEventListener("change", () =>
  els.audioModelSelect.value === NO_AUDIO_MODEL_OPTION
    ? undefined
    : updateConfig({ config: { audioModel: els.audioModelSelect.value } }, "Audio model updated."),
);

els.refreshButton.addEventListener("click", async () => {
  setBusy(true);
  showMessage("Refreshing profiles...");
  try {
    const response = await sendMessage("AUTOSCALE_REFRESH_MODELS");
    if (!response?.ok) {
      throw new Error(response?.error || "Refresh failed");
    }
    renderState(response.state);
    showMessage("Profiles refreshed.", "ok");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Refresh failed", "error");
  } finally {
    setBusy(false);
  }
});

els.runButton.addEventListener("click", async () => {
  setBusy(true);
  showMessage("Starting workflow...");
  try {
    const response = await sendMessage("AUTOSCALE_RUN_WORKFLOW", {
      workflow: {
        selectedWorkflowId: els.workflowSelect.value,
        runTarget: els.runTargetSelect.value,
      },
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Run workflow failed");
    }
    renderState(response.state);
    showMessage(response.message || "Workflow started.", "ok");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Run workflow failed", "error");
  } finally {
    setBusy(false);
  }
});

document.addEventListener("DOMContentLoaded", loadState);

loadState();
