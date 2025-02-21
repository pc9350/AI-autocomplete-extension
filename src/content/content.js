class UniversalAutocomplete {
  constructor() {
    this.model = new window.GeminiNano();
    this.suggestion = "";
    this.ghostOverlay = null;
    this.currentElement = null;
    this.setupListeners();
    this.setupGoogleDocsListener();
    console.log("UniversalAutocomplete initialized");
  }

  setupListeners() {
    document.addEventListener("focusin", (e) => this.handleFocus(e));
    document.addEventListener("input", (e) => this.handleInput(e));
    document.addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  handleFocus(event) {
    const element = event.target;
    if (this.isValidInput(element)) {
      this.currentElement = element;
      console.log("Focused on:", element.tagName);
    }
  }

  async handleInput(event) {
    const element = event.target;
    if (!this.isValidInput(element)) return;

    console.log("Handling input for:", element.id);
    this.currentElement = element;
    const text = this.getTextFromElement(element);

    if (!text.trim()) {
      this.clearGhostOverlay();
      return;
    }

    const suggestion = await this.getSuggestion(text);
    console.log("Got suggestion:", suggestion);

    if (suggestion) {
      this.suggestion = suggestion;
      // Use the updated styling for the ghost overlay
      this.showGhostOverlay(element, suggestion);
    } else {
      this.clearGhostOverlay();
    }
  }

  // Utility to measure text width using a canvas
  measureTextWidth(text, element) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const style = window.getComputedStyle(element);
    ctx.font = `${style.fontSize} ${style.fontFamily}`;
    const metrics = ctx.measureText(text);
    return metrics.width + 4; // small extra padding
  }

  handleKeydown(event) {
    if (event.key === "Tab" && this.suggestion) {
      event.preventDefault();
      this.acceptSuggestion(this.currentElement);
    } else if (event.key === "Escape") {
      this.clearGhostOverlay();
    }
  }

  async getSuggestion(text) {
    try {
      const context = { text: text, cursorPosition: text.length };
      const response = await this.model.getSuggestion(context);
      return response || null;
    } catch (error) {
      console.error("Autocomplete error:", error);
      return null;
    }
  }

  // This method creates an overlay with styling similar to GhostText.js.
  // It positions the overlay at the end of the current text (i.e. after the caret).
  showGhostOverlay(element, suggestion) {
    this.clearGhostOverlay();
    const overlay = document.createElement("div");
    overlay.textContent = suggestion;
    overlay.style.position = "absolute";
    overlay.style.display = "block";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "1000";
    overlay.style.whiteSpace = "pre";
    overlay.style.overflow = "hidden";
    overlay.style.textOverflow = "ellipsis";
    // Ghost styling: gray, italic text.
    overlay.style.color = "gray";
    overlay.style.opacity = "0.6";
    overlay.style.fontStyle = "italic";

    let caretRect = null;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      // Get the text before the cursor
      const textBeforeCursor = element.value.substring(
        0,
        element.selectionStart
      );
      const style = window.getComputedStyle(element);
      // Use padding values directly for better alignment with the text
      const paddingTop = parseInt(style.paddingTop) || 0;
      const paddingLeft = parseInt(style.paddingLeft) || 0;
      const textWidth = this.measureTextWidth(textBeforeCursor, element);
      const rect = element.getBoundingClientRect();
      // Position at the same line: start at element's top plus paddingTop, and left offset by paddingLeft + textWidth.
      caretRect = {
        top: rect.top + paddingTop,
        left: rect.left + paddingLeft + textWidth,
      };
      // Apply font styles so the overlay matches the input exactly
      overlay.style.fontSize = style.fontSize;
      overlay.style.fontFamily = style.fontFamily;
      overlay.style.lineHeight = style.lineHeight;
    } else if (element.isContentEditable) {
      // For contenteditable elements, use the current selection's range.
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        caretRect = range.getBoundingClientRect();
      }
    }

    if (caretRect) {
      overlay.style.top = `${caretRect.top + window.scrollY}px`;
      overlay.style.left = `${caretRect.left + window.scrollX}px`;
    }
    document.body.appendChild(overlay);
    this.ghostOverlay = overlay;

    console.log("Ghost overlay created:", {
      suggestion,
      position: { top: overlay.style.top, left: overlay.style.left },
    });
  }

  // When the user presses Tab, accept the suggestion.
  // For inputs and contenteditable, the suggestion is inserted normally.
  acceptSuggestion(element) {
    if (!this.suggestion) return;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const pos = element.selectionStart;
      const before = element.value.substring(0, pos);
      const after = element.value.substring(pos);
      // Insert suggestion in normal (black) text.
      element.value = before + this.suggestion + after;
      const newPos = pos + this.suggestion.length;
      element.setSelectionRange(newPos, newPos);
    } else if (element.isContentEditable) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const textNode = document.createTextNode(this.suggestion);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    this.clearGhostOverlay();
    this.suggestion = "";
  }

  clearGhostOverlay() {
    if (this.ghostOverlay) {
      this.ghostOverlay.remove();
      this.ghostOverlay = null;
    }
  }

  getTextFromElement(element) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      return element.value;
    } else if (element.isContentEditable) {
      return element.innerText;
    }
    return "";
  }

  isValidInput(element) {
    const tagName = element.tagName.toLowerCase();
    const isValid =
      (tagName === "input" ||
        tagName === "textarea" ||
        element.isContentEditable ||
        element.classList.contains("ProseMirror") ||
        element.classList.contains("kix-canvas") || // Google Docs
        element.classList.contains("ql-editor") || // Quill
        element.classList.contains("CodeMirror-code") || // CodeMirror
        element.classList.contains("monaco-editor") ||
        element.id === "textarea__editor") && // Specific to your project
      !element.readOnly &&
      element.type !== "password";

    if (isValid) {
      console.log("Valid input detected:", {
        tagName: tagName,
        id: element.id,
        classList: Array.from(element.classList),
        isContentEditable: element.isContentEditable,
      });
    }
    return isValid;
  }

  // Compute caret coordinates for input/textarea using a mirror div
  getCaretCoordinates(element, position) {
    const div = document.createElement("div");
    const style = window.getComputedStyle(element);
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.whiteSpace = "pre-wrap";
    div.style.font = style.font;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.overflow = "auto";
    div.style.width = element.offsetWidth + "px";
    div.textContent = element.value.substring(0, position);
    document.body.appendChild(div);
    const span = document.createElement("span");
    span.textContent = element.value.substring(position) || ".";
    div.appendChild(span);
    const rect = span.getBoundingClientRect();
    document.body.removeChild(div);
    return rect;
  }

  // Google Docs handling: detect and attach additional listeners.
  setupGoogleDocsListener() {
    if (window.location.hostname === "docs.google.com") {
      console.log("Google Docs detected");
      const observer = new MutationObserver(() => {
        const editor = document.querySelector(".kix-canvas-tile-content");
        if (editor) {
          console.log("Google Docs editor found");
          observer.disconnect();
          this.setupGoogleDocsHandlers();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  setupGoogleDocsHandlers() {
    document.addEventListener("input", () => {
      const text = this.getGoogleDocsText();
      if (!text) return;
      this.handleGoogleDocsInput(text);
    });
  }

  getGoogleDocsText() {
    const cursor = document.querySelector(".kix-cursor");
    if (!cursor) return null;
    const line = cursor.closest(".kix-lineview");
    return line ? line.textContent : null;
  }

  async handleGoogleDocsInput(text) {
    const suggestion = await this.getSuggestion(text);
    if (suggestion) {
      this.suggestion = suggestion;
      // For Google Docs, position overlay near the cursor element.
      const editor = document.querySelector(".kix-canvas-tile-content");
      this.showGhostOverlay(editor, suggestion);
    } else {
      this.clearGhostOverlay();
    }
  }
}

// Initialize
new UniversalAutocomplete();
