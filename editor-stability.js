(() => {
  const editor = document.querySelector("#editor");
  const blockFormat = document.querySelector("#blockFormat");
  const fontSizeSelect = document.querySelector("#fontSizeSelect");
  const spellTab = document.querySelector('[data-tab="spell"]');
  const spellPanel = document.querySelector('[data-panel="spell"]');

  if (!editor) return;

  let preferredInlineSize = "";

  function removeSpellUi() {
    spellTab?.remove();
    spellPanel?.remove();
    document.querySelectorAll(".spell-error").forEach((span) => {
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

  function placeCaret(node, offset = 0) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeCaretEnd(element) {
    const range = document.createRange();
    if (!element.firstChild) element.append(document.createElement("br"));
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function notifyEdit() {
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
  }

  function cleanBlockStyle(block) {
    block.querySelectorAll(".spell-error").forEach((span) => span.replaceWith(document.createTextNode(span.textContent)));
    block.normalize();
  }

  function splitCurrentBlock() {
    const selection = getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return false;

    const block = currentBlock(selection.anchorNode);
    if (!block) return false;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();

    cleanBlockStyle(block);

    const tag = ["H1", "H2", "BLOCKQUOTE"].includes(block.tagName) ? "p" : block.tagName.toLowerCase();
    const next = document.createElement(tag);

    if (tag === "p" && preferredInlineSize) next.style.fontSize = `${preferredInlineSize}px`;
    if (tag !== "p" && block.style.fontSize) next.style.fontSize = block.style.fontSize;
    if (block.classList.contains("double-space")) next.classList.add("double-space");
    if (block.classList.contains("hanging-indent")) next.classList.add("hanging-indent");

    const after = range.cloneRange();
    after.setEndAfter(block.lastChild || block);
    const fragment = after.extractContents();
    next.append(fragment);
    if (!next.textContent.trim() && !next.querySelector("img,br")) next.append(document.createElement("br"));

    block.after(next);
    placeCaretEnd(next);

    if (blockFormat) blockFormat.value = tag === "p" ? "p" : tag;
    notifyEdit();
    return true;
  }

  function setInlineSize(size) {
    const numeric = Number(size);
    if (!Number.isFinite(numeric) || numeric < 8 || numeric > 120) return;
    preferredInlineSize = String(Math.round(numeric));

    const selection = getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      const block = currentBlock(selection.anchorNode);
      if (block) block.style.fontSize = `${preferredInlineSize}px`;
    } else {
      document.execCommand("fontSize", false, "7");
      editor.querySelectorAll('font[size="7"]').forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = `${preferredInlineSize}px`;
        while (font.firstChild) span.append(font.firstChild);
        font.replaceWith(span);
      });
    }

    notifyEdit();
  }

  function installCustomSizeInput() {
    if (!fontSizeSelect || document.querySelector("#customFontSizeInput")) return;

    const input = document.createElement("input");
    input.id = "customFontSizeInput";
    input.className = "custom-font-size-input";
    input.type = "number";
    input.min = "8";
    input.max = "120";
    input.step = "1";
    input.placeholder = "px";
    input.title = "Custom font size";
    input.setAttribute("aria-label", "Custom font size in pixels");
    fontSizeSelect.after(input);

    fontSizeSelect.addEventListener(
      "change",
      () => {
        if (fontSizeSelect.value) {
          input.value = fontSizeSelect.value;
          preferredInlineSize = fontSizeSelect.value;
        }
      },
      true
    );

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        setInlineSize(input.value);
        editor.focus();
      }
    });

    input.addEventListener("change", () => setInlineSize(input.value));
  }

  function resetHeadingDefaultsOnFormat() {
    blockFormat?.addEventListener(
      "change",
      () => {
        window.setTimeout(() => {
          const block = currentBlock();
          if (!block) return;
          if (["H1", "H2", "BLOCKQUOTE"].includes(block.tagName) && !preferredInlineSize) {
            block.style.fontSize = "";
            notifyEdit();
          }
        }, 0);
      },
      true
    );
  }

  removeSpellUi();
  installCustomSizeInput();
  resetHeadingDefaultsOnFormat();

  editor.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey || !selectionInsideEditor()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      splitCurrentBlock();
    },
    true
  );

  const observer = new MutationObserver(() => removeSpellUi());
  observer.observe(document.body, { childList: true, subtree: true });
})();
