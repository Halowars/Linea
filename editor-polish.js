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
    if (name === "runSpellCheck" || source.includes("stripSpell()") || source.includes("renderSpell(matches)")) {
      return 0;
    }
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

  function blockTagForMode() {
    return ["p", "h1", "h2", "blockquote"].includes(preferredMode) ? preferredMode : "p";
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
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
  }

  function copyWritingHelpers(from, to) {
    if (from.classList.contains("double-space")) to.classList.add("double-space");
    if (from.classList.contains("hanging-indent")) to.classList.add("hanging-indent");
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

  editor.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey || !selectionInsideEditor()) return;
      const block = currentBlock();
      if (!block) return;

      if (["H1", "H2", "BLOCKQUOTE"].includes(block.tagName) || blockTagForMode() !== "p") {
        event.preventDefault();
        event.stopImmediatePropagation();
        insertNextBlock(block);
      }
    },
    true
  );

  blockFormat?.addEventListener(
    "change",
    () => {
      preferredMode = blockFormat.value || "p";
      const requested = preferredMode;
      originalSetTimeout(() => {
        if (!["h1", "h2", "blockquote", "p"].includes(requested)) return;
        const selection = getSelection();
        if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
        const range = selection.getRangeAt(0);
        const blocks = Array.from(editor.children).filter((node) => {
          return ["P", "H1", "H2", "BLOCKQUOTE", "DIV"].includes(node.tagName) && range.intersectsNode(node);
        });
        const targets = blocks.length ? blocks : [currentBlock()].filter(Boolean);
        targets.forEach((block) => {
          if (["H1", "H2", "BLOCKQUOTE", "P"].includes(block.tagName)) block.style.fontSize = "";
        });
        saveThroughApp();
      }, 0);
    },
    true
  );

  editor.addEventListener("mouseup", () => {
    if (!blockFormat) return;
    const block = currentBlock();
    const tag = block?.tagName?.toLowerCase();
    if (["p", "h1", "h2", "blockquote"].includes(tag)) blockFormat.value = preferredMode;
  });

  if (fontSizeInput) {
    fontSizeInput.addEventListener("change", () => {
      const numeric = Number(fontSizeInput.value);
      if (!Number.isFinite(numeric)) return;
      const clamped = Math.max(8, Math.min(120, Math.round(numeric)));
      fontSizeInput.value = String(clamped);
    });
  }

  removeSpellUi();
})();
