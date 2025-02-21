class AutocompleteManager {
  constructor() {
    this.model = new window.GeminiNano();
    this.ghostText = new window.GhostText();
    this.setupListeners();
    this.setupMutationObserver();
    this.setupGoogleDocsListener();
    console.log("AutocompleteManager initialized");
  }

  setupListeners() {
    // Listen for focus events on the whole document
    document.addEventListener("focusin", this.handleFocusIn.bind(this));
    document.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  setupGoogleDocsListener() {
    console.log("Checking for Google Docs...");
    if (window.location.hostname === "docs.google.com") {
      console.log("✓ Google Docs detected");
      this.waitForEditor();
    }
  }

  waitForEditor(retries = 0, maxRetries = 10) {
    console.log("Waiting for editor...", retries);

    // Try multiple selectors
    const editorSelectors = [
      ".docs-editor-container",
      "#docs-editor",
      ".kix-appview-editor",
    ];

    const editor = editorSelectors
      .map((selector) => document.querySelector(selector))
      .find((el) => el);

    if (editor) {
      console.log("✓ Editor found");
      this.setupGoogleDocsHandlers(editor);
      return;
    }

    if (retries >= maxRetries) {
      console.error("❌ Editor not found after maximum retries");
      return;
    }

    // Retry with exponential backoff
    setTimeout(() => {
      this.waitForEditor(retries + 1, maxRetries);
    }, Math.min(1000 * Math.pow(1.5, retries), 10000));
  }

  setupGoogleDocsHandlers() {
    console.log("Setting up Google Docs handlers...");

    // Try multiple selectors for editor container
    const editorSelectors = [
      ".docs-editor-container",
      "#docs-editor",
      ".kix-appview-editor",
    ];

    const editorContainer = editorSelectors
      .map((selector) => document.querySelector(selector))
      .find((el) => el);

    if (!editorContainer) {
      console.error("❌ Editor container not found");
      return;
    }
    console.log("✓ Editor container found");

    // Input handler
    const inputHandler = this.debounce((event) => {
      console.log("Input detected in Google Docs");

      // Ignore special keys
      if (event.key === "Tab" || event.key === "Escape") {
        return;
      }

      const cursor = document.querySelector(".kix-cursor");
      if (!cursor) {
        console.log("❌ No cursor found");
        return;
      }

      const rect = cursor.getBoundingClientRect();
      const text = this.getGoogleDocsText();

      if (text) {
        this.handleGoogleDocsInput(text, rect);
      }
    }, 300);

    // Keyboard handler
    const keyboardHandler = (event) => {
      if (event.key === "Tab" && this.ghostText.isVisible()) {
        event.preventDefault();
        event.stopPropagation();
        this.acceptSuggestion();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.ghostText.hide();
      }
    };

    // Add event listeners
    editorContainer.addEventListener("keyup", inputHandler);
    editorContainer.addEventListener("input", inputHandler);
    document.addEventListener("keydown", keyboardHandler, true);

    // Store cleanup functions
    this.cleanup = () => {
      editorContainer.removeEventListener("keyup", inputHandler);
      editorContainer.removeEventListener("input", inputHandler);
      document.removeEventListener("keydown", keyboardHandler, true);
    };

    console.log("✓ Google Docs handlers setup complete");
  }

  getGoogleDocsText() {
    const lines = Array.from(document.querySelectorAll(".kix-lineview"));
    if (!lines.length) return null;

    const currentLine = lines.find((line) => {
      const rect = line.getBoundingClientRect();
      const cursor = document.querySelector(".kix-cursor");
      return (
        cursor &&
        rect.top <= cursor.getBoundingClientRect().top &&
        rect.bottom >= cursor.getBoundingClientRect().top
      );
    });

    return currentLine ? currentLine.textContent : null;
  }

  acceptSuggestion() {
    // Simulate text insertion in Google Docs
    const suggestion = this.ghostText.getCurrentSuggestion();
    if (suggestion) {
      // Using document.execCommand for text insertion
      document.execCommand("insertText", false, suggestion);
      this.ghostText.hide();
    }
  }

  async handleGoogleDocsInput(text, cursorRect) {
    console.log("Handling Google Docs input...");

    if (!text) {
      console.log("❌ No text to process");
      return;
    }

    const context = {
      text: text,
      cursorPosition: text.length,
    };

    try {
      const suggestion = await this.model.getSuggestion(context);
      console.log("Got suggestion:", suggestion);

      if (suggestion) {
        // Adjust position for Google Docs
        const adjustedRect = {
          ...cursorRect,
          right: cursorRect.right + 2, // Slight offset
          top: cursorRect.top + 2,
        };
        this.ghostText.showAtPosition(adjustedRect, suggestion);
        console.log("✓ Showing suggestion");
      } else {
        this.ghostText.hide();
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
      this.ghostText.hide();
    }
  }

  setupMutationObserver() {
    // For Google Docs and similar dynamic editors
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          for (const node of addedNodes) {
            if (node.nodeType === 1) {
              // Element node
              this.setupEditorListeners(node);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  setupEditorListeners(node) {
    // Check for Google Docs editor
    const docsEditor = node.querySelector(".kix-appview-editor");
    if (docsEditor) {
      console.log("Found Google Docs editor");
      docsEditor.addEventListener(
        "input",
        this.debounce(() => this.handleInput(docsEditor), 300)
      );
    }

    // Check for Gmail compose
    const gmailCompose = node.querySelector(".Am.Al.editable");
    if (gmailCompose) {
      console.log("Found Gmail compose");
      gmailCompose.addEventListener(
        "input",
        this.debounce(() => this.handleInput(gmailCompose), 300)
      );
    }
  }

  handleKeydown(event) {
    // Handle Tab key for accepting suggestions
    if (event.key === "Tab" && this.ghostText.isVisible()) {
      // Check if we're in Gmail
      const isGmail =
        event.target.classList.contains("Am") ||
        event.target.classList.contains("Al") ||
        event.target.classList.contains("editable");

      if (isGmail) {
        event.stopPropagation(); // Stop event from bubbling
        event.preventDefault(); // Prevent default tab behavior
        this.ghostText.accept();
        return false;
      } else {
        event.preventDefault();
        this.ghostText.accept();
      }
    } else if (event.key === "Escape") {
      this.ghostText.hide();
    }
  }

  handleFocusIn(event) {
    const element = event.target;
    if (this.isValidInput(element)) {
      console.log("Valid input focused:", element.tagName);
      element.addEventListener(
        "input",
        this.debounce(() => this.handleInput(element), 300)
      );
    }
  }

  isValidInput(element) {
    // Check for various types of text input elements
    return (
      // Regular inputs and textareas
      ((element.tagName === "INPUT" &&
        !element.type.match(/^(checkbox|radio|submit|button|file|hidden)$/)) ||
        element.tagName === "TEXTAREA" ||
        // Rich text editors and contenteditable elements
        element.getAttribute("contenteditable") === "true" ||
        // Common rich text editor classes
        element.classList.contains("ql-editor") || // Quill
        element.classList.contains("ProseMirror") || // ProseMirror
        element.classList.contains("CodeMirror-code") || // CodeMirror
        element.classList.contains("ace_editor") || // Ace Editor
        element.classList.contains("monaco-editor") || // Monaco Editor
        // Google Docs specific
        element.classList.contains("kix-canvas") ||
        // Generic editable elements
        window.getComputedStyle(element).webkitUserModify === "read-write") &&
      // Exclude password fields and readonly inputs
      !element.readOnly &&
      element.type !== "password"
    );
  }

  async handleInput(element) {
    let text, cursorPosition;

    // Get text and cursor position based on element type
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      text = element.value;
      cursorPosition = element.selectionStart;
    } else if (element.getAttribute("contenteditable") === "true") {
      text = element.textContent;
      const selection = window.getSelection();
      cursorPosition = selection.anchorOffset;
    } else {
      // For other editors, try to get text content
      text = element.textContent || element.innerText;
      const selection = window.getSelection();
      cursorPosition = selection.anchorOffset;
    }

    const context = {
      text: text,
      cursorPosition: cursorPosition,
      elementType: element.tagName.toLowerCase(),
      inputType: element.type || "text",
    };

    try {
      const suggestion = await this.model.getSuggestion(context);
      if (suggestion) {
        this.ghostText.show(element, suggestion);
      } else {
        this.ghostText.hide();
      }
    } catch (error) {
      console.error("Autocomplete error:", error);
      this.ghostText.hide();
    }
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

// Initialize
new AutocompleteManager();
