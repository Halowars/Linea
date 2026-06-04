(() => {
  if (window.LINEA_FIREBASE_CONFIG && !window.LINEA_FIREBASE_CONFIG_PRIVATE) {
    window.LINEA_FIREBASE_CONFIG_PRIVATE = window.LINEA_FIREBASE_CONFIG;
    try {
      delete window.LINEA_FIREBASE_CONFIG;
    } catch {
      window.LINEA_FIREBASE_CONFIG = undefined;
    }
  }

  if (!document.querySelector("#spellResults")) {
    const sink = document.createElement("div");
    sink.id = "spellResults";
    sink.hidden = true;
    sink.setAttribute("aria-hidden", "true");
    document.body.append(sink);
  }
})();
