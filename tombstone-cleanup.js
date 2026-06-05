(() => {
  const STORAGE_KEY = "linea-state-v1";
  const TOMBSTONE_PREFIX = "__deleted__::";

  function isTombstone(draft) {
    return Boolean(
      draft?.deletedDraftId ||
      draft?.tombstone ||
      String(draft?.id || "").startsWith(TOMBSTONE_PREFIX) ||
      String(draft?.title || "").trim().toLowerCase() === "deleted draft"
    );
  }

  function cleanState() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return false;
    }

    if (!Array.isArray(raw.drafts)) return false;

    const beforeLength = raw.drafts.length;
    raw.drafts = raw.drafts.filter((draft) => !isTombstone(draft));

    if (raw.activeDraftId && !raw.drafts.some((draft) => draft.id === raw.activeDraftId)) {
      raw.activeDraftId = raw.drafts[0]?.id || "";
    }

    if (raw.drafts.length !== beforeLength) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
      return true;
    }

    return false;
  }

  function hideRenderedTombstones() {
    document.querySelectorAll("#draftList button, #draftList [role='button'], #draftList .draft-item").forEach((item) => {
      const text = item.textContent?.trim().toLowerCase() || "";
      if (text === "deleted draft" || text.includes("deleted draft")) item.remove();
    });
  }

  const changed = cleanState();
  hideRenderedTombstones();

  const draftList = document.querySelector("#draftList");
  if (draftList) {
    new MutationObserver(() => {
      cleanState();
      hideRenderedTombstones();
    }).observe(draftList, { childList: true, subtree: true });
  }

  if (changed) window.setTimeout(() => location.reload(), 100);
})();
