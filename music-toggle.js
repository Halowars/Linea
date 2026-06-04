(() => {
  const playButton = document.querySelector("#playPauseButton");
  const youtubePlayer = document.querySelector("#youtubePlayer");
  const musicStatus = document.querySelector("#musicStatus");
  const musicQueue = document.querySelector("#musicQueue");

  if (!playButton || !youtubePlayer) return;

  let ytPlayer = null;
  let apiReadyPromise = null;
  let activeVideoId = "";
  let isPlaying = false;

  function getActiveSong() {
    try {
      return state?.music?.queue?.[state.music.activeIndex] || null;
    } catch {
      return null;
    }
  }

  function setButtonState(playing) {
    isPlaying = playing;
    playButton.classList.toggle("is-playing", playing);
    playButton.classList.toggle("is-paused", !playing);
    playButton.title = playing ? "Pause" : "Play";
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiReadyPromise) return apiReadyPromise;

    apiReadyPromise = new Promise((resolve) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        resolve();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.append(script);
      }
    });

    return apiReadyPromise;
  }

  async function loadPlayer(song, autoplay = false) {
    if (!song?.videoId) return;
    await loadYouTubeApi();

    if (ytPlayer && activeVideoId === song.videoId) {
      if (autoplay) ytPlayer.playVideo();
      return;
    }

    if (ytPlayer?.destroy) {
      try {
        ytPlayer.destroy();
      } catch {}
    }

    youtubePlayer.innerHTML = '<div id="youtubeIframeTarget"></div>';
    activeVideoId = song.videoId;

    ytPlayer = new YT.Player("youtubeIframeTarget", {
      videoId: song.videoId,
      playerVars: {
        rel: 0,
        playsinline: 1,
        origin: location.origin && location.origin !== "null" ? location.origin : undefined,
      },
      events: {
        onReady: (event) => {
          if (autoplay) event.target.playVideo();
        },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            setButtonState(true);
            if (musicStatus) musicStatus.textContent = "Playing selected YouTube song.";
          }

          if (event.data === YT.PlayerState.PAUSED) {
            setButtonState(false);
            if (musicStatus) musicStatus.textContent = "Paused.";
          }

          if (event.data === YT.PlayerState.ENDED) {
            setButtonState(false);
            playNextAfterEnd();
          }
        },
        onError: () => {
          setButtonState(false);
          if (musicStatus) musicStatus.textContent = "That YouTube video could not be played here. Try another link.";
        },
      },
    });
  }

  async function play() {
    const song = getActiveSong();
    if (!song) {
      if (musicStatus) musicStatus.textContent = "Paste a YouTube link first.";
      return;
    }

    await loadPlayer(song, true);
    try {
      ytPlayer?.playVideo?.();
    } catch {}
    setButtonState(true);
  }

  function pause() {
    try {
      ytPlayer?.pauseVideo?.();
    } catch {}
    setButtonState(false);
    if (musicStatus) musicStatus.textContent = "Paused.";
  }

  function playNextAfterEnd() {
    try {
      const queue = state?.music?.queue || [];
      if (queue.length < 2) return;

      state.music.activeIndex = (state.music.activeIndex + 1) % queue.length;
      activeVideoId = "";
      renderMusic?.();
      saveSoon?.();
      window.setTimeout(() => play(), 80);
    } catch {}
  }

  playButton.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isPlaying) pause();
      else play();
    },
    true
  );

  musicQueue?.addEventListener("click", () => {
    activeVideoId = "";
    setButtonState(false);
  });

  setButtonState(false);
})();
