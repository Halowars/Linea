(() => {
  const FIREBASE_SDK_VERSION = "10.12.5";
  const STORAGE_KEY = "linea-state-v1";
  const TOMBSTONE_PREFIX = "__deleted__::";
  const TOMBSTONE_TTL = 1000 * 60 * 60 * 24 * 30;

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

  const config = window.LINEA_FIREBASE_CONFIG_PRIVATE || window.LINEA_FIREBASE_CONFIG;
  if (!accountStatus || !config?.apiKey) return;

  let services = null;
  let currentUser = null;
  let unsubscribe = null;
  let applyingRemote = false;
  let pushTimer = 0;
  let lastCloudHash = "";
  let initialSyncComplete = false;
  let storageHookInstalled = false;

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

  function readRawState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
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

  function isTombstone(draft) {
    return Boolean(draft?.deletedDraftId || draft?.tombstone || String(draft?.id || "").startsWith(TOMBSTONE_PREFIX));
  }

  function tombstoneTargetId(draft) {
    if (!isTombstone(draft)) return "";
    return String(draft.deletedDraftId || String(draft.id || "").replace(TOMBSTONE_PREFIX, ""));
  }

  function tombstoneDraft(id, deletedAt = Date.now()) {
    return {
      id: `${TOMBSTONE_PREFIX}${id}`,
      title: "Deleted draft",
      html: "<p></p>",
      updatedAt: Number(deletedAt || Date.now()),
      deletedDraftId: String(id),
      deletedAt: Number(deletedAt || Date.now()),
      tombstone: true,
    };
  }

  function liveIdsFromRaw(raw) {
    return new Set(Array.isArray(raw?.drafts) ? raw.drafts.filter((d) => !isTombstone(d)).map((d) => String(d.id)) : []);
  }

  function deletedMapFrom(input) {
    const now = Date.now();
    const map = new Map();
    const add = (id, at = now) => {
      if (!id) return;
      const deletedAt = Number(at || now);
      if (now - deletedAt > TOMBSTONE_TTL) return;
      const previous = map.get(String(id));
      if (!previous || deletedAt > previous) map.set(String(id), deletedAt);
    };

    if (Array.isArray(input?.deletedDraftIds)) input.deletedDraftIds.forEach((id) => add(id));
    if (input?.deletedDrafts && typeof input.deletedDrafts === "object") {
      Object.entries(input.deletedDrafts).forEach(([id, at]) => add(id, at));
    }
    if (Array.isArray(input?.drafts)) {
      input.drafts.forEach((draft) => {
        if (isTombstone(draft)) add(tombstoneTargetId(draft), draft.deletedAt || draft.updatedAt);
      });
    }
    return map;
  }

  function normalizeDraft(draft) {
    if (!draft?.id || isTombstone(draft)) return null;
    const html = cleanHtml(draft.html || "<p></p>");
    return {
      id: String(draft.id),
      title: String(draft.title || titleFromHtml(html)).slice(0, 120),
      html,
      updatedAt: Number(draft.updatedAt || Date.now()),
    };
  }

  function normalizePayload(payload) {
    const deleted = deletedMapFrom(payload);
    const drafts = Array.isArray(payload?.drafts)
      ? payload.drafts.map(normalizeDraft).filter(Boolean).filter((draft) => !deleted.has(draft.id))
      : [];
    drafts.sort((a, b) => b.updatedAt - a.updatedAt);
    const capped = drafts.slice(0, 200);
    const activeDraftId = capped.some((draft) => draft.id === payload?.activeDraftId)
      ? String(payload.activeDraftId)
      : capped[0]?.id || "";
    return { activeDraftId, drafts: capped, deletedDrafts: Object.fromEntries(deleted) };
  }

  function withCloudTombstones(payload) {
    const normalized = normalizePayload(payload);
    const tombstones = Object.entries(normalized.deletedDrafts || {}).map(([id, deletedAt]) => tombstoneDraft(id, deletedAt));
    return {
      activeDraftId: normalized.activeDraftId,
      drafts: [...normalized.drafts, ...tombstones].slice(0, 240),
      deletedDrafts: normalized.deletedDrafts || {},
    };
  }

  function writeRawDrafts(payload) {
    const normalized = normalizePayload(payload);
    const raw = readRawState();
    raw.activeDraftId = normalized.activeDraftId;
    raw.drafts = normalized.drafts;
    raw.deletedDrafts = normalized.deletedDrafts || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  }

  function currentEditorDraft(raw) {
    const activeId = raw.activeDraftId;
    const active = Array.isArray(raw.drafts) ? raw.drafts.find((draft) => draft.id === activeId) : null;
    const deleted = deletedMapFrom(raw);
    if (!active || deleted.has(String(active.id)) || !editor) return null;

    const html = cleanHtml(editor.innerHTML || active.html || "<p></p>");
    const title = titleFromHtml(html, active.title);
    const sameHtml = html === cleanHtml(active.html || "<p></p>");
    const sameTitle = title === String(active.title || "Untitled story").slice(0, 120);
    return { ...active, title, html, updatedAt: sameHtml && sameTitle ? Number(active.updatedAt || Date.now()) : Date.now() };
  }

  function localStatePayload() {
    const raw = readRawState();
    const deleted = deletedMapFrom(raw);
    let drafts = Array.isArray(raw.drafts) ? raw.drafts.filter((draft) => !isTombstone(draft) && !deleted.has(String(draft.id))) : [];
    const live = currentEditorDraft(raw);
    if (live) drafts = drafts.map((draft) => (draft.id === live.id ? live : draft));
    return normalizePayload({ activeDraftId: raw.activeDraftId, drafts, deletedDrafts: Object.fromEntries(deleted) });
  }

  function mergePayloads(localPayload, cloudPayloadValue) {
    const local = normalizePayload(localPayload);
    const cloud = normalizePayload(cloudPayloadValue);
    const deleted = new Map([...Object.entries(cloud.deletedDrafts || {}), ...Object.entries(local.deletedDrafts || {})]);
    const draftsById = new Map();
    [...cloud.drafts, ...local.drafts].forEach((draft) => {
      if (deleted.has(draft.id)) return;
      const previous = draftsById.get(draft.id);
      if (!previous || draft.updatedAt >= previous.updatedAt) draftsById.set(draft.id, draft);
    });
    const drafts = [...draftsById.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200);
    const activeDraftId = drafts.some((draft) => draft.id === local.activeDraftId)
      ? local.activeDraftId
      : drafts.some((draft) => draft.id === cloud.activeDraftId)
        ? cloud.activeDraftId
        : drafts[0]?.id || "";
    return normalizePayload({ activeDraftId, drafts, deletedDrafts: Object.fromEntries(deleted) });
  }

  function payloadHash(payload) {
    const normalized = normalizePayload(payload);
    return JSON.stringify({
      activeDraftId: normalized.activeDraftId,
      deletedDrafts: normalized.deletedDrafts || {},
      drafts: normalized.drafts.map((draft) => ({ id: draft.id, title: draft.title, html: draft.html })),
    });
  }

  function payloadSize(payload) {
    return new Blob([JSON.stringify(withCloudTombstones(payload))]).size;
  }

  function applyPayload(payload) {
    const normalized = normalizePayload(payload);
    if (payloadHash(localStatePayload()) === payloadHash(normalized)) return false;
    applyingRemote = true;
    writeRawDrafts(normalized);
    if (normalized.drafts.length && typeof applyDraftPayload === "function") {
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
    }, 150);
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
    const cloudPayload = withCloudTombstones(payload);
    if (!cloudPayload.drafts.length) return;
    if (payloadSize(cloudPayload) > 900_000) throw Object.assign(new Error("Cloud draft document is too large"), { code: "linea/document-too-large" });
    await services.setDoc(cloudRef(), {
      activeDraftId: cloudPayload.activeDraftId,
      drafts: cloudPayload.drafts,
      updatedAt: services.serverTimestamp(),
    });
    lastCloudHash = payloadHash(cloudPayload);
  }

  async function syncNow(label = true, preferCloud = true) {
    if (!currentUser || !services) return;
    try {
      if (label) setStatus("Syncing drafts...");
      const snap = await services.getDoc(cloudRef());
      const local = localStatePayload();
      const cloud = snap.exists() ? normalizePayload(snap.data()) : normalizePayload({ drafts: [] });
      const cloudHasState = cloud.drafts.length || Object.keys(cloud.deletedDrafts || {}).length;
      const next = preferCloud && cloudHasState ? mergePayloads({ drafts: [], deletedDrafts: local.deletedDrafts }, cloud) : local;
      const changedLocal = preferCloud && cloudHasState ? applyPayload(next) : false;
      await writeCloud(next);
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
    initialSyncComplete = false;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (!user) {
      setOnlineState(false);
      setStatus("Log in only if you want drafts across devices.");
      return;
    }
    try {
      await loadServices();
      await syncNow(false, true);
      initialSyncComplete = true;
      unsubscribe = services.onSnapshot(
        cloudRef(),
        { includeMetadataChanges: false },
        (snapshot) => {
          if (!snapshot.exists() || snapshot.metadata.hasPendingWrites || applyingRemote || !initialSyncComplete) return;
          try {
            const remote = normalizePayload(snapshot.data());
            const remoteHash = payloadHash(remote);
            if (remoteHash === lastCloudHash) return;
            lastCloudHash = remoteHash;
            const changedLocal = applyPayload(remote);
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

  function schedulePush(delay = 250) {
    if (!currentUser || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(async () => {
      try {
        const next = localStatePayload();
        if (payloadHash(next) === lastCloudHash) {
          setStatus("Drafts synced.");
          return;
        }
        setStatus("Syncing drafts...");
        await writeCloud(next);
        setOnlineState(true);
        setStatus("Drafts synced.");
      } catch (error) {
        setOnlineState(false);
        setStatus(`Could not sync drafts: ${code(error)}`, true);
      }
    }, delay);
  }

  function installStorageHook() {
    if (storageHookInstalled) return;
    storageHookInstalled = true;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      const before = key === STORAGE_KEY && this === localStorage ? readRawState() : null;
      const beforeIds = before ? liveIdsFromRaw(before) : null;
      const result = originalSetItem.apply(this, arguments);
      if (key === STORAGE_KEY && this === localStorage && beforeIds && !applyingRemote) {
        const after = readRawState();
        const afterIds = liveIdsFromRaw(after);
        const deleted = { ...(after.deletedDrafts || {}) };
        let changed = false;
        beforeIds.forEach((id) => {
          if (!afterIds.has(id)) {
            deleted[id] = Date.now();
            changed = true;
          }
        });
        if (changed) {
          after.deletedDrafts = deleted;
          after.drafts = Array.isArray(after.drafts) ? after.drafts.filter((draft) => !deleted[String(draft.id)]) : [];
          originalSetItem.call(this, key, JSON.stringify(after));
          window.setTimeout(() => schedulePush(100), 0);
        }
      }
      return result;
    };
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
    syncNow(true, true).catch(() => {});
  }, true);

  installStorageHook();
  editor?.addEventListener("input", () => schedulePush(250));
  document.querySelector("#newDraftButton")?.addEventListener("click", () => window.setTimeout(() => schedulePush(450), 0));
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
        startSync(user);
      });
    })
    .catch((error) => setStatus(`Firebase setup failed: ${code(error)}`, true));
})();
