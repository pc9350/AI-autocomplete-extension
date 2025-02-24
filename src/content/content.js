class UniversalAutocomplete {
  constructor() {
    this.providers = {
      gemini: new window.GeminiNano(),
      cerebras: new window.Cerebras(),
    };
    this.currentProvider = "cerebras";
    this.resizeObserver = new ResizeObserver(() => {
      if (this.ghostOverlay && this.currentElement) {
        this.showGhostOverlay(this.currentElement, this.currentSuggestion);
      }
    });
    this.resizeObserver.observe(document.body);
    this.suggestion = "";
    this.ghostOverlay = null;
    this.currentElement = null;
    this.setupListeners();
    this.setupGoogleDocsListener();
    this.lastInputTime = 0;
    this.lastRequestTime = {
      cerebras: 0,
      gemini: 0,
    };
    this.minRequestInterval = {
      cerebras: 3000, // 2 seconds between Cerebras requests
      gemini: 1000, // 0.5 seconds between Gemini requests
    };
    this.inputDelay = {
      cerebras: 2000, // Wait 1.5 second before sending to Cerebras
      gemini: 1500, // Wait 0.5 seconds before sending to Gemini
    };
    console.log("UniversalAutocomplete initialized");
  }

  setupListeners() {
    document.addEventListener("focusin", (e) => this.handleFocus(e));
    // Use the debounced version of handleInput
    document.addEventListener("input", (e) => {
      clearTimeout(this.inputTimer);
      this.inputTimer = setTimeout(() => {
        this.handleInput(e);
      }, this.inputDelay[this.currentProvider]);
    });
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

    console.log("Current text content:", {
      length: text.length,
      preview: text.substring(0, 100),
    });

    if (!text || text.trim().length < 2) {
      this.clearGhostOverlay();
      return;
    }

    try {
      this.failedAttempts = 0;

      const suggestion = await this.getSuggestion(text);
      console.log("Got suggestion for text:", text, "=>", suggestion);

      if (suggestion && suggestion.trim()) {
        this.suggestion = suggestion;
        this.showGhostOverlay(element, suggestion);
      } else {
        this.clearGhostOverlay();
      }
    } catch (error) {
      console.error("Error getting suggestion:", error);
      this.clearGhostOverlay();
    }

    // Retry with exponential backoff
    // setTimeout(() => {
    //   this.waitForEditor(retries + 1, maxRetries);
    // }, Math.min(1000 * Math.pow(1.5, retries), 10000));
  }

  clearTimers() {
    if (this.inputTimer) {
      clearTimeout(this.inputTimer);
      this.inputTimer = null;
    }
  }

  // Add cleanup to existing methods
  clearGhostOverlay() {
    this.clearTimers();
    if (this.ghostOverlay) {
      this.ghostOverlay.remove();
      this.ghostOverlay = null;
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
    } else {
      // Clear existing timer if user starts typing again
      clearTimeout(this.inputTimer);
    }
  }

  isSearchInput(element) {
    if (!element) return false;

    return (
      element.getAttribute("type") === "search" || // Explicit search inputs
      element.getAttribute("role") === "searchbox" || // ARIA search role
      element.name === "q" || // Google search
      element.name === "search_query" || // YouTube search
      element.placeholder?.toLowerCase().includes("search") || // Search placeholder
      element.classList.contains("search-input") || // Common search class
      element.id?.toLowerCase().includes("search") // Search in ID
    );
  }

  async getSuggestion(text) {
    const now = Date.now();
    
    // Check which provider is available
    const cerebrasCooldown = now - this.lastRequestTime.cerebras < this.minRequestInterval.cerebras;
    const geminiCooldown = now - this.lastRequestTime.gemini < this.minRequestInterval.gemini;
    
    // Select provider based on cooldown
    if (this.currentProvider === "cerebras" && cerebrasCooldown) {
      this.currentProvider = "gemini";
    } else if (this.currentProvider === "gemini" && geminiCooldown) {
      this.currentProvider = "cerebras";
    }

    const provider = this.providers[this.currentProvider];
    if (!provider) {
      console.error("Provider not found:", this.currentProvider);
      return null;
    }
  
    try {
      this.lastRequestTime[this.currentProvider] = now;

      const context = {
        text: text,
        isSearchInput: this.isSearchInput(this.currentElement),
        elementType: this.currentElement?.tagName.toLowerCase(),
      };

      const result = await provider.getSuggestion(context);

      // Only switch providers if we get null or empty result
      if (result && result.trim()) {
        this.failedAttempts = 0; // Reset on success
        return result;
      }

      const otherProvider = this.currentProvider === "cerebras" ? "gemini" : "cerebras";
      const otherCooldown = now - this.lastRequestTime[otherProvider] < this.minRequestInterval[otherProvider];
      
      if (!otherCooldown) {
        this.currentProvider = otherProvider;
        this.lastRequestTime[this.currentProvider] = now;
        return this.providers[otherProvider].getSuggestion(context);
      }
      
      return null;
    } catch (error) {
      console.error(`${this.currentProvider} error:`, error);

      // Don't switch providers on network errors or timeouts
      if (error.message.includes("422")) {
        this.lastRequestTime[this.currentProvider] = Date.now();  // Update last request time
        this.minRequestInterval[this.currentProvider] *= 1.5;     // Increase delay
        console.log(`Increased ${this.currentProvider} delay to ${this.minRequestInterval[this.currentProvider]}ms`);
      }

      // For other errors, try fallback if we haven't already
      if (this.failedAttempts === 0) {
        this.failedAttempts++;
        const otherProvider =
          this.currentProvider === "cerebras" ? "gemini" : "cerebras";
        console.log(
          `Error with ${this.currentProvider}, trying ${otherProvider}`
        );
        this.currentProvider = otherProvider;
        return this.getSuggestion(text);
      }

      // If we've already tried both providers, give up
      console.log("Both providers failed, giving up");
      this.failedAttempts = 0; // Reset for next attempt
      return null;
    }
  }

  showGhostOverlay(element, suggestion) {
    this.currentElement = element;
    this.currentSuggestion = suggestion;
    this.clearGhostOverlay();

    const overlay = document.createElement("div");
    overlay.textContent = suggestion;
    overlay.className = "ai-ghost-text";

    const elementRect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const textBeforeCursor = element.value.substring(
        0,
        element.selectionStart
      );
      const paddingTop = parseInt(style.paddingTop) || 0;
      const paddingLeft = parseInt(style.paddingLeft) || 0;
      const paddingRight = parseInt(style.paddingRight) || 0;

      // Get explicit line height or calculate from font size
      const fontSize = parseInt(style.fontSize) || 16;
      const computedLineHeight =
        parseInt(style.lineHeight) || Math.floor(fontSize * 1.2);

      // Available width for text
      const availableWidth = elementRect.width - paddingLeft - paddingRight;

      // Use canvas for precise text measurement
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = style.font;

      // Measure text width
      const textWidth = ctx.measureText(textBeforeCursor).width;

      // Calculate number of complete lines and remaining width
      const completeLines = Math.floor(textWidth / availableWidth);
      const remainingWidth = textWidth % availableWidth;

      console.log("Canvas Measurements:", {
        text: textBeforeCursor,
        measurements: {
          fontSize,
          computedLineHeight,
          availableWidth,
          textWidth,
          completeLines,
          remainingWidth,
        },
      });

      // Calculate final positions
      const suggestedLeft =
        elementRect.left + paddingLeft + remainingWidth + window.scrollX;
      const suggestedTop =
        elementRect.top +
        paddingTop +
        completeLines * computedLineHeight +
        window.scrollY;

      // Position the overlay
      Object.assign(overlay.style, {
        top: `${suggestedTop}px`,
        left: `${suggestedLeft}px`,
        maxWidth: `${availableWidth - remainingWidth}px`,
        fontSize: `${fontSize}px`,
        lineHeight: `${computedLineHeight}px`,
      });
    } else if (element.isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(true);
        const rangeRect = range.getBoundingClientRect();

        // Calculate available width for contenteditable
        const availableWidth = elementRect.right - rangeRect.left - 20;

        Object.assign(overlay.style, {
          top: `${rangeRect.top + window.scrollY}px`,
          left: `${rangeRect.left + window.scrollX}px`,
          maxWidth: `${Math.max(50, availableWidth)}px`,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
        });
      }
    }

    document.body.appendChild(overlay);
    this.ghostOverlay = overlay;
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.clearGhostOverlay();
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

  getTextFromElement(element) {
    // Handle Monaco editor
    // if (
    //   element.classList.contains("monaco-mouse-cursor-text") ||
    //   element.closest(".monaco-editor")
    // ) {
    //   // Get the editor container
    //   const editorContainer = element.closest(".monaco-editor");
    //   if (!editorContainer) return "";

    //   // Get all lines from the editor
    //   const lines = Array.from(editorContainer.querySelectorAll(".view-line"))
    //     .map((line) => {
    //       // Remove any class names and style attributes from the text
    //       return line.textContent.replace(/\u200B/g, "").trim(); // Remove zero-width spaces
    //     })
    //     .filter((line) => line.length > 0) // Remove empty lines
    //     .join("\n");

    //   console.log("Monaco editor content:", {
    //     rawLines: lines,
    //     lineCount: lines.split("\n").length,
    //   });

    //   return lines || "";
    // }

    // Regular input handling
    if (
      element.tagName.toLowerCase() === "input" ||
      element.tagName.toLowerCase() === "textarea"
    ) {
      return element.value || "";
    } else if (element.isContentEditable) {
      return element.innerText || "";
    }
    return "";
  }

  isValidInput(element) {
    const tagName = element.tagName.toLowerCase();

    const isSearchInput = this.isSearchInput(element);

    const isMonacoEditor =
      element.classList.contains("monaco-mouse-cursor-text") ||
      element.closest(".monaco-editor") !== null;

    if (isMonacoEditor) {
      console.log("Monaco editor detected", {
        element: element.tagName,
        classes: Array.from(element.classList),
        parentClasses: Array.from(element.parentElement?.classList || []),
      });
      return true;
    }

    // Minimum text length check to avoid unnecessary suggestions
    const hasMinLength =
      (element.value || element.textContent || "").trim().length >= 2;

    const isValid =
      // Regular inputs
      ((tagName === "input" &&
        !element.type.match(
          /^(checkbox|radio|submit|button|file|hidden|password)$/
        )) ||
        tagName === "textarea" ||
        element.isContentEditable ||
        // Rich text editors
        element.classList.contains("ProseMirror") ||
        element.classList.contains("ql-editor") ||
        element.classList.contains("CodeMirror-code") ||
        element.classList.contains("monaco-editor") ||
        element.id === "textarea__editor" ||
        // Search inputs
        isSearchInput) &&
      !element.readOnly &&
      hasMinLength;

    // Debug log
    if (isValid) {
      console.log("Valid input detected:", {
        tagName,
        id: element.id,
        type: element.type,
        name: element.name,
        placeholder: element.placeholder,
        classList: Array.from(element.classList),
        isContentEditable: element.isContentEditable,
        isSearchInput,
        hasMinLength,
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
const autocomplete = new UniversalAutocomplete();

// Clean up when extension is disabled/unloaded
window.addEventListener("unload", () => {
  autocomplete.destroy();
});
