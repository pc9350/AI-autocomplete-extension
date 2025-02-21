class UniversalAutocomplete {
  constructor() {
    this.model = new window.GeminiNano();
    this.suggestion = "";
    this.ghostOverlay = null;
    this.currentElement = null;
    this.isGoogleDocs = window.location.hostname === "docs.google.com";
    this.setupListeners();
    if (this.isGoogleDocs) {
      this.setupGoogleDocsListener();
    }
    console.log("UniversalAutocomplete initialized");
  }

  // Global listeners for focus, input, and keydown
  setupListeners() {
    document.addEventListener("focusin", (e) => this.handleFocus(e));
    if (!this.isGoogleDocs) {
      document.addEventListener("input", (e) => this.handleInput(e));
    }
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
    this.currentElement = element;
    const text = this.getTextFromElement(element);
    if (!text.trim()) {
      this.clearGhostOverlay();
      return;
    }
    const suggestion = await this.getSuggestion(text);
    if (suggestion) {
      this.suggestion = suggestion;
      this.showGhostOverlay(element, suggestion);
    } else {
      this.clearGhostOverlay();
    }
  }

  handleKeydown(event) {
    if (event.key === "Tab" && this.suggestion) {
      event.preventDefault();
      this.acceptSuggestion();
    } else if (event.key === "Escape") {
      this.clearGhostOverlay();
      this.suggestion = "";
    }
  }

  async getSuggestion(text) {
    try {
      const context = { text: text, cursorPosition: text.length };
      const response = await this.model.getSuggestion(context);
      return response || "";
    } catch (error) {
      console.error("Autocomplete error:", error);
      return "";
    }
  }

  // Dispatch the ghost overlay display to the appropriate method
  showGhostOverlay(element, suggestion) {
    if (this.isGoogleDocs) {
      this.showGoogleDocsGhostOverlay(suggestion);
    } else {
      this.showStandardGhostOverlay(element, suggestion);
    }
  }

  // For standard text inputs and contentEditable elements
  showStandardGhostOverlay(element, suggestion) {
    this.clearGhostOverlay();
    const overlay = document.createElement("div");
    overlay.textContent = suggestion;
    overlay.style.position = "absolute";
    overlay.style.color = "gray";
    overlay.style.opacity = "0.6";
    overlay.style.fontStyle = "italic";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "1000";

    let caretRect = null;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      caretRect = this.getCaretCoordinates(element, element.selectionStart);
    } else if (element.isContentEditable) {
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
  }

  // For Google Docs (canvas-based)
  showGoogleDocsGhostOverlay(suggestion) {
    this.clearGhostOverlay();
    const cursor = document.querySelector(".kix-cursor");
    if (!cursor) return;
    const rect = cursor.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.textContent = suggestion;
    overlay.style.position = "absolute";
    overlay.style.color = "gray";
    overlay.style.opacity = "0.6";
    overlay.style.fontStyle = "italic";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "10000";
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(overlay);
    this.ghostOverlay = overlay;
  }

  // When Tab is pressed, accept the suggestion
  acceptSuggestion() {
    if (!this.suggestion) return;
    if (!this.isGoogleDocs && this.currentElement) {
      const element = this.currentElement;
      if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        const pos = element.selectionStart;
        const before = element.value.substring(0, pos);
        const after = element.value.substring(pos);
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
    } else if (this.isGoogleDocs) {
      // In Google Docs, inserting text into the canvas is nontrivial.
      // Here we simply log acceptance. Actual insertion would require simulating key events.
      console.log("Accepting suggestion in Google Docs:", this.suggestion);
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

  // Validate common text editors
  isValidInput(element) {
    return (
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable ||
        element.classList.contains("ProseMirror") ||
        element.classList.contains("kix-canvas") || // Google Docs canvas
        element.classList.contains("ql-editor") ||   // Quill Editor
        element.classList.contains("CodeMirror-code") || // CodeMirror
        element.classList.contains("monaco-editor")) && // Monaco Editor
      !element.readOnly &&
      element.type !== "password"
    );
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

  // --- Google Docs Specific Handling ---
  setupGoogleDocsListener() {
    if (!this.isGoogleDocs) return;
    console.log("Google Docs detected");
    const observer = new MutationObserver(() => {
      const canvas = document.querySelector(".kix-canvas-tile-content");
      const cursor = document.querySelector(".kix-cursor");
      if (canvas && cursor) {
        console.log("Google Docs editor found");
        observer.disconnect();
        this.setupGoogleDocsHandlers();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  setupGoogleDocsHandlers() {
    // Instead of an input event, poll for changes in the current line's text.
    this.previousGoogleDocsText = "";
    this.googleDocsInterval = setInterval(async () => {
      const text = this.getGoogleDocsText();
      if (text !== this.previousGoogleDocsText) {
        this.previousGoogleDocsText = text;
        if (!text.trim()) {
          this.clearGhostOverlay();
        } else {
          const suggestion = await this.getSuggestion(text);
          if (suggestion) {
            this.suggestion = suggestion;
            this.showGoogleDocsGhostOverlay(suggestion);
          } else {
            this.clearGhostOverlay();
          }
        }
      }
    }, 500);
  }

  getGoogleDocsText() {
    const cursor = document.querySelector(".kix-cursor");
    if (!cursor) return "";
    const line = cursor.closest(".kix-lineview");
    return line ? line.textContent : "";
  }
}

new UniversalAutocomplete();
