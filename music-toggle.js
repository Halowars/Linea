(() => {
  const playButton = document.querySelector("#playPauseButton");
  const youtubePlayer = document.querySelector("#youtubePlayer");
  const musicStatus = document.querySelector("#musicStatus");

  if (!playButton || !youtubePlayer) return;

  let isPlaying = false;
  let currentVideoId = "";

  function getActiveSong() {
    try {
      return state?.music?.queue?.[state.music.activeIndex] || null;
    } catch {
      return null;
    }
  }

  function getOriginParam() {
    if (!location.origin || location.origin === "null") return "";
    return `&origin=${encodeURIComponent(location.origin)}`;
  }

  function buildSrc(videoId, autoplay = false) {
    return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&enablejsapi=1${getOriginParam()}${autoplay ? "&autoplay=1" : ""}`;
  }

  function setButtonState(playing) {
    isPlaying = playing;
    playButton.classList.toggle("is-playing", playing);
    playButton.classList.toggle("is-paused", !playing);
    playButton.title = playing ? "Pause" : "Play";
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  function loadFrame(song, autoplay = false) {
    if (!song?.videoId) return null;
    let iframe = youtubePlayer.querySelector("iframe");
    if (!iframe || currentVideoId !== song.videoId) {
      youtubePlayer.innerHTML = `<iframe width="200" height="200" src="${buildSrc(song.videoId, autoplay)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      currentVideoId = song.videoId;
      iframe = youtubePlayer.querySelector("iframe");
    }
    return iframe;
  }

  function sendCommand(command) {
    const iframe = youtubePlayer.querySelector("iframe");
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "https://www.youtube.com"
    );
  }

  function play() {
    const song = getActiveSong();
    if (!song) {
      if (musicStatus) musicStatus.textContent = "Paste a YouTube link first.";
      return;
    }

    const iframeAlreadyLoaded = currentVideoId === song.videoId && youtubePlayer.querySelector("iframe");
    loadFrame(song, !iframeAlreadyLoaded);

    if (iframeAlreadyLoaded) {
      sendCommand("playVideo");
    }

    setButtonState(true);
    if (musicStatus) musicStatus.textContent = "Playing selected YouTube song.";
  }

  function pause() {
    sendCommand("pauseVideo");
    setButtonState(false);
    if (musicStatus) musicStatus.textContent = "Paused.";
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

  document.querySelector("#musicQueue")?.addEventListener("click", () => {
    setButtonState(false);
    const song = getActiveSong();
    currentVideoId = song?.videoId || "";
  });

  setButtonState(false);
})();
