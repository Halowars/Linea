(() => {
  const STORAGE_KEY = "linea-background-layout-v1";
  const looksPanel = document.querySelector('[data-panel="looks"]');
  const backgroundSelect = document.querySelector("#backgroundAssetSelect");
  const backgroundLayer = document.querySelector("#backgroundLayer");
  const previewBackground = document.querySelector("#previewBackground");

  if (!looksPanel || !backgroundLayer) return;

  const defaultSettings = {
    mode: "cover",
    tileSize: 140,
  };

  function loadSettings() {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
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

  function applyLayout() {
    const targets = [backgroundLayer, previewBackground].filter(Boolean);
    const useTile = settings.mode === "tile" && selectedCustomBackground();

    targets.forEach((target) => {
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
  }

  function buildControls() {
    if (document.querySelector("#backgroundLayoutMode")) return;

    const card = document.createElement("div");
    card.className = "background-layout-card";
    card.innerHTML = `
      <strong>Background layout</strong>
      <label>
        Style
        <select id="backgroundLayoutMode">
          <option value="cover">Full screen cover</option>
          <option value="tile">Tile pattern</option>
        </select>
      </label>
      <label>
        Tile size
        <input id="backgroundTileSize" type="range" min="32" max="360" step="4" value="140" />
      </label>
      <p class="background-layout-help">Tile pattern works with uploaded image backgrounds. Preset backgrounds stay full screen.</p>
    `;

    const opacityLabel = document.querySelector("#backgroundOpacity")?.closest("label");
    looksPanel.insertBefore(card, opacityLabel || null);

    const mode = card.querySelector("#backgroundLayoutMode");
    const size = card.querySelector("#backgroundTileSize");
    mode.value = settings.mode;
    size.value = String(settings.tileSize);

    mode.addEventListener("change", () => {
      settings.mode = mode.value;
      saveSettings();
      applyLayout();
    });

    size.addEventListener("input", () => {
      settings.tileSize = Number(size.value) || defaultSettings.tileSize;
      saveSettings();
      applyLayout();
    });
  }

  backgroundSelect?.addEventListener("change", () => window.setTimeout(applyLayout, 0));
  document.querySelector("#previewBackgroundAssetButton")?.addEventListener("click", () => window.setTimeout(applyLayout, 0));
  document.querySelector("#clearBackgroundButton")?.addEventListener("click", () => window.setTimeout(applyLayout, 0));
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => window.setTimeout(applyLayout, 0));
  });

  const observer = new MutationObserver(() => applyLayout());
  observer.observe(backgroundLayer, { attributes: true, attributeFilter: ["style", "class"] });
  if (previewBackground) observer.observe(previewBackground, { attributes: true, attributeFilter: ["style", "class"] });

  buildControls();
  window.setTimeout(applyLayout, 0);
})();
