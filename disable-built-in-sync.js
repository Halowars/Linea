(() => {
  if (!window.LINEA_FIREBASE_CONFIG || window.LINEA_FIREBASE_CONFIG_PRIVATE) return;
  window.LINEA_FIREBASE_CONFIG_PRIVATE = window.LINEA_FIREBASE_CONFIG;
  try {
    delete window.LINEA_FIREBASE_CONFIG;
  } catch {
    window.LINEA_FIREBASE_CONFIG = undefined;
  }
})();
