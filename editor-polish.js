(() => {
  const editor = document.querySelector("#editor");
  const blockFormat = document.querySelector("#blockFormat");
  const fontSizeInput = document.querySelector("#fontSizeSelect");

  if (!editor) return;

  const originalSetTimeout = window.setTimeout;
  let preferredMode = blockFormat?.value || "p";

  window.setTimeout = function patchedSetTimeout(callback, delay, ...args) {
    const name = callback?.name || "";
    const source = typeof callback === "function" ? Function.prototype.toString.call(callback) : "";
    if (name === "runSpellCheck" || source.includes("stripSpell()") || source.includes("renderSpell(matches)")) return 0;
    return originalSetTimeout.call(window, callback, delay, ...args);
  };

  function removeSpellUi() {
    document.querySelector('[data-tab="spell"]')?.remove();
    document.querySelector('[data-panel="spell"]')?.remove();
    editor.querySelectorAll(".spell-error").forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
    editor.normalize();
  }

  function selectionInsideEditor() {
    const selection = getSelection();
    return Boolean(selection?.rangeCount && editor.contains(selection.anchorNode));
  }

  function currentBlock(node = getSelection()?.anchorNode) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element && element !== editor) {
      if (["P", "H1", "H2", "BLOCKQUOTE", "DIV", "LI"].includes(element.tagName)) return element;
      element = element.parentElement;
    }
    return null;
  }

  function normalizedMode(mode) {
    return { paragraph: "p", title: "h1", heading: "h2", quote: "blockquote" }[mode] || mode;
  }

  function blockTagForMode() {
    return ["p", "h1", "h2", "blockquote"].includes(preferredMode) ? preferredMode : "p";
  }

  function isEffectivelyEmpty() {
    return !editor.innerText.trim() || editor.innerHTML.trim() === "<br>" || editor.innerHTML.trim() === "";
  }

  function placeCaretEnd(element) {
    if (!element.firstChild) element.append(document.createElement("br"));
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function saveThroughApp() {
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatBlock" }));
  }

  function copyWritingHelpers(from, to) {
    if (from.classList.contains("double-space")) to.classList.add("double-space");
    if (from.classList.contains("double-spaced")) to.classList.add("double-spaced");
    if (from.classList.contains("hanging-indent")) to.classList.add("hanging-indent");
  }

  function makeFirstBlock(tag = blockTagForMode()) {
    const block = document.createElement(tag);
    block.append(document.createElement("br"));
    editor.innerHTML = "";
    editor.append(block);
    placeCaretEnd(block);
    if (blockFormat) blockFormat.value = tag;
    saveThroughApp();
    return block;
  }

  function ensureEditableBlock(tag = blockTagForMode()) {
    const block = currentBlock();
    if (block) return block;

    if (isEffectivelyEmpty() || getSelection()?.anchorNode === editor) {
      return makeFirstBlock(tag);
    }

    return null;
  }

  function replaceTag(block, tag, keepCaret = true) {
    if (!block || block.tagName.toLowerCase() === tag) return block;
    const next = document.createElement(tag);
    next.innerHTML = block.innerHTML || "<br>";
    next.className = block.className;
    block.replaceWith(next);
    if (keepCaret) placeCaretEnd(next);
    return next;
  }

  function setMode(mode, applyToCurrent = true) {
    preferredMode = normalizedMode(mode) || "p";
    const tag = blockTagForMode();
    if (blockFormat) blockFormat.value = tag;

    if (applyToCurrent) {
      editor.focus();
      const block = ensureEditableBlock(tag);
      if (block && block.tagName !== "LI") {
        const next = replaceTag(block, tag, true);
        if (next) next.style.fontSize = "";
        saveThroughApp();
      }
    }
  }

  function insertNextBlock(block) {
    const tag = blockTagForMode();
    const next = document.createElement(tag);
    next.append(document.createElement("br"));
    copyWritingHelpers(block, next);
    block.after(next);
    placeCaretEnd(next);
    if (blockFormat) blockFormat.value = tag;
    saveThroughApp();
  }

  function shortcutMode(event) {
    if ((!event.altKey && !(event.ctrlKey && event.shiftKey)) || event.metaKey) return "";
    const key = event.key.toLowerCase();
    return { p: "p", t: "h1", h: "h2", q: "blockquote" }[key] || "";
  }

  function handleShortcut(event) {
    const mode = shortcutMode(event);
    if (!mode) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    setMode(mode, true);
    return true;
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (handleShortcut(event)) return;

      if (!selectionInsideEditor()) return;
      const tag = blockTagForMode();

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        ensureEditableBlock(tag);
        return;
      }

      if (event.key !== "Enter" || event.shiftKey) return;
      const block = ensureEditableBlock(tag);
      if (!block) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      insertNextBlock(block);
    },
    true
  );

  blockFormat?.addEventListener(
    "pointerdown",
    () => {
      blockFormat.dataset.userChangingMode = "true";
    },
    true
  );

  blockFormat?.addEventListener(
    "keydown",
    () => {
      blockFormat.dataset.userChangingMode = "true";
    },
    true
  );

  blockFormat?.addEventListener(
    "change",
    () => {
      if (blockFormat.dataset.userChangingMode === "true") {
        setMode(blockFormat.value || "p", true);
      } else {
        blockFormat.value = preferredMode;
      }
      delete blockFormat.dataset.userChangingMode;
    },
    true
  );

  function keepDropdownHonest() {
    if (blockFormat && blockFormat.value !== preferredMode) blockFormat.value = preferredMode;
  }

  editor.addEventListener("focus", () => {
    ensureEditableBlock(blockTagForMode());
    keepDropdownHonest();
  });
  editor.addEventListener("keyup", keepDropdownHonest);
  editor.addEventListener("mouseup", keepDropdownHonest);
  document.addEventListener("selectionchange", () => {
    if (selectionInsideEditor()) keepDropdownHonest();
  });

  if (fontSizeInput) {
    fontSizeInput.addEventListener("change", () => {
      const numeric = Number(fontSizeInput.value);
      if (!Number.isFinite(numeric)) return;
      fontSizeInput.value = String(Math.max(8, Math.min(120, Math.round(numeric))));
    });
  }

  removeSpellUi();
  keepDropdownHonest();
})();
