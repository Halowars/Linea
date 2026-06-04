(() => {
  const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isTabletTouch = isIPad || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) >= 700);

  if (!isTabletTouch) return;

  document.body.classList.add("ipad-mode");

  const status = document.createElement("p");
  status.className = "ipad-status";
  status.textContent = "iPad mode: use Choose Images or Sounds for files. Tap Enable Sound before typing sounds.";

  const soundPanel = document.querySelector('[data-panel="sound"]');
  const filesPanel = document.querySelector('[data-panel="files"]');
  const assetDrop = document.querySelector("#assetDropZone");
  const assetInput = document.querySelector("#assetFileInput");
  const soundToggle = document.querySelector("#soundToggle");
  const volume = document.querySelector("#soundVolume");

  if (assetDrop) {
    const strong = assetDrop.querySelector("strong");
    const helper = assetDrop.querySelector("span");
    if (strong) strong.textContent = "Choose Images or Sounds";
    if (helper) helper.textContent = "PNG, JPG, GIF, MP3, M4A, WAV, AAC";
  }

  if (assetInput) {
    assetInput.setAttribute("accept", "image/*,audio/*,.gif,.mp3,.m4a,.wav,.aac,.ogg");
  }

  if (filesPanel && !filesPanel.querySelector(".ipad-status")) {
    filesPanel.insertBefore(status.cloneNode(true), filesPanel.children[1] || null);
  }

  function setStatus(message) {
    document.querySelectorAll(".ipad-status").forEach((node) => {
      node.textContent = message;
    });
  }

  function isAllowedAsset(file) {
    const name = (file.name || "").toLowerCase();
    const type = file.type || "";
    return (
      type.startsWith("image/") ||
      type.startsWith("audio/") ||
      /\.(gif|png|jpe?g|webp|mp3|m4a|wav|aac|ogg)$/i.test(name)
    );
  }

  assetInput?.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const unsupported = files.filter((file) => !isAllowedAsset(file));
    if (unsupported.length) {
      setStatus(`Unsupported file: ${unsupported[0].name}`);
      return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 4_500_000) {
      setStatus("That file is probably too large for browser storage. Try a smaller sound or image.");
      return;
    }

    setStatus(`Adding ${files.length} file${files.length === 1 ? "" : "s"}...`);
    window.setTimeout(() => {
      setStatus("File added. If it does not appear, try a smaller file or a different format.");
    }, 700);
  }, true);

  function unlockAudio() {
    try {
      if (soundToggle) soundToggle.checked = true;
      if (volume && Number(volume.value) < 75) {
        volume.value = "75";
        volume.dispatchEvent(new Event("input", { bubbles: true }));
      }

      if (typeof playKeySound === "function") {
        playKeySound(true);
      } else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.18, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
        oscillator.frequency.setValueAtTime(900, context.currentTime);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.08);
      }

      setStatus("Typing sound enabled on this iPad.");
    } catch {
      setStatus("iPad blocked audio. Tap Enable Sound again after tapping inside the editor.");
    }
  }

  if (soundPanel && !document.querySelector(".ipad-enable-sound")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ipad-enable-sound";
    button.textContent = "Enable Sound on iPad";
    button.addEventListener("click", unlockAudio);
    soundPanel.insertBefore(button, soundPanel.children[1] || null);
    soundPanel.insertBefore(status.cloneNode(true), button.nextSibling);
  }
})();
