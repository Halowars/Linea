(() => {
  const FIREBASE_SDK_VERSION = "10.12.5";
  const STORAGE_KEY = "linea-state-v1";
  const config = window.LINEA_FIREBASE_CONFIG_PRIVATE || window.LINEA_FIREBASE_CONFIG;
  if (!config?.apiKey || window.__lineaCloudWriteThroughInstalled) return;
  window.__lineaCloudWriteThroughInstalled = true;

  let services = null;
  let user = null;
  let lastIds = idsFromState(readState());
  let pushTimer = 0;

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function idsFromState(state) {
    return new Set(Array.isArray(state?.drafts) ? state.drafts.map((draft) => String(draft.id)) : []);
  }

  function hasDeletion(before, after) {
    for (const id of before) {
      if (!after.has(id)) return true;
    }
    return false;
  }

  function cleanHtml(html) {
    const box = document.createElement("div");
    box.innerHTML = String(html || "<p></p>");
    box.querySelectorAll(".spell-error").forEach((span) => span.replaceWith(document.createTextNode(span.textContent)));
    return box.innerHTML || "<p></p>";
  }

  function normalizePayload(state) {
    const drafts = Array.isArray(state?.drafts)
      ? state.drafts
          .filter((draft) => draft?.id)
          .map((draft) => ({
            id: String(draft.id),
            title: String(draft.title || "Untitled story").slice(0, 120),
            html: cleanHtml(draft.html || "<p></p>"),
            updatedAt: Number(draft.updatedAt || Date.now()),
          }))
      : [];

    drafts.sort((a, b) => b.updatedAt - a.updatedAt);
    const activeDraftId = drafts.some((draft) => draft.id === state?.activeDraftId)
      ? String(state.activeDraftId)
      : drafts[0]?.id || "";

    return { activeDraftId, drafts: drafts.slice(0, 200) };
  }

  async function loadServices() {
    if (services) return services;
    const [appMod, authMod, dbMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
    const auth = authMod.getAuth(app);
    services = {
      auth,
      db: dbMod.getFirestore(app),
      doc: dbMod.doc,
      setDoc: dbMod.setDoc,
      serverTimestamp: dbMod.serverTimestamp,
      onAuth: authMod.onAuthStateChanged,
    };
    services.onAuth(auth, (nextUser) => {
      user = nextUser;
    });
    return services;
  }

  async function pushCurrentState(reason = "change") {
    const s = await loadServices();
    if (!user) return;
    const payload = normalizePayload(readState());
    if (!payload.drafts.length) return;
    await s.setDoc(s.doc(s.db, "users", user.uid, "drafts", "current"), {
      activeDraftId: payload.activeDraftId,
      drafts: payload.drafts,
      updatedAt: s.serverTimestamp(),
      writeReason: reason,
    });
  }

  function scheduleWrite(reason, delay = 70) {
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => pushCurrentState(reason).catch(() => {}), delay);
  }

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function lineaWriteThroughSetItem(key, value) {
    const before = key === STORAGE_KEY && this === localStorage ? lastIds : null;
    const result = originalSetItem.apply(this, arguments);
    if (key === STORAGE_KEY && this === localStorage) {
      const after = idsFromState(readState());
      const deleted = before ? hasDeletion(before, after) : false;
      lastIds = after;
      if (deleted) scheduleWrite("delete", 20);
    }
    return result;
  };

  document.querySelector("#draftList")?.addEventListener(
    "click",
    () => window.setTimeout(() => {
      const currentIds = idsFromState(readState());
      if (hasDeletion(lastIds, currentIds)) {
        lastIds = currentIds;
        scheduleWrite("delete", 20);
      }
    }, 0),
    true
  );

  loadServices().catch(() => {});
})();
