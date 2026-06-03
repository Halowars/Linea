(() => {
  const editor = document.querySelector("#editor");
  const blockFormat = document.querySelector("#blockFormat");
  const formatColor = document.querySelector("#formatColor");
  const stats = document.querySelector("#stats");

  if (!editor) return;

  let savedSelectionRange = null;

  function cleanupSpellMarkup(root = editor) {
    root.querySelectorAll(".spell-error").forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent));
    });
    root.normalize();
  }

  function removeCustomSpellPanel() {
    document.querySelector('[data-tab="spell"]')?.remove();
    document.querySelector('[data-panel="spell"]')?.remove();
    const tabs = document.querySelector(".sidebar-tabs");
    if (tabs) tabs.style.gridTemplateColumns = "repeat(4, 1fr)";
  }

  function selectionIsInsideEditor(selection = window.getSelection()) {
    return Boolean(
      selection?.rangeCount &&
      editor.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    );
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selectionIsInsideEditor(selection)) return;
    savedSelectionRange = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editor.focus();
    if (!savedSelectionRange || !editor.contains(savedSelectionRange.commonAncestorContainer)) {
      savedSelectionRange = null;
      return false;
    }
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelectionRange);
    return true;
  }

  function editableBlockForNode(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (element && element !== editor) {
      if (["P", "H1", "H2", "BLOCKQUOTE", "DIV"].includes(element.tagName) && element.parentElement === editor) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  function selectedEditorBlocks(range) {
    if (range.collapsed) {
      const block = editableBlockForNode(range.startContainer);
      return block ? [block] : [];
    }

    return [...editor.querySelectorAll(":scope > p, :scope > h1, :scope > h2, :scope > blockquote, :scope > div")]
      .filter((block) => range.intersectsNode(block));
  }

  function replaceBlockTag(block, tagName) {
    if (block.tagName.toLowerCase() === tagName) return block;
    const replacement = document.createElement(tagName);
    while (block.firstChild) replacement.append(block.firstChild);
    block.replaceWith(replacement);
    return replacement;
  }

  function placeCaretInBlock(block) {
    const range = document.createRange();
    if (!block.firstChild) block.append(document.createElement("br"));
    range.selectNodeContents(block);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    saveSelection();
  }

  function sync() {
    cleanupSpellMarkup();
    window.syncEditorToState?.();
    window.renderDrafts?.();
    window.updateStats?.();
    window.updateBlockFormatControl?.();
    window.scheduleSave?.();
  }

  window.scheduleSpellCheck = () => {};
  window.runSpellCheck = () => cleanupSpellMarkup();

  window.cleanEditorHtml = () => {
    cleanupSpellMarkup();
    return editor.innerHTML;
  };

  window.saveEditorSelection = saveSelection;
  window.restoreEditorSelection = restoreSelection;

  window.applyBlockFormat = (tagName) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selectionIsInsideEditor(selection)) return;

    const range = selection.getRangeAt(0);
    const blocks = selectedEditorBlocks(range);
    if (!blocks.length) return;

    let caretBlock = null;
    blocks.forEach((block) => {
      const replacement = replaceBlockTag(block, tagName);
      if (!caretBlock && (range.collapsed || replacement.contains(selection.anchorNode))) {
        caretBlock = replacement;
      }
    });

    if (range.collapsed && caretBlock && !caretBlock.innerText.trim()) {
      placeCaretInBlock(caretBlock);
    } else {
      editor.focus();
      saveSelection();
    }

    sync();
  };

  window.runCommand = (command, value = null) => {
    restoreSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, value);
    editor.focus();
    saveSelection();
    sync();
  };

  window.insertParagraphAfter = (block) => {
    const paragraph = document.createElement("p");
    paragraph.append(document.createElement("br"));
    block.after(paragraph);
    placeCaretInBlock(paragraph);
    if (blockFormat) blockFormat.value = "p";
    sync();
  };

  window.handleBlockEnter = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return false;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed || !editor.contains(selection.anchorNode)) return false;
    const block = editableBlockForNode(selection.anchorNode);
    if (!block || !["H1", "H2", "BLOCKQUOTE"].includes(block.tagName)) return false;
    event.preventDefault();
    window.insertParagraphAfter(block);
    window.playKeySound?.();
    return true;
  };

  document.addEventListener("selectionchange", () => {
    if (selectionIsInsideEditor()) saveSelection();
  });

  editor.addEventListener("input", () => {
    cleanupSpellMarkup();
    saveSelection();
  });

  formatColor?.addEventListener("mousedown", saveSelection);
  blockFormat?.addEventListener("mousedown", saveSelection);

  cleanupSpellMarkup();
  removeCustomSpellPanel();
  editor.setAttribute("spellcheck", "true");
  if (stats && window.updateStats) window.updateStats();
})();
