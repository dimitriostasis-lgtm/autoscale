const els = {
  authStatus: document.querySelector("#authStatus"),
  loginPanel: document.querySelector("#loginPanel"),
  workspacePanel: document.querySelector("#workspacePanel"),
  loginForm: document.querySelector("#loginForm"),
  serverUrl: document.querySelector("#serverUrl"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  userLabel: document.querySelector("#userLabel"),
  modelSelect: document.querySelector("#modelSelect"),
  imageCount: document.querySelector("#imageCount"),
  videoCount: document.querySelector("#videoCount"),
  audioCount: document.querySelector("#audioCount"),
  refreshButton: document.querySelector("#refreshButton"),
  runButton: document.querySelector("#runButton"),
  message: document.querySelector("#message"),
};

let currentState = null;

function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, payload });
}

function setBusy(isBusy) {
  els.loginButton.disabled = isBusy;
  els.refreshButton.disabled = isBusy;
  els.runButton.disabled = isBusy;
  els.logoutButton.disabled = isBusy;
  els.modelSelect.disabled = isBusy;
}

function showMessage(text, tone = "") {
  els.message.textContent = text || "";
  els.message.className = `message ${tone}`.trim();
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

function renderState(state) {
  currentState = state;
  const signedIn = Boolean(state.user);

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

  els.imageCount.textContent = String(state.sessionCounts?.image || 0);
  els.videoCount.textContent = String(state.sessionCounts?.video || 0);
  els.audioCount.textContent = String(state.sessionCounts?.audio || 0);
  els.runButton.disabled = !state.touchedBoardIds?.length;
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

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  showMessage("Signing in...");

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

    const response = await sendMessage("AUTOSCALE_SET_CONFIG", { safety: { [kind]: value } });
    if (response?.ok) {
      renderState(response.state);
      showMessage(`${kind === "image" ? "Image" : "Video"} routing set to ${value.toUpperCase()}.`, "ok");
    } else {
      showMessage(response?.error || "Unable to update routing", "error");
    }
  });
});

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
  showMessage("Starting workflows...");
  try {
    const response = await sendMessage("AUTOSCALE_RUN_WORKFLOW");
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
