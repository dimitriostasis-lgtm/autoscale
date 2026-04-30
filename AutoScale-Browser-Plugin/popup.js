const els = {
  authStatus: document.querySelector("#authStatus"),
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

const IMAGE_MODELS = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2", "sdxl"];
const IMAGE_NSFW_MODELS = ["sd_4_5", "sdxl"];
const VIDEO_MODELS = ["sd_2_0", "sd_2_0_fast", "kling_3_0", "kling_motion_control", "grok_imagine"];
const VIDEO_NSFW_MODELS = ["sd_2_0", "sd_2_0_fast", "grok_imagine"];
const VOICE_MODELS = ["eleven_v3"];
const ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:4", "4:3", "2:3", "3:2", "5:4", "4:5", "21:9"];

const MODEL_LABELS = {
  nb_pro: "NB Pro",
  nb2: "NB2",
  sd_4_5: "SD 4.5",
  kling_o1: "Kling O1",
  gpt_2: "GPT 2",
  sdxl: "SDXL",
  sd_2_0: "SD 2.0",
  sd_2_0_fast: "SD 2.0 Fast",
  kling_3_0: "Kling 3.0",
  kling_motion_control: "Kling Motion",
  grok_imagine: "Grok Imagine",
  eleven_v3: "Eleven v3",
};

const RESOLUTION_LABELS = {
  "480p": "480p",
  "720p": "720p",
  "1080p": "1080p",
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
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
  if (generationModel === "sd_4_5") return ["2k", "4k"];
  if (generationModel === "kling_o1") return ["1k", "2k"];
  if (generationModel === "sd_2_0" || generationModel === "sd_2_0_fast") return ["480p", "720p", "1080p"];
  if (generationModel === "kling_3_0") return ["720p", "1080p", "4k"];
  if (generationModel === "kling_motion_control") return ["720p", "1080p"];
  if (generationModel === "grok_imagine") return ["480p", "720p"];
  return ["1k", "2k", "4k"];
}

function getVideoDurations(generationModel) {
  if (generationModel === "sd_2_0" || generationModel === "sd_2_0_fast") {
    return Array.from({ length: 12 }, (_, index) => index + 4);
  }

  if (generationModel === "kling_3_0" || generationModel === "grok_imagine") {
    return Array.from({ length: 13 }, (_, index) => index + 3);
  }

  return [];
}

function getAspectOptions(generationModel, imageLayout) {
  if (imageLayout === "POSE_MULTIPLIER" || generationModel === "kling_motion_control") {
    return ["auto"];
  }

  return generationModel === "sdxl" ? ASPECT_RATIOS.filter((option) => option !== "auto") : ASPECT_RATIOS;
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
  const audioModel = selectValue(config.audioModel, audioModelOptions, audioModelOptions[0] || "eleven_v3");
  const imageResolutionOptions = getAllowedResolutions(imageModel);
  const videoResolutionOptions = getAllowedResolutions(videoModel);
  const imageAspectOptions = getAspectOptions(imageModel, imageLayout);
  const quantityOptions = imageLayout === "DEFAULT"
    ? Array.from({ length: imageModel === "sdxl" ? 20 : 4 }, (_, index) => index + 1)
    : [1];
  const videoDurationOptions = getVideoDurations(videoModel);

  els.imageLayoutSelect.value = imageLayout;
  renderSelectOptions(els.imageModelSelect, imageModelOptions, imageModel);
  renderSelectOptions(els.imageResolutionSelect, imageResolutionOptions, selectValue(config.imageResolution, imageResolutionOptions));
  renderSelectOptions(els.imageAspectRatioSelect, imageAspectOptions, selectValue(config.imageAspectRatio, imageAspectOptions));
  renderSelectOptions(els.imageQuantitySelect, quantityOptions, selectValue(Number(config.imageQuantity), quantityOptions, 1), (value) => String(value));
  renderSelectOptions(els.videoModelSelect, videoModelOptions, videoModel);
  renderSelectOptions(els.videoResolutionSelect, videoResolutionOptions, selectValue(config.videoResolution, videoResolutionOptions));

  if (videoDurationOptions.length) {
    renderSelectOptions(els.videoDurationSelect, videoDurationOptions, selectValue(Number(config.videoDurationSeconds), videoDurationOptions), (value) => `${value}s`);
  } else {
    renderSelectOptions(els.videoDurationSelect, ["auto"], "auto", () => "Auto");
  }

  renderSelectOptions(els.audioModelSelect, audioModelOptions, audioModel);
  renderAvailability(state);
}

function renderAvailability(state) {
  const imageLayout = state.config?.imageLayout || "DEFAULT";
  const videoDurations = getVideoDurations(state.config?.videoModel || "sd_2_0");

  els.imageAspectRatioSelect.disabled = imageLayout === "POSE_MULTIPLIER";
  els.imageQuantitySelect.disabled = imageLayout !== "DEFAULT";
  els.videoDurationSelect.disabled = videoDurations.length === 0;
}

function renderState(state) {
  currentState = state;
  const signedIn = Boolean(state.user);
  const model = selectedModel(state);

  els.loginPanel.classList.toggle("hidden", signedIn);
  els.workspacePanel.classList.toggle("hidden", !signedIn);
  els.authStatus.textContent = signedIn ? "Online" : "Offline";
  els.authStatus.classList.toggle("online", signedIn);
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
    showMessage(message, "ok");
    return;
  }

  showMessage(response?.error || "Unable to update plugin settings", "error");
}

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loginWithCurrentFields();
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

els.imageResolutionSelect.addEventListener("change", () =>
  updateConfig({ config: { imageResolution: els.imageResolutionSelect.value } }, "Image resolution updated."),
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
  updateConfig({ config: { videoResolution: els.videoResolutionSelect.value } }, "Video resolution updated."),
);

els.videoDurationSelect.addEventListener("change", () => {
  if (els.videoDurationSelect.value !== "auto") {
    void updateConfig({ config: { videoDurationSeconds: Number(els.videoDurationSelect.value) } }, "Video duration updated.");
  }
});

els.audioModelSelect.addEventListener("change", () =>
  updateConfig({ config: { audioModel: els.audioModelSelect.value } }, "Audio model updated."),
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
