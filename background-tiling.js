(() => {
  const STORAGE_KEY = "linea-background-layout-v2";
  const COLLAPSE_KEY = "linea-background-layout-collapsed-v1";
  const looksPanel = document.querySelector('[data-panel="looks"]');
  const backgroundSelect = document.querySelector("#backgroundAssetSelect");
  const backgroundLayer = document.querySelector("#backgroundLayer");
  const previewBackground = document.querySelector("#previewBackground");

  if (!looksPanel || !backgroundLayer) return;

  const defaultSettings = {
    mode: "cover",
    tileSize: 96,
  };

  function loadSettings() {
    try {
      const v2 = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const old = JSON.parse(localStorage.getItem("linea-background-layout-v1") || "{}");
      return { ...defaultSettings, ...old, ...v2 };
    } catch {
      return { ...defaultSettings };
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function selectedCustomBackground() {
    return Boolean(backgroundSelect?.value);
  }

  function clampTileSize(value) {
    return Math.max(16, Math.min(480, Math.round(Number(value) || defaultSettings.tileSize)));
  }

  function getTargets() {
    return [backgroundLayer, previewBackground].filter(Boolean);
  }

  function applyLayout() {
    const useTile = settings.mode === "tile" && selectedCustomBackground();

    getTargets().forEach((target) => {
      target.classList.toggle("tile-background", useTile);
      target.classList.toggle("cover-background", !useTile);

      if (useTile) {
        target.style.backgroundRepeat = "repeat";
        target.style.backgroundPosition = "top left";
        target.style.backgroundSize = `${settings.tileSize}px auto`;
      } else {
        target.style.backgroundRepeat = "no-repeat";
        target.style.backgroundPosition = "center";
        target.style.backgroundSize = "cover";
      }
    });

    document.querySelectorAll(".background-mode-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.backgroundMode === settings.mode);
    });

    const range = document.querySelector("#backgroundTileSize");
    const number = document.querySelector("#backgroundTileSizeNumber");
    if (range && Number(range.value) !== settings.tileSize) range.value = String(settings.tileSize);
    if (number && Number(number.value) !== settings.tileSize) number.value = String(settings.tileSize);
  }

  function setCollapsed(card, button, collapsed) {
    card.classList.toggle("collapsed", collapsed);
    button.textContent = collapsed ? "+" : "−";
    button.setAttribute("aria-label", collapsed ? "Expand background layout" : "Collapse background layout");
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }

  function buildControls() {
    if (document.querySelector("#backgroundLayoutMode")) return;

    const card = document.createElement("div");
    card.className = "background-layout-card";
    card.innerHTML = `
      <div class="background-layout-heading">
        <strong>Background layout</strong>
        <button class="background-layout-toggle" type="button" aria-label="Collapse background layout">−</button>
      </div>
      <div class="background-layout-body">
        <div class="background-mode-grid" id="backgroundLayoutMode" role="group" aria-label="Background layout mode">
          <button class="background-mode-option" type="button" data-background-mode="cover">
            <span>Cover</span>
            <small>One selected background image fills the screen.</small>
          </button>
          <button class="background-mode-option" type="button" data-background-mode="tile">
            <span>Tile</span>
            <small>Repeats the selected background image as a pattern.</small>
          </button>
        </div>
        <div class="tile-size-row">
          <label>
            Tile size
            <input id="backgroundTileSize" type="range" min="16" max="480" step="4" value="96" />
          </label>
          <input id="backgroundTileSizeNumber" class="tile-size-number" type="number" min="16" max="480" step="1" aria-label="Tile size in pixels" />
        </div>
        <p class="background-layout-help">Choose or upload background images in Files, then pick them from Background asset above.</p>
      </div>
    `;

    const opacityLabel = document.querySelector("#backgroundOpacity")?.closest("label");
    looksPanel.insertBefore(card, opacityLabel || null);

    const heading = card.querySelector(".background-layout-heading");
    const toggle = card.querySelector(".background-layout-toggle");
    const startCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
    setCollapsed(card, toggle, startCollapsed);

    heading.addEventListener("click", (event) => {
      if (event.target.closest("button") && event.target !== toggle) return;
      setCollapsed(card, toggle, !card.classList.contains("collapsed"));
    });

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      setCollapsed(card, toggle, !card.classList.contains("collapsed"));
    });

    card.querySelectorAll("[data-background-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        settings.mode = button.dataset.backgroundMode || "cover";
        saveSettings();
        applyLayout();
      });
    });

    const range = card.querySelector("#backgroundTileSize");
    const number = card.querySelector("#backgroundTileSizeNumber");

    function setSize(value) {
      settings.tileSize = clampTileSize(value);
      saveSettings();
      applyLayout();
    }

    range.addEventListener("input", () => setSize(range.value));
    number.addEventListener("change", () => setSize(number.value));
  }

  function scheduleApply() {
    window.setTimeout(applyLayout, 0);
    window.setTimeout(applyLayout, 50);
  }

  backgroundSelect?.addEventListener("change", scheduleApply);
  document.querySelector("#previewBackgroundAssetButton")?.addEventListener("click", scheduleApply);
  document.querySelector("#clearBackgroundButton")?.addEventListener("click", scheduleApply);
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", scheduleApply));

  const observer = new MutationObserver(() => applyLayout());
  observer.observe(backgroundLayer, { attributes: true, attributeFilter: ["style", "class"] });
  if (previewBackground) observer.observe(previewBackground, { attributes: true, attributeFilter: ["style", "class"] });

  settings.tileSize = clampTileSize(settings.tileSize);
  buildControls();
  applyLayout();
})();
