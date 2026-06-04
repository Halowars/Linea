(() => {
  const FIREBASE_SDK_VERSION = "10.12.5";
  const STORAGE_KEY = "linea-state-v1";
  const accountForm = document.querySelector("#accountForm");
  const accountEmail = document.querySelector("#accountEmail");
  const accountPassword = document.querySelector("#accountPassword");
  const accountLoginButton = document.querySelector("#accountLoginButton");
  const accountCreateButton = document.querySelector("#accountCreateButton");
  const accountLogoutButton = document.querySelector("#accountLogoutButton");
  const syncNowButton = document.querySelector("#syncNowButton");
  const accountState = document.querySelector("#accountState");
  const accountSignedIn = document.querySelector("#accountSignedIn");
  const accountName = document.querySelector("#accountName");
  const accountStatus = document.querySelector("#accountStatus");
  const editor = document.querySelector("#editor");
  const draftList = document.querySelector("#draftList");

  const config = window.LINEA_FIREBASE_CONFIG_PRIVATE || window.LINEA_FIREBASE_CONFIG;
  if (!accountStatus || !config?.apiKey) return;

  let services = null;
  let currentUser = null;
  let unsubscribe = null;
  let applyingRemote = false;
  let pushTimer = 0;
  let lastCloudHash = "";
  let started = false;

  function setStatus(message, error = false) {
    accountStatus.textContent = message;
    accountStatus.dataset.syncError = error ? "true" : "false";
  }

  function setOnlineState(isOnline) {
    document.querySelector(".account-card")?.classList.toggle("sync-online", isOnline);
    document.querySelector(".account-card")?.classList.toggle("sync-error", !isOnline);
  }

  function setSignedInUI(user) {
    if (accountState) accountState.textContent = user ? "Synced" : "Local only";
    if (accountForm) accountForm.hidden = Boolean(user);
    if (accountSignedIn) accountSignedIn.hidden = !user;
    if (accountName) accountName.textContent = user?.email || "";
    [accountEmail, accountPassword, accountLoginButton, accountCreateButton, accountLogoutButton, syncNowButton].forEach((el) => {
      if (el) el.disabled = false;
    });
  }

  function code(error) {
    return error?.code || error?.name || error?.message || "unknown-error";
  }

  function cleanHtml(html) {
    const box = document.createElement("div");
    box.innerHTML = String(html || "<p></p>");
    box.querySelectorAll(".spell-error").forEach((span) => span.replaceWith(document.createTextNode(span.textContent)));
    return box.innerHTML || "<p></p>";
  }

  function titleFromHtml(html, fallback = "Untitled story") {
    const box = document.createElement("div");
    box.innerHTML = cleanHtml(html);
    return box.innerText.trim().split(/\n/).find(Boolean)?.slice(0, 120) || fallback;
  }

  function normalizeDraft(draft) {
    if (!draft?.id) return null;
    const html = cleanHtml(draft.html || "<p></p>");
    return {
      id: String(draft.id),
      title: String(draft.title || titleFromHtml(html)).slice(0, 120),
      html,
      updatedAt: Number(draft.updatedAt || Date.now()),
    };
  }

  function normalizePayload(payload) {
    const drafts = Array.isArray(payload?.drafts)
      ? payload.drafts.map(normalizeDraft).filter(Boolean)
      : [];
    drafts.sort((a, b) => b.updatedAt - a.updatedAt);
    const capped = drafts.slice(0, 200);
    const activeDraftId = capped.some((draft) => draft.id === payload?.activeDraftId)
      ? String(payload.activeDraftId)
      : capped[0]?.id || "";
    return { activeDraftId, drafts };
  }

  function readRawState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeRawDrafts(payload) {
    const normalized = normalizePayload(payload);
    const raw = readRawState();
    raw.activeDraftId = normalized.activeDraftId;
    raw.drafts = normalized.drafts;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  }

  function currentEditorDraft(raw) {
    const activeId = raw.activeDraftId;
    const active = Array.isArray(raw.drafts) ? raw.drafts.find((draft) => draft.id === activeId) : null;
    if (!active || !editor) return null;
    const html = cleanHtml(editor.innerHTML || active.html || "<p></p>");
    return {
      ...active,
      title: titleFromHtml(html, active.title),
      html,
      updatedAt: Date.now(),
    };
  }

  function localStatePayload() {
    const raw = readRawState();
    let drafts = Array.isArray(raw.drafts) ? raw.drafts.slice() : [];
    const live = currentEditorDraft(raw);
    if (live) drafts = drafts.map((draft) => (draft.id === live.id ? live : draft));
    return normalizePayload({ activeDraftId: raw.activeDraftId, drafts });
  }

  function isBlankStarter(payload) {
    const normalized = normalizePayload(payload);
    if (normalized.drafts.length !== 1) return false;
    const draft = normalized.drafts[0];
    const box = document.createElement("div");
    box.innerHTML = draft.html || "";
    return draft.title === "Untitled story" && !box.innerText.trim();
  }

  function mergePayloads(localPayload, cloudPayloadValue) {
    const local = normalizePayload(localPayload);
    const cloud = normalizePayload(cloudPayloadValue);
    const draftsById = new Map();
    [...cloud.drafts, ...local.drafts].forEach((draft) => {
      const previous = draftsById.get(draft.id);
      if (!previous || draft.updatedAt >= previous.updatedAt) draftsById.set(draft.id, draft);
    });
    const drafts = [...draftsById.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200);
    const localActiveExists = drafts.some((draft) => draft.id === local.activeDraftId);
    const cloudActiveExists = drafts.some((draft) => draft.id === cloud.activeDraftId);
    const activeDraftId = !isBlankStarter(local) && localActiveExists
      ? local.activeDraftId
      : cloudActiveExists
        ? cloud.activeDraftId
        : drafts[0]?.id || "";
    return normalizePayload({ activeDraftId, drafts });
  }

  function payloadHash(payload) {
    const normalized = normalizePayload(payload);
    return JSON.stringify({ activeDraftId: normalized.activeDraftId, drafts: normalized.drafts });
  }

  function payloadSize(payload) {
    return new Blob([JSON.stringify(normalizePayload(payload))]).size;
  }

  function applyPayload(payload) {
    const normalized = normalizePayload(payload);
    if (!normalized.drafts.length) return false;
    const localHash = payloadHash(localStatePayload());
    const incomingHash = payloadHash(normalized);
    if (localHash === incomingHash) return false;

    applyingRemote = true;
    writeRawDrafts(normalized);
    if (typeof applyDraftPayload === "function") {
      try {
        applyDraftPayload(normalized);
      } catch {
        location.reload();
      }
    } else {
      location.reload();
    }
    window.setTimeout(() => {
      applyingRemote = false;
    }, 250);
    return true;
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
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    services = {
      auth,
      db: dbMod.getFirestore(app),
      login: authMod.signInWithEmailAndPassword,
      create: authMod.createUserWithEmailAndPassword,
      logout: authMod.signOut,
      onAuth: authMod.onAuthStateChanged,
      doc: dbMod.doc,
      getDoc: dbMod.getDoc,
      setDoc: dbMod.setDoc,
      onSnapshot: dbMod.onSnapshot,
      serverTimestamp: dbMod.serverTimestamp,
    };
    return services;
  }

  function cloudRef() {
    return services.doc(services.db, "users", currentUser.uid, "drafts", "current");
  }

  async function writeCloud(payload = localStatePayload()) {
    if (!currentUser || !services || applyingRemote) return;
    const normalized = normalizePayload(payload);
    const size = payloadSize(normalized);
    if (size > 900_000) throw Object.assign(new Error("Cloud draft document is too large"), { code: "linea/document-too-large" });
    await services.setDoc(cloudRef(), {
      activeDraftId: normalized.activeDraftId,
      drafts: normalized.drafts,
      updatedAt: services.serverTimestamp(),
    });
    lastCloudHash = payloadHash(normalized);
  }

  async function syncNow(label = true) {
    if (!currentUser || !services) return;
    try {
      if (label) setStatus("Syncing drafts...");
      const snap = await services.getDoc(cloudRef());
      const local = localStatePayload();
      const cloud = snap.exists() ? snap.data() : { drafts: [] };
      const merged = mergePayloads(local, cloud);
      const changedLocal = applyPayload(merged);
      await writeCloud(merged);
      setOnlineState(true);
      if (!changedLocal) setStatus("Drafts synced.");
    } catch (error) {
      setOnlineState(false);
      setStatus(`Could not sync drafts: ${code(error)}`, true);
      throw error;
    }
  }

  async function startSync(user) {
    currentUser = user;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (!user) {
      setOnlineState(false);
      setStatus("Log in only if you want drafts across devices.");
      return;
    }
    try {
      await loadServices();
      await syncNow(false);
      unsubscribe = services.onSnapshot(
        cloudRef(),
        { includeMetadataChanges: false },
        async (snapshot) => {
          if (!snapshot.exists() || snapshot.metadata.hasPendingWrites || applyingRemote) return;
          try {
            const local = localStatePayload();
            const remote = snapshot.data();
            const merged = mergePayloads(local, remote);
            const mergedHash = payloadHash(merged);
            if (mergedHash !== payloadHash(remote)) await writeCloud(merged);
            const changedLocal = mergedHash !== payloadHash(local) ? applyPayload(merged) : false;
            setOnlineState(true);
            if (!changedLocal) setStatus("Drafts synced.");
          } catch (error) {
            setOnlineState(false);
            setStatus(`Cloud sync issue: ${code(error)}`, true);
          }
        },
        (error) => {
          setOnlineState(false);
          setStatus(`Cloud sync lost connection: ${code(error)}`, true);
        }
      );
      setOnlineState(true);
      setStatus("Drafts synced.");
    } catch (error) {
      setOnlineState(false);
      setStatus(`Could not start cloud sync: ${code(error)}`, true);
    }
  }

  function schedulePush() {
    if (!currentUser || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => syncNow(false).catch(() => {}), 900);
  }

  async function login(createAccount = false) {
    try {
      const email = accountEmail?.value.trim().toLowerCase();
      const password = accountPassword?.value || "";
      if (!email || !password) {
        setStatus("Enter an email and password.", true);
        return;
      }
      const s = await loadServices();
      setStatus(createAccount ? "Creating account..." : "Logging in...");
      if (createAccount) await s.create(s.auth, email, password);
      else await s.login(s.auth, email, password);
      if (accountPassword) accountPassword.value = "";
    } catch (error) {
      setOnlineState(false);
      setStatus(`${createAccount ? "Could not create account" : "Could not log in"}: ${code(error)}`, true);
    }
  }

  accountForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    login(false);
  }, true);
  accountCreateButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    login(true);
  }, true);
  accountLogoutButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const s = await loadServices();
      await s.logout(s.auth);
    } catch (error) {
      setStatus(`Could not log out: ${code(error)}`, true);
    }
  }, true);
  syncNowButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    syncNow(true).catch(() => {});
  }, true);

  editor?.addEventListener("input", schedulePush);
  draftList?.addEventListener("click", () => window.setTimeout(schedulePush, 0));
  document.querySelector("#newDraftButton")?.addEventListener("click", () => window.setTimeout(schedulePush, 0));
  window.addEventListener("beforeunload", () => {
    if (currentUser && services) writeCloud(localStatePayload()).catch(() => {});
  });

  [accountEmail, accountPassword, accountLoginButton, accountCreateButton].forEach((el) => {
    if (el) el.disabled = false;
  });
  setStatus("Log in only if you want drafts across devices.");

  loadServices()
    .then((s) => {
      s.onAuth(s.auth, (user) => {
        currentUser = user;
        setSignedInUI(user);
        if (!user) {
          if (unsubscribe) unsubscribe();
          unsubscribe = null;
          setOnlineState(false);
          setStatus("Log in only if you want drafts across devices.");
          return;
        }
        if (!started) {
          started = true;
          startSync(user);
        } else {
          startSync(user);
        }
      });
    })
    .catch((error) => setStatus(`Firebase setup failed: ${code(error)}`, true));
})();
