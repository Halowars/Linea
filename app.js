const STORAGE_KEY = "linea-state-v1";
const LEGACY_STORAGE_KEY = "vibewriter-state-v1";

const lookPresets = {
  "mod-circles": {
    background: "mod-circles",
    textColor: "#21181f",
    pageColor: "#fff1d2",
    accentColor: "#ef4f86",
    sidebarColor: "#f6ede7",
    toolbarColor: "#f8efe8",
    controlBubbleColor: "#eee9e5",
    buttonColor: "#ffffff",
    buttonTextColor: "#27242a",
    backgroundOpacity: 72,
  },
  "sunset-waves": {
    background: "sunset-waves",
    textColor: "#352719",
    pageColor: "#fff0c7",
    accentColor: "#e46b47",
    sidebarColor: "#f5ead7",
    toolbarColor: "#f6ecd8",
    controlBubbleColor: "#efe4d5",
    buttonColor: "#fff7ed",
    buttonTextColor: "#352719",
    backgroundOpacity: 66,
  },
  "midnight-dots": {
    background: "midnight-dots",
    textColor: "#f7edd4",
    pageColor: "#082729",
    accentColor: "#b7194c",
    sidebarColor: "#15292c",
    toolbarColor: "#172b30",
    controlBubbleColor: "#1d3034",
    buttonColor: "#f7edd4",
    buttonTextColor: "#172b30",
    backgroundOpacity: 82,
  },
};

const spellingSuggestions = {
  accomodate: "accommodate",
  acheive: "achieve",
  adress: "address",
  alot: "a lot",
  apparant: "apparent",
  arguement: "argument",
  becuase: "because",
  beleive: "believe",
  calender: "calendar",
  cieling: "ceiling",
  definately: "definitely",
  definetely: "definitely",
  embarass: "embarrass",
  enviroment: "environment",
  existance: "existence",
  freind: "friend",
  goverment: "government",
  grammer: "grammar",
  happend: "happened",
  independant: "independent",
  liason: "liaison",
  neccessary: "necessary",
  occassion: "occasion",
  occured: "occurred",
  privilage: "privilege",
  recieve: "receive",
  seperate: "separate",
  suprise: "surprise",
  teh: "the",
  theirselves: "themselves",
  tommorow: "tomorrow",
  wierd: "weird",
  writting: "writing",
  ya: "you",
};

const defaultDraft = () => ({
  id: crypto.randomUUID(),
  title: "Untitled story",
  html: "<p></p>",
  updatedAt: Date.now(),
});

const defaultState = () => {
  const draft = defaultDraft();
  return {
    activeDraftId: draft.id,
    drafts: [draft],
    theme: {
      textColor: "#21181f",
      pageColor: "#fff1d2",
      accentColor: "#ef4f86",
      sidebarColor: "#f6ede7",
      toolbarColor: "#f8efe8",
      controlBubbleColor: "#eee9e5",
      buttonColor: "#ffffff",
      buttonTextColor: "#27242a",
      backgroundOpacity: 72,
      backgroundImage: "",
      backgroundPattern: "mod-circles",
      soundEnabled: true,
      soundVolume: 35,
      keySoundAssetId: "",
    },
    assets: [],
    music: {
      activeIndex: 0,
      queue: [],
    },
    ui: {
      sidebarVisible: true,
      toolbarVisible: true,
      musicVisible: true,
    },
  };
};

let state = loadState();
let saveTimer = 0;
let audioContext = null;
let spellTimer = 0;
let savedSelectionRange = null;
let pendingYouTubePlay = false;

const editor = document.querySelector("#editor");
const draftList = document.querySelector("#draftList");
const saveStatus = document.querySelector("#saveStatus");
const stats = document.querySelector("#stats");
const backgroundLayer = document.querySelector("#backgroundLayer");
const previewBackground = document.querySelector("#previewBackground");
const spellResults = document.querySelector("#spellResults");
const musicPlayerShell = document.querySelector(".music-player");
const musicBackdrop = document.querySelector("#musicBackdrop");
const musicQueue = document.querySelector("#musicQueue");
const musicStatus = document.querySelector("#musicStatus");
const playPauseButton = document.querySelector("#playPauseButton");
const assetDropZone = document.querySelector("#assetDropZone");
const assetFileInput = document.querySelector("#assetFileInput");
const assetLibrary = document.querySelector("#assetLibrary");
const quickExportButton = document.querySelector("#quickExportButton");
const previewKeySoundButton = document.querySelector("#previewKeySoundButton");
const toggleSidebarButton = document.querySelector("#toggleSidebarButton");
const toggleToolbarButton = document.querySelector("#toggleToolbarButton");
const toggleMusicButton = document.querySelector("#toggleMusicButton");
const controls = {
  textColor: document.querySelector("#textColor"),
  pageColor: document.querySelector("#pageColor"),
  accentColor: document.querySelector("#accentColor"),
  sidebarColor: document.querySelector("#sidebarColor"),
  toolbarColor: document.querySelector("#toolbarColor"),
  controlBubbleColor: document.querySelector("#controlBubbleColor"),
  buttonColor: document.querySelector("#buttonColor"),
  buttonTextColor: document.querySelector("#buttonTextColor"),
  backgroundAssetSelect: document.querySelector("#backgroundAssetSelect"),
  backgroundOpacity: document.querySelector("#backgroundOpacity"),
  soundToggle: document.querySelector("#soundToggle"),
  soundVolume: document.querySelector("#soundVolume"),
  keySoundSelect: document.querySelector("#keySoundSelect"),
  formatColor: document.querySelector("#formatColor"),
  blockFormat: document.querySelector("#blockFormat"),
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    if (parsed?.drafts?.length) return migrateState(parsed);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return defaultState();
}

function migrateState(savedState) {
  const theme = savedState.theme ?? {};
  if (theme.backgroundImage && !theme.backgroundImage.startsWith("data:")) {
    theme.backgroundPattern = "mod-circles";
    theme.backgroundImage = "";
  }
  savedState.theme = {
    ...defaultState().theme,
    ...theme,
  };
  if (!Array.isArray(savedState.assets)) {
    savedState.assets = [];
  }
  savedState.music = {
    ...defaultState().music,
    ...(savedState.music ?? {}),
  };
  if (!Array.isArray(savedState.music.queue)) {
    savedState.music.queue = [];
  }
  savedState.music.queue = savedState.music.queue.filter((song) => {
    return !["jfKfPfyJRdk", "5qap5aO4i9A"].includes(song.videoId);
  });
  if (savedState.music.activeIndex >= savedState.music.queue.length) {
    savedState.music.activeIndex = 0;
  }
  savedState.ui = {
    ...defaultState().ui,
    ...(savedState.ui ?? {}),
  };
  return savedState;
}

function activeDraft() {
  return state.drafts.find((draft) => draft.id === state.activeDraftId) ?? state.drafts[0];
}

function activeSong() {
  return state.music.queue[state.music.activeIndex] ?? null;
}

function scheduleSave() {
  saveStatus.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 350);
}

function saveNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = `Autosaved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch {
    saveStatus.textContent = "Storage full - export or delete assets";
  }
}

function applyTheme() {
  const theme = state.theme;
  document.documentElement.style.setProperty("--editor-text", theme.textColor);
  document.documentElement.style.setProperty("--paper", theme.pageColor);
  document.documentElement.style.setProperty("--accent", theme.accentColor);
  document.documentElement.style.setProperty("--sidebar-bg", theme.sidebarColor);
  document.documentElement.style.setProperty("--toolbar-bg", theme.toolbarColor);
  document.documentElement.style.setProperty("--control-bg", theme.controlBubbleColor);
  document.documentElement.style.setProperty("--button-bg", theme.buttonColor);
  document.documentElement.style.setProperty("--button-text", theme.buttonTextColor);
  backgroundLayer.style.opacity = String(theme.backgroundOpacity / 100);
  backgroundLayer.style.backgroundImage = backgroundForTheme(theme);
  previewBackground.style.opacity = String(theme.backgroundOpacity / 100);
  previewBackground.style.backgroundImage = backgroundForTheme(theme);

  controls.textColor.value = theme.textColor;
  controls.pageColor.value = theme.pageColor;
  controls.accentColor.value = theme.accentColor;
  controls.sidebarColor.value = theme.sidebarColor;
  controls.toolbarColor.value = theme.toolbarColor;
  controls.controlBubbleColor.value = theme.controlBubbleColor;
  controls.buttonColor.value = theme.buttonColor;
  controls.buttonTextColor.value = theme.buttonTextColor;
  controls.backgroundAssetSelect.value = backgroundAssetIdForTheme();
  controls.backgroundOpacity.value = theme.backgroundOpacity;
  controls.soundToggle.checked = theme.soundEnabled;
  controls.soundVolume.value = theme.soundVolume;
  controls.keySoundSelect.value = theme.keySoundAssetId || "";
  controls.formatColor.value = theme.textColor;
  updateActivePreset();
}

function applyVisibility() {
  document.body.classList.toggle("sidebar-hidden", !state.ui.sidebarVisible);
  document.body.classList.toggle("toolbar-hidden", !state.ui.toolbarVisible);
  document.body.classList.toggle("music-hidden", !state.ui.musicVisible);
  toggleSidebarButton.classList.toggle("active", state.ui.sidebarVisible);
  toggleToolbarButton.classList.toggle("active", state.ui.toolbarVisible);
  toggleMusicButton.classList.toggle("active", state.ui.musicVisible);
}

function toggleView(key) {
  state.ui[key] = !state.ui[key];
  applyVisibility();
  scheduleSave();
}

function selectPanel(tab) {
  document.querySelectorAll("[data-tab]").forEach((tabButton) => {
    tabButton.classList.toggle("active", tabButton.dataset.tab === tab);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tab);
  });
}

function defaultBackground() {
  return "radial-gradient(circle at top left, rgba(214, 92, 138, 0.26), transparent 34%), linear-gradient(135deg, #eef1f4 0%, #f7edf4 48%, #e7f2ef 100%)";
}

function backgroundForTheme(theme) {
  if (theme.backgroundImage) return `url("${theme.backgroundImage}")`;
  return patternBackground(theme.backgroundPattern);
}

function patternBackground(pattern) {
  if (pattern === "mod-circles") {
    return [
      "radial-gradient(circle at 12% 18%, #ef4f86 0 6%, transparent 6.5%)",
      "radial-gradient(circle at 12% 18%, #ffb347 0 13%, transparent 13.5%)",
      "radial-gradient(circle at 12% 18%, #21181f 0 18%, transparent 18.5%)",
      "radial-gradient(circle at 86% 78%, #1faaa6 0 8%, transparent 8.5%)",
      "radial-gradient(circle at 86% 78%, #ef4f86 0 16%, transparent 16.5%)",
      "linear-gradient(135deg, #fff1d2 0 44%, #ff8a3d 45% 62%, #ef4f86 63% 100%)",
    ].join(", ");
  }
  if (pattern === "sunset-waves") {
    return [
      "radial-gradient(circle at 18% 78%, rgba(120, 147, 76, 0.9) 0 18%, transparent 19%)",
      "radial-gradient(circle at 84% 22%, rgba(247, 208, 92, 0.92) 0 14%, transparent 15%)",
      "linear-gradient(125deg, transparent 0 29%, rgba(45, 139, 156, 0.78) 30% 42%, transparent 43%)",
      "repeating-linear-gradient(150deg, #fff0c7 0 54px, #e46b47 55px 92px, #f7d05c 93px 136px, #78934c 137px 172px)",
    ].join(", ");
  }
  if (pattern === "midnight-dots") {
    return [
      "radial-gradient(circle at 72% 28%, #b7194c 0 5%, transparent 5.5%)",
      "radial-gradient(circle at 32% 68%, #c5a158 0 4%, transparent 4.5%)",
      "radial-gradient(circle at 20% 30%, transparent 0 18%, #c5a158 19% 20%, transparent 21%)",
      "radial-gradient(circle at 70% 76%, transparent 0 16%, #c5a158 17% 18%, transparent 19%)",
      "repeating-radial-gradient(circle at 50% 50%, rgba(247, 237, 212, 0.14) 0 2px, transparent 3px 28px)",
      "linear-gradient(135deg, #061b1f, #0b3034 50%, #120c19)",
    ].join(", ");
  }
  return defaultBackground();
}

function updateActivePreset() {
  document.querySelectorAll("[data-preset]").forEach((button) => {
    const preset = lookPresets[button.dataset.preset];
    button.classList.toggle("active", !state.theme.backgroundImage && preset?.background === state.theme.backgroundPattern);
  });
}

function applyLookPreset(presetId) {
  const preset = lookPresets[presetId];
  if (!preset) return;
  state.theme.backgroundImage = "";
  state.theme.backgroundPattern = preset.background;
  state.theme.textColor = preset.textColor;
  state.theme.pageColor = preset.pageColor;
  state.theme.accentColor = preset.accentColor;
  state.theme.sidebarColor = preset.sidebarColor;
  state.theme.toolbarColor = preset.toolbarColor;
  state.theme.controlBubbleColor = preset.controlBubbleColor;
  state.theme.buttonColor = preset.buttonColor;
  state.theme.buttonTextColor = preset.buttonTextColor;
  state.theme.backgroundOpacity = preset.backgroundOpacity;
  applyTheme();
  scheduleSave();
}

function renderAssets() {
  renderBackgroundOptions();
  renderSoundOptions();
  assetLibrary.innerHTML = "";
  if (!state.assets.length) {
    assetLibrary.innerHTML = "<p class=\"music-status\">No custom assets yet.</p>";
    return;
  }

  state.assets.forEach((asset) => {
    const item = document.createElement("div");
    item.className = "asset-item";
    const usage = assetUsage(asset);
    item.innerHTML = `
      <div class="asset-preview">${asset.kind === "image" ? `<img src="${asset.dataUrl}" alt="" />` : "SND"}</div>
      <div class="asset-meta">
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${asset.label} | ${formatBytes(asset.size)} | ${usage}</span>
      </div>
      <div class="asset-actions"></div>
    `;

    const actions = item.querySelector(".asset-actions");
    if (asset.kind === "image") {
      actions.append(assetButton("BG", "Use as background", () => useAssetAsBackground(asset.id)));
    }
    if (asset.kind === "audio") {
      actions.append(assetButton(">", "Preview sound", () => playAssetSound(asset.id)));
      actions.append(assetButton("S", "Use for typing sounds", () => useAssetAsKeySound(asset.id)));
    }
    actions.append(assetButton("x", "Delete asset", () => deleteAsset(asset.id)));
    assetLibrary.append(item);
  });
}

function renderBackgroundOptions() {
  const selected = backgroundAssetIdForTheme();
  const imageAssets = state.assets.filter((asset) => asset.kind === "image");
  controls.backgroundAssetSelect.innerHTML = '<option value="">Pattern background</option>';
  imageAssets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = asset.id;
    option.textContent = asset.name;
    controls.backgroundAssetSelect.append(option);
  });
  controls.backgroundAssetSelect.value = selected;
}

function backgroundAssetIdForTheme() {
  if (!state.theme.backgroundImage) return "";
  const asset = state.assets.find((item) => item.kind === "image" && item.dataUrl === state.theme.backgroundImage);
  return asset?.id ?? "";
}

function assetButton(text, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", onClick);
  return button;
}

function renderSoundOptions() {
  const selected = state.theme.keySoundAssetId || "";
  const audioAssets = state.assets.filter((asset) => asset.kind === "audio");
  controls.keySoundSelect.innerHTML = '<option value="">Soft click</option>';
  audioAssets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = asset.id;
    option.textContent = asset.name;
    controls.keySoundSelect.append(option);
  });
  if (selected && !audioAssets.some((asset) => asset.id === selected)) {
    state.theme.keySoundAssetId = "";
  }
  controls.keySoundSelect.value = state.theme.keySoundAssetId || "";
}

function assetUsage(asset) {
  const uses = [];
  if (state.theme.backgroundImage === asset.dataUrl) uses.push("Background");
  if (state.theme.keySoundAssetId === asset.id) uses.push("Typing sound");
  return uses.length ? uses.join(", ") : "Unused";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetKind(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "";
}

async function addAssetFiles(files) {
  const supported = Array.from(files).filter(assetKind);
  for (const file of supported) {
    const dataUrl = await readFileAsDataUrl(file);
    const kind = assetKind(file);
    state.assets.push({
      id: crypto.randomUUID(),
      name: file.name,
      kind,
      label: kind === "image" ? (file.type === "image/gif" ? "GIF" : "Image") : "Sound",
      type: file.type,
      size: file.size,
      dataUrl,
      createdAt: Date.now(),
    });
  }
  renderAssets();
  scheduleSave();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function useAssetAsBackground(assetId) {
  const asset = state.assets.find((item) => item.id === assetId && item.kind === "image");
  if (!asset) return;
  state.theme.backgroundImage = asset.dataUrl;
  state.theme.backgroundPattern = "";
  applyTheme();
  renderAssets();
  scheduleSave();
}

function useAssetAsKeySound(assetId) {
  const asset = state.assets.find((item) => item.id === assetId && item.kind === "audio");
  if (!asset) return;
  state.theme.keySoundAssetId = asset.id;
  renderAssets();
  applyTheme();
  playAssetSound(asset.id);
  scheduleSave();
}

function deleteAsset(assetId) {
  const asset = state.assets.find((item) => item.id === assetId);
  if (!asset) return;
  if (state.theme.backgroundImage === asset.dataUrl) {
    state.theme.backgroundImage = "";
    state.theme.backgroundPattern = "mod-circles";
  }
  if (state.theme.keySoundAssetId === asset.id) {
    state.theme.keySoundAssetId = "";
  }
  state.assets = state.assets.filter((item) => item.id !== assetId);
  renderAssets();
  applyTheme();
  scheduleSave();
}

function playAssetSound(assetId) {
  const asset = state.assets.find((item) => item.id === assetId && item.kind === "audio");
  if (!asset) return;
  const audio = new Audio(asset.dataUrl);
  audio.volume = Math.max(0, Math.min(1, state.theme.soundVolume / 100));
  audio.play().catch(() => {});
}

function renderMusic() {
  const song = activeSong();
  document.body.classList.toggle("song-loaded", Boolean(song));
  if (song) {
    musicPlayerShell.classList.add("has-song");
    musicBackdrop.style.backgroundImage = `url("${thumbnailForVideo(song.videoId)}")`;
  } else {
    musicPlayerShell.classList.remove("has-song");
    musicBackdrop.style.backgroundImage = "";
    setPlayPauseState(false);
  }

  musicQueue.innerHTML = "";

  if (!state.music.queue.length) {
    musicQueue.innerHTML = "<p class=\"music-status\">No songs queued yet.</p>";
    return;
  }

  state.music.queue.forEach((queueSong, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === state.music.activeIndex ? "active" : "";
    button.innerHTML = `
      <img src="${thumbnailForVideo(queueSong.videoId)}" alt="" />
      <span>
        <strong>${escapeHtml(queueSong.title || "YouTube song")}</strong>
        <span>${escapeHtml(queueSong.artist || "YouTube")}</span>
      </span>
    `;
    button.addEventListener("click", () => loadSong(index, true));
    musicQueue.append(button);
  });
}

function setPlayPauseState(isPlaying) {
  playPauseButton.classList.toggle("is-playing", isPlaying);
  playPauseButton.classList.toggle("is-paused", !isPlaying);
  playPauseButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  playPauseButton.title = isPlaying ? "Pause" : "Play";
}

function thumbnailForVideo(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractYouTubeVideoId(value) {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
    if (url.hostname.includes("youtube.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    return "";
  }
  return "";
}

function isFileMode() {
  return location.protocol === "file:";
}

function youtubeOrigin() {
  return location.origin && location.origin !== "null" ? location.origin : "";
}

function showYouTubeHttpMessage(revealPanel = true) {
  musicStatus.textContent = "YouTube playback needs localhost or a deployed site. Run serve-local.ps1, then open http://localhost:4173.";
  if (revealPanel) {
    state.ui.sidebarVisible = true;
    selectPanel("sound");
    applyVisibility();
  }
}

function prepareYouTubeIframe(player) {
  const iframe = player?.getIframe?.();
  if (!iframe) return;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
}

function loadYouTubeApi() {
  if (window.YT?.Player) {
    createYouTubePlayer();
    return;
  }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.append(tag);
  window.onYouTubeIframeAPIReady = createYouTubePlayer;
}

function createYouTubePlayer() {
  if (window.youtubeMusicPlayer || !window.YT?.Player) return;
  const song = activeSong();
  const origin = youtubeOrigin();
  window.youtubeMusicPlayer = new YT.Player("youtubePlayer", {
    width: 200,
    height: 200,
    videoId: song?.videoId || "",
    playerVars: {
      controls: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      ...(origin ? { origin } : {}),
    },
    events: {
      onReady: handleYouTubeReady,
      onStateChange: handleYouTubeState,
      onError: handleYouTubeError,
    },
  });
}

function handleYouTubeReady(event) {
  prepareYouTubeIframe(event.target);
  syncMusicDataFromPlayer();
  const song = activeSong();
  if (!song) return;
  if (pendingYouTubePlay) {
    pendingYouTubePlay = false;
    event.target.loadVideoById(song.videoId);
    setPlayPauseState(true);
  } else {
    event.target.cueVideoById(song.videoId);
  }
}

function handleYouTubeState(event) {
  syncMusicDataFromPlayer();
  if (event.data === YT.PlayerState.PLAYING) setPlayPauseState(true);
  if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) setPlayPauseState(false);
  if (event.data === YT.PlayerState.ENDED) nextSong(true);
}

function handleYouTubeError(event) {
  setPlayPauseState(false);
  state.ui.sidebarVisible = true;
  selectPanel("sound");
  applyVisibility();

  if (event.data === 153) {
    musicStatus.textContent = "YouTube needs this page opened from localhost or HTTPS so it can verify the embed origin.";
    return;
  }
  if (event.data === 101 || event.data === 150) {
    musicStatus.textContent = "That video does not allow embedded playback. Try a different YouTube link.";
    return;
  }
  musicStatus.textContent = "YouTube could not play that link. Try another video or reload Linea from localhost.";
}

function syncMusicDataFromPlayer() {
  const data = window.youtubeMusicPlayer?.getVideoData?.();
  if (!data?.video_id) return;
  const song = activeSong();
  if (song?.videoId !== data.video_id) return;
  if (data.title) song.title = data.title;
  if (data.author) song.artist = data.author;
  renderMusic();
  scheduleSave();
}

function loadSong(index, shouldPlay = false) {
  if (!state.music.queue.length) return;
  state.music.activeIndex = (index + state.music.queue.length) % state.music.queue.length;
  renderMusic();
  const song = activeSong();
  if (isFileMode()) {
    setPlayPauseState(false);
    showYouTubeHttpMessage();
    scheduleSave();
    return;
  }
  if (!window.youtubeMusicPlayer?.loadVideoById && !window.youtubeMusicPlayer?.cueVideoById) {
    pendingYouTubePlay = shouldPlay;
    musicStatus.textContent = "Loading YouTube player...";
    loadYouTubeApi();
    scheduleSave();
    return;
  }
  if (window.youtubeMusicPlayer?.loadVideoById && shouldPlay) {
    window.youtubeMusicPlayer.loadVideoById(song.videoId);
    setPlayPauseState(true);
  } else if (window.youtubeMusicPlayer?.cueVideoById) {
    window.youtubeMusicPlayer.cueVideoById(song.videoId);
    setPlayPauseState(false);
  }
  scheduleSave();
}

function nextSong(shouldPlay = false) {
  if (!state.music.queue.length) return;
  loadSong(state.music.activeIndex + 1, shouldPlay);
}

function previousSong() {
  if (!state.music.queue.length) return;
  loadSong(state.music.activeIndex - 1, true);
}

function togglePlayback() {
  if (!state.music.queue.length) {
    musicStatus.textContent = "Paste a YouTube link first.";
    state.ui.sidebarVisible = true;
    applyVisibility();
    return;
  }
  if (isFileMode()) {
    showYouTubeHttpMessage();
    return;
  }
  loadYouTubeApi();
  const player = window.youtubeMusicPlayer;
  if (!player?.getPlayerState) return;
  const playerState = player.getPlayerState();
  if (playerState === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

function renderDrafts() {
  draftList.innerHTML = "";
  state.drafts
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((draft) => {
      const item = document.createElement("div");
      item.className = `draft-item${draft.id === state.activeDraftId ? " active" : ""}`;
      item.tabIndex = 0;
      item.role = "button";
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(draft.title)}</strong>
          <span>${new Date(draft.updatedAt).toLocaleDateString()}</span>
        </div>
        <button type="button" aria-label="Delete ${escapeHtml(draft.title)}">x</button>
      `;
      item.addEventListener("click", () => switchDraft(draft.id));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") switchDraft(draft.id);
      });
      item.querySelector("button").addEventListener("click", (event) => {
        event.stopPropagation();
        deleteDraft(draft.id);
      });
      draftList.append(item);
    });
}

function switchDraft(id) {
  syncEditorToState();
  state.activeDraftId = id;
  editor.innerHTML = activeDraft().html;
  renderDrafts();
  updateStats();
  runSpellCheck();
  scheduleSave();
}

function deleteDraft(id) {
  if (state.drafts.length === 1) return;
  state.drafts = state.drafts.filter((draft) => draft.id !== id);
  if (state.activeDraftId === id) state.activeDraftId = state.drafts[0].id;
  editor.innerHTML = activeDraft().html;
  renderDrafts();
  updateStats();
  runSpellCheck();
  scheduleSave();
}

function syncEditorToState() {
  const draft = activeDraft();
  draft.html = cleanEditorHtml();
  draft.title = titleFromEditor(editor);
  draft.updatedAt = Date.now();
}

function cleanEditorHtml() {
  const clone = editor.cloneNode(true);
  clone.querySelectorAll(".spell-error").forEach((span) => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  return clone.innerHTML;
}

function titleFromEditor(source) {
  const text = source.innerText.trim().split(/\n/).find(Boolean);
  return text ? text.slice(0, 48) : "Untitled story";
}

function updateStats() {
  const text = editor.innerText.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  stats.textContent = `${words} word${words === 1 ? "" : "s"} | ${chars} chars`;
}

function scheduleSpellCheck() {
  clearTimeout(spellTimer);
  spellTimer = window.setTimeout(runSpellCheck, 450);
}

function runSpellCheck() {
  const selectionOffsets = getSelectionOffsets();
  removeSpellHighlights();
  const matches = collectSpellingMatches();
  applySpellHighlights(matches);
  renderSpellSuggestions(matches);
  restoreSelectionOffsets(selectionOffsets);
}

function collectSpellingMatches() {
  const text = editor.innerText;
  const matches = [];
  for (const match of text.matchAll(/\b[a-z']+\b/gi)) {
    const word = match[0];
    const normalized = word.toLowerCase().replace(/^'+|'+$/g, "");
    const suggestion = spellingSuggestions[normalized];
    if (!suggestion) continue;
    matches.push({ word, normalized, suggestion, index: match.index });
  }
  return matches;
}

function renderSpellSuggestions(matches) {
  spellResults.innerHTML = "";
  if (!matches.length) {
    spellResults.innerHTML = "<p>No common spelling issues found. Browser spellcheck may still catch more words.</p>";
    return;
  }

  const unique = [];
  const seen = new Set();
  matches.forEach((match) => {
    if (seen.has(match.normalized)) return;
    seen.add(match.normalized);
    unique.push(match);
  });

  const approveAll = document.createElement("button");
  approveAll.type = "button";
  approveAll.textContent = `Approve all (${matches.length})`;
  approveAll.addEventListener("click", () => {
    unique.forEach((match) => replaceMisspelling(match.normalized, match.suggestion));
    runSpellCheck();
    syncEditorToState();
    scheduleSave();
  });
  spellResults.append(approveAll);

  unique.slice(0, 20).forEach((match) => {
    const item = document.createElement("div");
    item.className = "spell-item";
    item.innerHTML = `
      <span>
        <strong>${escapeHtml(match.word)} -> ${escapeHtml(match.suggestion)}</strong>
        <span>Approve this fix</span>
      </span>
    `;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Fix";
    button.addEventListener("click", () => {
      replaceMisspelling(match.normalized, match.suggestion);
      runSpellCheck();
      syncEditorToState();
      scheduleSave();
    });
    item.append(button);
    spellResults.append(item);
  });
}

function applySpellHighlights(matches) {
  if (!matches.length) return;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const text = node.textContent;
    const parts = [];
    let lastIndex = 0;
    for (const match of text.matchAll(/\b[a-z']+\b/gi)) {
      const word = match[0];
      const normalized = word.toLowerCase().replace(/^'+|'+$/g, "");
      const suggestion = spellingSuggestions[normalized];
      if (!suggestion) continue;
      if (match.index > lastIndex) parts.push(document.createTextNode(text.slice(lastIndex, match.index)));
      const span = document.createElement("span");
      span.className = "spell-error";
      span.dataset.suggestion = suggestion;
      span.textContent = word;
      parts.push(span);
      lastIndex = match.index + word.length;
    }
    if (!parts.length) return;
    if (lastIndex < text.length) parts.push(document.createTextNode(text.slice(lastIndex)));
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => fragment.append(part));
    node.replaceWith(fragment);
  });
}

function removeSpellHighlights() {
  editor.querySelectorAll(".spell-error").forEach((span) => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
  editor.normalize();
}

function replaceMisspelling(normalized, suggestion) {
  removeSpellHighlights();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const matcher = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "gi");
  nodes.forEach((node) => {
    node.textContent = node.textContent.replace(matcher, (word) => preserveCase(word, suggestion));
  });
}

function preserveCase(source, replacement) {
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSelectionOffsets() {
  const selection = window.getSelection();
  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  return {
    start: textOffsetForNode(range.startContainer, range.startOffset),
    end: textOffsetForNode(range.endContainer, range.endOffset),
  };
}

function textOffsetForNode(targetNode, targetOffset) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === targetNode) return offset + targetOffset;
    offset += node.textContent.length;
  }
  return offset;
}

function restoreSelectionOffsets(offsets) {
  if (!offsets) return;
  editor.focus();
  const range = document.createRange();
  const start = textNodeAtOffset(offsets.start);
  const end = textNodeAtOffset(offsets.end);
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  saveEditorSelection();
}

function textNodeAtOffset(targetOffset) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let current = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const next = current + node.textContent.length;
    if (targetOffset <= next) {
      return { node, offset: Math.max(0, Math.min(targetOffset - current, node.textContent.length)) };
    }
    current = next;
  }
  if (!editor.firstChild) editor.append(document.createTextNode(""));
  const fallback = editor.lastChild.nodeType === Node.TEXT_NODE ? editor.lastChild : editor.appendChild(document.createTextNode(""));
  return { node: fallback, offset: fallback.textContent.length };
}

function saveEditorSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
  savedSelectionRange = selection.getRangeAt(0).cloneRange();
}

function restoreEditorSelection() {
  editor.focus();
  if (!savedSelectionRange) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedSelectionRange);
  return true;
}

function editableBlockForNode(node) {
  let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (element && element !== editor) {
    if (["P", "H1", "H2", "BLOCKQUOTE", "DIV"].includes(element.tagName) && element.parentElement === editor) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

function selectedEditorBlocks(range) {
  if (range.collapsed) {
    const block = editableBlockForNode(range.startContainer);
    return block ? [block] : [];
  }

  return [...editor.querySelectorAll(":scope > p, :scope > h1, :scope > h2, :scope > blockquote, :scope > div")]
    .filter((block) => range.intersectsNode(block));
}

function replaceBlockTag(block, tagName) {
  if (block.tagName.toLowerCase() === tagName) return block;
  const replacement = document.createElement(tagName);
  while (block.firstChild) replacement.append(block.firstChild);
  block.replaceWith(replacement);
  return replacement;
}

function placeCaretInBlock(block) {
  const range = document.createRange();
  if (!block.firstChild) block.append(document.createTextNode(""));
  const text = block.firstChild.nodeType === Node.TEXT_NODE ? block.firstChild : block;
  range.setStart(text, text.nodeType === Node.TEXT_NODE ? text.textContent.length : text.childNodes.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function applyBlockFormat(tagName) {
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return;

  const offsets = getSelectionOffsets();
  const range = selection.getRangeAt(0);
  const blocks = selectedEditorBlocks(range);

  if (!blocks.length) {
    document.execCommand("formatBlock", false, tagName);
  } else {
    const replacements = blocks.map((block) => replaceBlockTag(block, tagName));
    if (range.collapsed && offsets?.start === offsets?.end && !replacements[0].innerText.trim()) {
      placeCaretInBlock(replacements[0]);
      saveEditorSelection();
      syncEditorToState();
      updateStats();
      scheduleSpellCheck();
      scheduleSave();
      return;
    }
  }

  restoreSelectionOffsets(offsets);
  saveEditorSelection();
  syncEditorToState();
  updateStats();
  scheduleSpellCheck();
  scheduleSave();
}

function currentBlockFormat() {
  const selection = window.getSelection();
  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) return "";
  const block = editableBlockForNode(selection.anchorNode);
  if (!block) return "";
  const tag = block.tagName.toLowerCase();
  return controls.blockFormat.querySelector(`option[value="${tag}"]`) ? tag : "";
}

function updateBlockFormatControl() {
  const tag = currentBlockFormat();
  if (tag) controls.blockFormat.value = tag;
}

function insertParagraphAfter(block) {
  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  block.after(paragraph);
  placeCaretInBlock(paragraph);
  controls.blockFormat.value = "p";
  saveEditorSelection();
  syncEditorToState();
  updateStats();
  scheduleSpellCheck();
  scheduleSave();
}

function handleBlockEnter(event) {
  if (event.key !== "Enter" || event.shiftKey) return false;
  const selection = window.getSelection();
  if (!selection.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return false;
  const block = editableBlockForNode(selection.anchorNode);
  if (!block || !["H1", "H2", "BLOCKQUOTE"].includes(block.tagName)) return false;
  event.preventDefault();
  insertParagraphAfter(block);
  playKeySound();
  return true;
}

function selectTextRange(start, length) {
  editor.focus();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let current = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const next = current + node.textContent.length;
    if (start >= current && start <= next) {
      const range = document.createRange();
      const offset = start - current;
      range.setStart(node, offset);
      range.setEnd(node, Math.min(offset + length, node.textContent.length));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      break;
    }
    current = next;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function runCommand(command, value = null) {
  restoreEditorSelection();
  document.execCommand(command, false, value);
  saveEditorSelection();
  syncEditorToState();
  updateStats();
  scheduleSpellCheck();
  scheduleSave();
}

function playKeySound() {
  if (!state.theme.soundEnabled) return;
  if (state.theme.keySoundAssetId) {
    playAssetSound(state.theme.keySoundAssetId);
    return;
  }
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 130 + Math.random() * 70;
  gain.gain.value = (state.theme.soundVolume / 100) * 0.045;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.045);
  oscillator.stop(audioContext.currentTime + 0.05);
}

function download(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function prettyFileHtml() {
  const theme = state.theme;
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${escapeHtml(activeDraft().title)}</title>
<body style="margin:0;padding:40px;background:${theme.pageColor};color:${theme.textColor};font:18px/1.75 Georgia,serif;">
<main style="max-width:760px;margin:auto;">${activeDraft().html}</main>
</body>
</html>`;
}

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => runCommand(button.dataset.command));
});

document.querySelector(".topbar").addEventListener("pointerdown", saveEditorSelection);

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    selectPanel(button.dataset.tab);
  });
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => applyLookPreset(button.dataset.preset));
});

toggleSidebarButton.addEventListener("click", () => toggleView("sidebarVisible"));
toggleToolbarButton.addEventListener("click", () => toggleView("toolbarVisible"));
toggleMusicButton.addEventListener("click", () => toggleView("musicVisible"));
quickExportButton.addEventListener("click", () => {
  syncEditorToState();
  download(`${activeDraft().title || "story"}.html`, "text/html", prettyFileHtml());
});
playPauseButton.addEventListener("click", togglePlayback);
document.querySelector("#nextSongButton").addEventListener("click", () => nextSong(true));
document.querySelector("#previousSongButton").addEventListener("click", previousSong);
document.querySelector("#musicAddForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#musicUrlInput");
  const videoId = extractYouTubeVideoId(input.value);
  if (!videoId) return;
  state.music.queue.push({
    videoId,
    title: "Loading title...",
    artist: "Added by link",
  });
  musicStatus.textContent = "Added to queue.";
  input.value = "";
  loadSong(state.music.queue.length - 1, true);
});

controls.blockFormat.addEventListener("change", () => applyBlockFormat(controls.blockFormat.value));
controls.formatColor.addEventListener("input", () => runCommand("foreColor", controls.formatColor.value));
controls.keySoundSelect.addEventListener("change", () => {
  state.theme.keySoundAssetId = controls.keySoundSelect.value;
  scheduleSave();
});
controls.backgroundAssetSelect.addEventListener("change", () => {
  const assetId = controls.backgroundAssetSelect.value;
  if (!assetId) {
    state.theme.backgroundImage = "";
    state.theme.backgroundPattern = "mod-circles";
  } else {
    useAssetAsBackground(assetId);
    return;
  }
  applyTheme();
  renderAssets();
  scheduleSave();
});
document.querySelector("#previewBackgroundAssetButton").addEventListener("click", () => {
  const assetId = controls.backgroundAssetSelect.value;
  if (assetId) useAssetAsBackground(assetId);
});
previewKeySoundButton.addEventListener("click", () => {
  if (state.theme.keySoundAssetId) {
    playAssetSound(state.theme.keySoundAssetId);
  } else {
    playKeySound();
  }
});

assetFileInput.addEventListener("change", (event) => {
  addAssetFiles(event.target.files);
  event.target.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  assetDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    assetDropZone.classList.add("drag-active");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  assetDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    assetDropZone.classList.remove("drag-active");
  });
}

assetDropZone.addEventListener("drop", (event) => {
  addAssetFiles(event.dataTransfer.files);
});

editor.addEventListener("input", () => {
  syncEditorToState();
  updateStats();
  renderDrafts();
  saveEditorSelection();
  updateBlockFormatControl();
  scheduleSpellCheck();
  scheduleSave();
});

editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    runCommand("insertHTML", "&emsp;");
    return;
  }
  if (handleBlockEnter(event)) return;
  if (event.key.length === 1 || event.key === "Enter" || event.key === "Backspace") playKeySound();
});

editor.addEventListener("keyup", () => {
  saveEditorSelection();
  updateBlockFormatControl();
});

editor.addEventListener("mouseup", () => {
  saveEditorSelection();
  updateBlockFormatControl();
});

document.addEventListener("selectionchange", () => {
  saveEditorSelection();
  updateBlockFormatControl();
});

document.querySelector("#newDraftButton").addEventListener("click", () => {
  syncEditorToState();
  const draft = defaultDraft();
  state.drafts.push(draft);
  state.activeDraftId = draft.id;
  editor.innerHTML = draft.html;
  renderDrafts();
  updateStats();
  runSpellCheck();
  scheduleSave();
  editor.focus();
});

for (const key of ["textColor", "pageColor", "accentColor", "sidebarColor", "toolbarColor", "controlBubbleColor", "buttonColor", "buttonTextColor"]) {
  controls[key].addEventListener("input", () => {
    state.theme[key] = controls[key].value;
    applyTheme();
    scheduleSave();
  });
}

controls.backgroundOpacity.addEventListener("input", () => {
  state.theme.backgroundOpacity = Number(controls.backgroundOpacity.value);
  applyTheme();
  scheduleSave();
});

controls.soundToggle.addEventListener("change", () => {
  state.theme.soundEnabled = controls.soundToggle.checked;
  scheduleSave();
});

controls.soundVolume.addEventListener("input", () => {
  state.theme.soundVolume = Number(controls.soundVolume.value);
  scheduleSave();
});

document.querySelector("#clearBackgroundButton").addEventListener("click", () => {
  state.theme.backgroundImage = "";
  state.theme.backgroundPattern = "mod-circles";
  controls.backgroundAssetSelect.value = "";
  applyTheme();
  renderAssets();
  scheduleSave();
});

document.querySelector("#downloadHtmlButton").addEventListener("click", () => {
  syncEditorToState();
  download(`${activeDraft().title || "story"}.html`, "text/html", prettyFileHtml());
});

document.querySelector("#downloadTextButton").addEventListener("click", () => {
  syncEditorToState();
  download(`${activeDraft().title || "story"}.txt`, "text/plain", editor.innerText);
});

document.querySelector("#importFile").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const draft = defaultDraft();
    draft.title = file.name.replace(/\.[^.]+$/, "");
    draft.html = file.type.includes("html") || file.name.endsWith(".html")
      ? reader.result
      : `<p>${escapeHtml(reader.result).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
    state.drafts.push(draft);
    state.activeDraftId = draft.id;
    editor.innerHTML = draft.html;
    renderDrafts();
    updateStats();
    runSpellCheck();
    scheduleSave();
  });
  reader.readAsText(file);
  event.target.value = "";
});

window.addEventListener("beforeunload", () => {
  syncEditorToState();
  saveNow();
});

editor.innerHTML = activeDraft().html;
renderAssets();
applyTheme();
applyVisibility();
renderDrafts();
updateStats();
runSpellCheck();
renderMusic();
if (isFileMode()) {
  showYouTubeHttpMessage(false);
} else {
  loadYouTubeApi();
}
saveNow();
