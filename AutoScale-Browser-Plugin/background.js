const STORAGE_KEY = "autoscaleRobotState";
const MAX_BOARD_ROWS = 8;

const IMAGE_MODELS = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2", "sdxl"];
const IMAGE_NSFW_MODELS = ["sd_4_5", "sdxl"];
const VIDEO_MODELS = ["sd_2_0", "sd_2_0_fast", "kling_3_0", "kling_motion_control", "grok_imagine"];
const VIDEO_NSFW_MODELS = ["sd_2_0", "sd_2_0_fast", "grok_imagine"];
const VOICE_MODELS = ["eleven_v3"];
const POSE_MODELS = ["nb_pro", "nb2", "sd_4_5", "kling_o1", "gpt_2"];
const RESOLUTIONS = ["480p", "720p", "1080p", "1k", "2k", "4k"];
const ASPECT_RATIOS = ["auto", "1:1", "16:9", "9:16", "3:4", "4:3", "2:3", "3:2", "5:4", "4:5", "21:9"];

const MODE_PREFIXES = {
  "image-nsfw": "__autoscale_workspace_nsfw__:",
  playground: "__autoscale_workspace_playground__:",
  "video-sfw": "__autoscale_workspace_video_sfw__:",
  "video-nsfw": "__autoscale_workspace_video_nsfw__:",
  "voice-sfw": "__autoscale_workspace_voice_sfw__:",
  "voice-nsfw": "__autoscale_workspace_voice_nsfw__:",
};

const MODE_MODEL_OPTIONS = {
  "image-sfw": IMAGE_MODELS,
  "image-nsfw": IMAGE_NSFW_MODELS,
  "video-sfw": VIDEO_MODELS,
  "video-nsfw": VIDEO_NSFW_MODELS,
  "voice-sfw": VOICE_MODELS,
  "voice-nsfw": VOICE_MODELS,
};

const DEFAULT_STATE = {
  serverUrl: "http://localhost:4000",
  csrfToken: null,
  user: null,
  models: [],
  selectedModelId: null,
  safety: {
    image: "sfw",
    video: "sfw",
  },
  sessionCounts: {
    image: 0,
    video: 0,
    audio: 0,
  },
  touchedBoardIds: [],
  lastMessage: "",
};

const REFERENCE_FIELDS = `
  id
  slotIndex
  label
  sourceType
  assetId
  assetUrl
  uploadPath
  uploadUrl
`;

const SETTINGS_FIELDS = `
  generationModel
  resolution
  poseMultiplierResolution
  videoDurationSeconds
  quality
  aspectRatio
  quantity
  sdxlWorkspaceMode
  poseMultiplierEnabled
  poseMultiplier
  poseMultiplierGenerationModel
  upscale
  upscaleFactor
  upscaleDenoise
  faceSwap
  faceSwapModelStrength
  autoPromptGen
  autoPromptImage
  posePromptMode
  posePromptTemplate
  posePromptTemplates
  globalReferences {
    ${REFERENCE_FIELDS}
  }
`;

const MODELS_QUERY = `
  query PluginInfluencerModels {
    influencerModels {
      id
      slug
      name
      handle
      allowedGenerationModels
      boards {
        id
        name
        updatedAt
        settings {
          ${SETTINGS_FIELDS}
        }
        rows {
          id
          orderIndex
          prompt
          reference {
            ${REFERENCE_FIELDS}
          }
          audioReference {
            ${REFERENCE_FIELDS}
          }
        }
      }
    }
  }
`;

const BOARD_DETAIL_QUERY = `
  query PluginWorkspaceBoard($boardId: ID!) {
    workspaceBoard(boardId: $boardId) {
      id
      influencerModelId
      name
      updatedAt
      settings {
        ${SETTINGS_FIELDS}
      }
      rows {
        id
        orderIndex
        prompt
        reference {
          ${REFERENCE_FIELDS}
        }
        audioReference {
          ${REFERENCE_FIELDS}
        }
      }
    }
  }
`;

const LOGIN_MUTATION = `
  mutation PluginLogin($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      csrfToken
      user {
        id
        email
        name
        role
      }
    }
  }
`;

const LOGOUT_MUTATION = `
  mutation PluginLogout {
    logout
  }
`;

const CREATE_BOARD_MUTATION = `
  mutation PluginCreateBoard($influencerModelId: ID!, $name: String, $sourceBoardId: ID) {
    createBoard(influencerModelId: $influencerModelId, name: $name, sourceBoardId: $sourceBoardId) {
      id
      name
      updatedAt
    }
  }
`;

const ADD_ROW_MUTATION = `
  mutation PluginAddBoardRow($boardId: ID!) {
    addBoardRow(boardId: $boardId) {
      id
      updatedAt
    }
  }
`;

const UPDATE_ROW_MUTATION = `
  mutation PluginUpdateBoardRow($input: UpdateBoardRowInput!) {
    updateBoardRow(input: $input) {
      id
      updatedAt
    }
  }
`;

const UPDATE_SETTINGS_MUTATION = `
  mutation PluginUpdateBoardSettings($boardId: ID!, $input: BoardSettingsInput!) {
    updateBoardSettings(boardId: $boardId, input: $input) {
      id
      updatedAt
    }
  }
`;

const RUN_BOARD_MUTATION = `
  mutation PluginRunBoard($boardId: ID!) {
    runBoard(boardId: $boardId) {
      id
      updatedAt
    }
  }
`;

function storageGet(key) {
  return chrome.storage.local.get(key);
}

function storageSet(value) {
  return chrome.storage.local.set(value);
}

function mergeState(value = {}) {
  return {
    ...DEFAULT_STATE,
    ...value,
    safety: { ...DEFAULT_STATE.safety, ...(value.safety || {}) },
    sessionCounts: { ...DEFAULT_STATE.sessionCounts, ...(value.sessionCounts || {}) },
    touchedBoardIds: Array.isArray(value.touchedBoardIds) ? value.touchedBoardIds : [],
    models: Array.isArray(value.models) ? value.models : [],
  };
}

async function loadState() {
  const result = await storageGet(STORAGE_KEY);
  return mergeState(result[STORAGE_KEY]);
}

async function saveState(nextState) {
  const state = mergeState(nextState);
  await storageSet({ [STORAGE_KEY]: state });
  updateBadge(state);
  return state;
}

function updateBadge(state) {
  const total = (state.sessionCounts.image || 0) + (state.sessionCounts.video || 0) + (state.sessionCounts.audio || 0);
  chrome.action.setBadgeBackgroundColor({ color: "#bef264" });
  chrome.action.setBadgeTextColor?.({ color: "#111111" });
  chrome.action.setBadgeText({ text: total > 0 ? String(Math.min(total, 99)) : "" });
}

function normalizeServerUrl(serverUrl) {
  const raw = String(serverUrl || DEFAULT_STATE.serverUrl).trim() || DEFAULT_STATE.serverUrl;
  return raw.replace(/\/+$/, "");
}

async function graphqlRequest(query, variables = {}, options = {}) {
  const state = await loadState();
  const serverUrl = normalizeServerUrl(options.serverUrl || state.serverUrl);
  const headers = {
    "content-type": "application/json",
  };

  if (!options.skipCsrf && state.csrfToken) {
    headers["x-csrf-token"] = state.csrfToken;
  }

  const response = await fetch(`${serverUrl}/graphql`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const rawPayload = await response.text();
  let payload;
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    payload = { errors: [{ message: rawPayload || `AutoScale request failed with ${response.status}` }] };
  }

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `AutoScale request failed with ${response.status}`);
  }

  return payload.data;
}

async function refreshModels(currentState = null) {
  const state = currentState || (await loadState());
  const data = await graphqlRequest(MODELS_QUERY);
  const models = data.influencerModels || [];
  const selectedModelStillAvailable = models.some((model) => model.id === state.selectedModelId);
  const selectedModelId = selectedModelStillAvailable ? state.selectedModelId : models[0]?.id || null;
  return saveState({ ...state, models, selectedModelId });
}

function resolveBoardMode(board) {
  for (const [mode, prefix] of Object.entries(MODE_PREFIXES)) {
    if (board.name?.startsWith(prefix)) {
      return mode;
    }
  }
  return "image-sfw";
}

function tableNumber(board) {
  const match = String(board.name || "").match(/Table\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function boardsForMode(model, mode) {
  return [...(model?.boards || [])]
    .filter((board) => resolveBoardMode(board) === mode)
    .sort((left, right) => tableNumber(left) - tableNumber(right) || String(left.updatedAt).localeCompare(String(right.updatedAt)));
}

function buildBoardNameForMode(mode, index) {
  const label = `Table ${index}`;
  const prefix = MODE_PREFIXES[mode];
  return prefix ? `${prefix}${label}` : label;
}

function modeForAssetKind(kind, safety) {
  if (kind === "audio") {
    return "voice-sfw";
  }

  if (kind === "video") {
    return `video-${safety.video === "nsfw" ? "nsfw" : "sfw"}`;
  }

  return `image-${safety.image === "nsfw" ? "nsfw" : "sfw"}`;
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

function normalizeResolution(generationModel, value) {
  const allowed = getAllowedResolutions(generationModel);
  if (allowed.includes(value)) return value;
  const requestedIndex = RESOLUTIONS.indexOf(value);
  if (requestedIndex !== -1) {
    const upgraded = allowed.find((option) => RESOLUTIONS.indexOf(option) >= requestedIndex);
    if (upgraded) return upgraded;
  }
  return allowed[allowed.length - 1] || "1k";
}

function normalizePoseResolution(value, generationModel) {
  const allowed = generationModel === "sdxl" ? ["2k", "4k"] : getAllowedResolutions(generationModel);
  if (allowed.includes(value)) return value;
  return allowed[allowed.length - 1] || "2k";
}

function normalizeQuality(generationModel, value) {
  if (generationModel === "gpt_2" && ["low", "medium", "high"].includes(value)) {
    return value;
  }
  return "medium";
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

function normalizeVideoDuration(generationModel, value) {
  const allowed = getVideoDurations(generationModel);
  if (!allowed.length) return null;
  return allowed.includes(value) ? value : allowed[0];
}

function isImageModel(generationModel) {
  return IMAGE_MODELS.includes(generationModel);
}

function isVideoModel(generationModel) {
  return VIDEO_MODELS.includes(generationModel);
}

function isPoseWorkspace(generationModel, sdxlWorkspaceMode) {
  return isImageModel(generationModel) && sdxlWorkspaceMode === "POSE_MULTIPLIER";
}

function normalizeAspectRatio(generationModel, value, sdxlWorkspaceMode) {
  if (generationModel === "kling_motion_control" || isPoseWorkspace(generationModel, sdxlWorkspaceMode)) {
    return "auto";
  }

  if (generationModel === "sdxl" && value === "auto") {
    return "1:1";
  }

  return ASPECT_RATIOS.includes(value) ? value : "1:1";
}

function getMaxQuantity(generationModel) {
  if (isVideoModel(generationModel)) return 1;
  return generationModel === "sdxl" ? 20 : 4;
}

function selectGenerationModel(mode, allowedGenerationModels = [], currentGenerationModel = "") {
  const options = MODE_MODEL_OPTIONS[mode] || IMAGE_MODELS;
  const allowed = allowedGenerationModels.length ? allowedGenerationModels : options;
  return options.find((option) => allowed.includes(option)) || (allowed.includes(currentGenerationModel) ? currentGenerationModel : options[0]);
}

function referenceInput(reference) {
  return {
    id: reference.id,
    slotIndex: reference.slotIndex,
    label: reference.label,
    sourceType: reference.sourceType,
    assetId: reference.assetId || null,
    assetUrl: reference.assetUrl || null,
    uploadPath: reference.uploadPath || null,
    uploadUrl: reference.uploadUrl || null,
  };
}

function settingsInput(settings) {
  return {
    generationModel: settings.generationModel,
    resolution: settings.resolution,
    poseMultiplierResolution: settings.poseMultiplierResolution,
    videoDurationSeconds: settings.videoDurationSeconds,
    quality: settings.quality,
    aspectRatio: settings.aspectRatio,
    quantity: settings.quantity,
    sdxlWorkspaceMode: settings.sdxlWorkspaceMode,
    poseMultiplierEnabled: settings.poseMultiplierEnabled,
    poseMultiplier: settings.poseMultiplier,
    poseMultiplierGenerationModel: settings.poseMultiplierGenerationModel,
    upscale: settings.upscale,
    upscaleFactor: settings.upscaleFactor,
    upscaleDenoise: settings.upscaleDenoise,
    faceSwap: settings.faceSwap,
    faceSwapModelStrength: settings.faceSwapModelStrength,
    autoPromptGen: settings.autoPromptGen,
    autoPromptImage: settings.autoPromptImage,
    posePromptMode: settings.posePromptMode,
    posePromptTemplate: settings.posePromptTemplate,
    posePromptTemplates: settings.posePromptTemplates,
    globalReferences: (settings.globalReferences || []).map(referenceInput),
  };
}

function normalizeSettingsForMode(settings, mode, allowedGenerationModels) {
  const generationModel = selectGenerationModel(mode, allowedGenerationModels, settings.generationModel);
  const sdxlWorkspaceMode = isImageModel(generationModel) ? settings.sdxlWorkspaceMode || "DEFAULT" : "DEFAULT";
  const isPoseLayout = isPoseWorkspace(generationModel, sdxlWorkspaceMode);
  const isFaceSwapLayout = sdxlWorkspaceMode === "FACE_SWAP";
  const isSdxlDefault = generationModel === "sdxl" && !isPoseLayout && !isFaceSwapLayout;
  const poseMultiplierGenerationModel = POSE_MODELS.includes(settings.poseMultiplierGenerationModel)
    ? settings.poseMultiplierGenerationModel
    : POSE_MODELS.includes(generationModel)
      ? generationModel
      : POSE_MODELS[0];
  const quantity = isPoseLayout || isFaceSwapLayout ? 1 : Math.max(1, Math.min(getMaxQuantity(generationModel), settings.quantity || 1));

  return {
    ...settings,
    generationModel,
    resolution: normalizeResolution(generationModel, settings.resolution),
    poseMultiplierResolution: normalizePoseResolution(settings.poseMultiplierResolution || settings.resolution, poseMultiplierGenerationModel),
    videoDurationSeconds: normalizeVideoDuration(generationModel, settings.videoDurationSeconds),
    quality: normalizeQuality(generationModel, settings.quality),
    aspectRatio: normalizeAspectRatio(generationModel, settings.aspectRatio, sdxlWorkspaceMode),
    quantity: generationModel === "eleven_v3" ? 1 : quantity,
    sdxlWorkspaceMode,
    poseMultiplierEnabled: isPoseLayout ? true : isSdxlDefault ? false : quantity === 1 ? Boolean(settings.poseMultiplierEnabled) : false,
    poseMultiplier: Math.max(1, Math.min(4, settings.poseMultiplier || 1)),
    poseMultiplierGenerationModel,
    upscale: isSdxlDefault ? Boolean(settings.upscale) : false,
    upscaleFactor: [1, 1.5, 2].includes(settings.upscaleFactor) ? settings.upscaleFactor : 1,
    upscaleDenoise: Math.max(0, Math.min(0.4, settings.upscaleDenoise || 0)),
    faceSwap: isFaceSwapLayout ? true : Boolean(settings.faceSwap),
    faceSwapModelStrength: Math.max(0.3, Math.min(0.6, settings.faceSwapModelStrength || 0.5)),
    autoPromptGen: isFaceSwapLayout ? false : mode.startsWith("voice-") ? false : Boolean(settings.autoPromptGen),
    autoPromptImage: isPoseLayout || isFaceSwapLayout || mode.startsWith("voice-") ? false : Boolean(settings.autoPromptImage),
    posePromptMode: settings.posePromptMode === "CUSTOM" ? "CUSTOM" : "AUTO",
    posePromptTemplate: settings.posePromptTemplate || "Keep the same framing and styling while varying the body pose for each multiplied shot.",
    posePromptTemplates: settings.posePromptTemplates?.length
      ? settings.posePromptTemplates.slice(0, 4)
      : Array.from({ length: 4 }, () => "Keep the same framing and styling while varying the body pose for each multiplied shot."),
    globalReferences: settings.globalReferences || [],
  };
}

function settingsChanged(left, right) {
  return JSON.stringify(settingsInput(left)) !== JSON.stringify(settingsInput(right));
}

async function getBoard(boardId) {
  const data = await graphqlRequest(BOARD_DETAIL_QUERY, { boardId });
  if (!data.workspaceBoard) {
    throw new Error("Workspace table was not found");
  }
  return data.workspaceBoard;
}

async function ensureBoardSettings(board, mode, model) {
  const normalized = normalizeSettingsForMode(board.settings, mode, model.allowedGenerationModels || []);
  if (!settingsChanged(board.settings, normalized)) {
    return board;
  }

  await graphqlRequest(UPDATE_SETTINGS_MUTATION, {
    boardId: board.id,
    input: settingsInput(normalized),
  });
  return getBoard(board.id);
}

function rowHasReference(row, kind) {
  if (kind === "audio") {
    return Boolean(row.audioReference?.uploadPath || row.audioReference?.assetId || row.reference?.uploadPath || row.reference?.assetId);
  }

  return Boolean(row.reference?.uploadPath || row.reference?.assetId);
}

async function prepareTargetBoard(kind, mode, state) {
  let model = state.models.find((entry) => entry.id === state.selectedModelId);
  if (!model) {
    const refreshed = await refreshModels(state);
    model = refreshed.models.find((entry) => entry.id === refreshed.selectedModelId);
  }

  if (!model) {
    throw new Error("Select an influencer profile in the AutoScale plugin first");
  }

  const modeBoards = boardsForMode(model, mode);

  for (const boardSummary of modeBoards) {
    let board = await ensureBoardSettings(await getBoard(boardSummary.id), mode, model);
    const rows = [...board.rows].sort((left, right) => left.orderIndex - right.orderIndex);
    const emptyRow = rows.find((row) => !rowHasReference(row, kind));
    if (emptyRow) {
      return { model, board, row: emptyRow };
    }

    if (rows.length < MAX_BOARD_ROWS) {
      await graphqlRequest(ADD_ROW_MUTATION, { boardId: board.id });
      board = await getBoard(board.id);
      const nextRows = [...board.rows].sort((left, right) => left.orderIndex - right.orderIndex);
      const nextEmptyRow = nextRows.find((row) => !rowHasReference(row, kind));
      if (nextEmptyRow) {
        return { model, board, row: nextEmptyRow };
      }
    }
  }

  const sourceBoardId = modeBoards[modeBoards.length - 1]?.id;
  const data = await graphqlRequest(CREATE_BOARD_MUTATION, {
    influencerModelId: model.id,
    name: buildBoardNameForMode(mode, modeBoards.length + 1),
    sourceBoardId,
  });
  const createdBoard = await ensureBoardSettings(await getBoard(data.createBoard.id), mode, model);
  const row = [...createdBoard.rows].sort((left, right) => left.orderIndex - right.orderIndex)[0];

  if (!row) {
    throw new Error("New AutoScale table did not contain any rows");
  }

  return { model, board: createdBoard, row };
}

function filenameFromAsset(asset, blobType = "") {
  const extensionByType = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
  };
  const urlName = (() => {
    try {
      return decodeURIComponent(new URL(asset.url).pathname.split("/").filter(Boolean).pop() || "");
    } catch {
      return "";
    }
  })();
  const cleanLabel = String(asset.label || asset.pageTitle || asset.kind || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);
  const extension = extensionByType[blobType] || extensionByType[asset.mimeHint] || urlName.match(/\.([a-z0-9]{2,5})$/i)?.[1] || "bin";
  const baseName = urlName && /\.[a-z0-9]{2,5}$/i.test(urlName) ? urlName.replace(/\.[a-z0-9]{2,5}$/i, "") : cleanLabel || "autoscale-asset";
  return `${baseName.slice(0, 54)}.${extension}`;
}

async function uploadAsset(asset, state) {
  if (!/^https?:|^data:/i.test(asset.url)) {
    throw new Error("This site did not expose a downloadable media URL for the selected asset");
  }

  const response = await fetch(asset.url, {
    credentials: "include",
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Unable to download selected asset (${response.status})`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("The selected asset download was empty");
  }

  const formData = new FormData();
  formData.append("file", blob, filenameFromAsset(asset, blob.type));

  const uploadResponse = await fetch(`${normalizeServerUrl(state.serverUrl)}/api/uploads`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!uploadResponse.ok) {
    const message = await uploadResponse.text();
    throw new Error(message || `AutoScale upload failed with ${uploadResponse.status}`);
  }

  return uploadResponse.json();
}

function buildUploadReference(asset, upload, slotIndex = 0) {
  return {
    id: `plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    slotIndex,
    label: asset.label || upload.fileName || `${asset.kind} asset`,
    sourceType: "UPLOAD",
    assetId: null,
    assetUrl: null,
    uploadPath: upload.filePath,
    uploadUrl: upload.url,
  };
}

function buildDefaultPrompt(asset) {
  const pageLabel = asset.pageTitle || asset.label || "the captured source";

  if (asset.kind === "audio") {
    return `Use this audio reference from "${pageLabel}" for the selected influencer voice workflow.`;
  }

  if (asset.kind === "video") {
    return `Use this video reference from "${pageLabel}" as the source motion and style reference for the selected influencer workflow.`;
  }

  return `Use this image reference from "${pageLabel}" as the source visual reference for the selected influencer workflow.`;
}

async function captureAsset(rawAsset) {
  const state = await loadState();
  const asset = {
    ...rawAsset,
    kind: rawAsset.kind === "video" || rawAsset.kind === "audio" ? rawAsset.kind : "image",
  };

  if (!state.user || !state.selectedModelId) {
    throw new Error("Log in and select an influencer profile in the AutoScale plugin first");
  }

  const mode = modeForAssetKind(asset.kind, state.safety);
  const upload = await uploadAsset(asset, state);
  const reference = buildUploadReference(asset, upload);
  const { board, row } = await prepareTargetBoard(asset.kind, mode, state);
  const input = {
    boardId: board.id,
    rowId: row.id,
    prompt: row.prompt?.trim() ? row.prompt : buildDefaultPrompt(asset),
  };

  if (asset.kind === "audio") {
    input.reference = reference;
    input.audioReference = reference;
  } else {
    input.reference = reference;
  }

  await graphqlRequest(UPDATE_ROW_MUTATION, { input });
  const nextState = await refreshModels({
    ...state,
    touchedBoardIds: Array.from(new Set([...state.touchedBoardIds, board.id])),
    sessionCounts: {
      ...state.sessionCounts,
      [asset.kind]: (state.sessionCounts[asset.kind] || 0) + 1,
    },
    lastMessage: `${asset.kind[0].toUpperCase()}${asset.kind.slice(1)} added to ${board.name.replace(/^__autoscale_workspace_[^:]+__:/, "")}, row ${
      row.orderIndex + 1
    }.`,
  });

  return {
    state: nextState,
    message: nextState.lastMessage,
  };
}

async function handleLogin(payload) {
  const serverUrl = normalizeServerUrl(payload.serverUrl);
  const state = await saveState({
    ...DEFAULT_STATE,
    serverUrl,
  });
  const data = await graphqlRequest(
    LOGIN_MUTATION,
    {
      email: payload.email,
      password: payload.password,
    },
    { skipCsrf: true, serverUrl },
  );
  return refreshModels({
    ...state,
    csrfToken: data.login.csrfToken,
    user: data.login.user,
    lastMessage: "Signed in.",
  });
}

async function handleLogout() {
  const state = await loadState();
  try {
    await graphqlRequest(LOGOUT_MUTATION);
  } catch {
    // Clearing local plugin state is still useful if the server session is gone.
  }
  return saveState({
    ...DEFAULT_STATE,
    serverUrl: state.serverUrl,
  });
}

async function runWorkflow() {
  const state = await loadState();
  const boardIds = [...new Set(state.touchedBoardIds || [])];

  if (!boardIds.length) {
    throw new Error("Capture at least one asset before running a workflow");
  }

  for (const boardId of boardIds) {
    await graphqlRequest(RUN_BOARD_MUTATION, { boardId });
  }

  const nextState = await refreshModels({
    ...state,
    touchedBoardIds: [],
    sessionCounts: { image: 0, video: 0, audio: 0 },
    lastMessage: `Started ${boardIds.length} workflow${boardIds.length === 1 ? "" : "s"}.`,
  });

  return {
    state: nextState,
    message: nextState.lastMessage,
  };
}

async function handleMessage(message) {
  const type = message?.type;
  const payload = message?.payload || {};

  if (type === "AUTOSCALE_GET_STATE") {
    return { state: await loadState() };
  }

  if (type === "AUTOSCALE_LOGIN") {
    return { state: await handleLogin(payload) };
  }

  if (type === "AUTOSCALE_LOGOUT") {
    return { state: await handleLogout() };
  }

  if (type === "AUTOSCALE_REFRESH_MODELS") {
    return { state: await refreshModels() };
  }

  if (type === "AUTOSCALE_SET_MODEL") {
    const state = await loadState();
    const modelId = payload.modelId || null;
    const selectedModelId = state.models.some((model) => model.id === modelId) ? modelId : state.models[0]?.id || null;
    return { state: await saveState({ ...state, selectedModelId }) };
  }

  if (type === "AUTOSCALE_SET_CONFIG") {
    const state = await loadState();
    return {
      state: await saveState({
        ...state,
        safety: {
          ...state.safety,
          ...(payload.safety || {}),
        },
      }),
    };
  }

  if (type === "AUTOSCALE_CAPTURE_ASSET") {
    return captureAsset(payload.asset);
  }

  if (type === "AUTOSCALE_RUN_WORKFLOW") {
    return runWorkflow();
  }

  throw new Error(`Unknown AutoScale plugin message: ${type}`);
}

chrome.runtime.onInstalled.addListener(async () => {
  updateBadge(await loadState());
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "AutoScale plugin failed" }));
  return true;
});
