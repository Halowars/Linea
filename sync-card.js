(() => {
  const card = document.querySelector(".account-card");
  const heading = document.querySelector(".account-card .account-heading");
  const status = document.querySelector("#accountStatus");
  const form = document.querySelector("#accountForm");
  const signedIn = document.querySelector("#accountSignedIn");
  const accountState = document.querySelector("#accountState");

  if (!card || !heading || !status) return;

  card.classList.add("sync-collapsible", "sync-collapsed");

  const dot = document.createElement("span");
  dot.className = "sync-status-dot";
  dot.title = "Sync offline";
  dot.setAttribute("aria-label", "Sync offline");
  heading.append(dot);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "sync-toggle-button";
  toggle.setAttribute("aria-label", "Expand optional sync");
  toggle.textContent = "+";
  heading.append(toggle);

  const body = document.createElement("div");
  body.className = "sync-card-body";
  const moveTargets = Array.from(card.children).filter((node) => node !== heading);
  moveTargets.forEach((node) => body.append(node));
  card.append(body);

  const details = document.createElement("div");
  details.className = "sync-diagnostic-row";
  details.innerHTML = `
    <button id="syncHelpButton" type="button">Check sync setup</button>
    <p class="sync-diagnostic-detail" id="syncDiagnosticDetail">Only expand this if sync is failing.</p>
  `;
  body.append(details);

  function setExpanded(expanded) {
    card.classList.toggle("sync-collapsed", !expanded);
    toggle.textContent = expanded ? "−" : "+";
    toggle.setAttribute("aria-label", expanded ? "Collapse optional sync" : "Expand optional sync");
  }

  function updateDot() {
    const text = `${status.textContent || ""} ${accountState?.textContent || ""}`.toLowerCase();
    const online = /draft sync is on|drafts synced|synced|syncing drafts/.test(text) && !/could not|lost|failed|error|local only|off/.test(text);
    const error = /could not|lost|failed|error|check firebase rules/.test(text);

    card.classList.toggle("sync-online", online && !error);
    card.classList.toggle("sync-error", error || !online);

    dot.title = online && !error ? "Sync online" : "Sync offline or needs attention";
    dot.setAttribute("aria-label", dot.title);
  }

  heading.addEventListener("click", (event) => {
    if (event.target.closest("button") && event.target !== toggle) return;
    setExpanded(card.classList.contains("sync-collapsed"));
  });

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setExpanded(card.classList.contains("sync-collapsed"));
  });

  form?.addEventListener("focusin", () => setExpanded(true));
  signedIn?.addEventListener("click", () => setExpanded(true));

  const originalStatusDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  if (originalStatusDescriptor?.set && originalStatusDescriptor?.get) {
    Object.defineProperty(status, "textContent", {
      get() {
        return originalStatusDescriptor.get.call(this);
      },
      set(value) {
        const text = String(value ?? "");
        if (/could not|check firebase rules|lost connection|failed|error/i.test(text)) {
          this.dataset.syncError = "true";
          setExpanded(true);
        } else {
          delete this.dataset.syncError;
        }
        originalStatusDescriptor.set.call(this, text);
        updateDot();
      },
    });
  }

  new MutationObserver(updateDot).observe(status, { childList: true, characterData: true, subtree: true });
  if (accountState) new MutationObserver(updateDot).observe(accountState, { childList: true, characterData: true, subtree: true });

  document.querySelector("#syncHelpButton")?.addEventListener("click", () => {
    const detail = document.querySelector("#syncDiagnosticDetail");
    const config = window.LINEA_FIREBASE_CONFIG || {};
    const checks = [];

    checks.push(config.apiKey ? "Firebase config loaded" : "Missing apiKey in firebase-config.js");
    checks.push(config.authDomain ? `Auth domain: ${config.authDomain}` : "Missing authDomain");
    checks.push(config.projectId ? `Project ID: ${config.projectId}` : "Missing projectId");
    checks.push(config.appId ? "App ID loaded" : "Missing appId");
    checks.push(location.hostname ? `Current domain: ${location.hostname}` : "No current hostname detected");
    checks.push("If login works but sync fails, Firestore rules or Firestore Database creation are the likely issue.");
    checks.push("The required path is users/{your uid}/drafts/current.");

    detail.textContent = checks.join(" • ");
  });

  updateDot();
})();
