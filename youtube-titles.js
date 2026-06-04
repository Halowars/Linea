(() => {
  const form = document.querySelector("#musicAddForm");
  const input = document.querySelector("#musicUrlInput");
  const status = document.querySelector("#musicStatus");

  if (!form || !input) return;

  function extractVideoId(value) {
    const text = value.trim();
    if (/^[\w-]{11}$/.test(text)) return text;
    try {
      const url = new URL(text);
      if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).split("/")[0];
      if (url.hostname.includes("youtube.com")) {
        return url.searchParams.get("v") || url.pathname.match(/\/(shorts|embed)\/([\w-]{11})/)?.[2] || "";
      }
    } catch {
      return "";
    }
    return "";
  }

  async function fetchYouTubeTitle(videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Could not fetch title");
    const data = await response.json();
    return {
      title: data.title || "Untitled YouTube video",
      artist: data.author_name || "YouTube",
    };
  }

  function saveState() {
    try {
      sync?.();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      localStorage.setItem("linea-state-v1", JSON.stringify(state));
    }
  }

  function refreshMusicUi() {
    renderMusic?.();
    saveSoon?.();
  }

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const videoId = extractVideoId(input.value || "");
      if (!videoId) {
        if (status) status.textContent = "Paste a valid YouTube link.";
        return;
      }

      if (status) status.textContent = "Getting YouTube title...";

      let metadata;
      try {
        metadata = await fetchYouTubeTitle(videoId);
      } catch {
        metadata = {
          title: `YouTube video (${videoId})`,
          artist: "YouTube",
        };
        if (status) status.textContent = "Added video, but YouTube did not return a title.";
      }

      state.music.queue.push({
        id: crypto.randomUUID(),
        videoId,
        title: metadata.title,
        artist: metadata.artist,
        addedAt: Date.now(),
      });
      state.music.activeIndex = state.music.queue.length - 1;
      input.value = "";

      refreshMusicUi();
      saveState();

      if (status) status.textContent = `Added: ${metadata.title}`;
    },
    true
  );
})();
