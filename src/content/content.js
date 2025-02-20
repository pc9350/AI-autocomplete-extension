class AutocompleteManager {
  constructor() {
    this.model = new window.GeminiNano();
    this.ghostText = new window.GhostText();
    this.setupListeners();
    this.setupMutationObserver();
    console.log("AutocompleteManager initialized");
  }

  setupListeners() {
    // Listen for focus events on the whole document
    document.addEventListener("focusin", this.handleFocusIn.bind(this));
    document.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  setupGoogleDocsListener() {
    // Check if we're in Google Docs
    if (window.location.hostname === "docs.google.com") {
      console.log("Google Docs detected");

      // Wait for the editor to be ready
      const observer = new MutationObserver((mutations, obs) => {
        const canvas = document.querySelector(".kix-canvas-tile-content");
        if (canvas) {
          console.log("Google Docs editor found");
          obs.disconnect();
          this.setupGoogleDocsHandlers();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  setupGoogleDocsHandlers() {
    // Listen for cursor changes
    document.addEventListener(
      "input",
      this.debounce(() => {
        const cursor = document.querySelector(".kix-cursor");
        if (!cursor) return;

        // Get cursor position
        const rect = cursor.getBoundingClientRect();

        // Get the text content around cursor
        const textLayer = document.querySelector(".kix-paragraphrenderer");
        if (!textLayer) return;

        const text = this.getGoogleDocsText();
        if (!text) return;

        // Get suggestion based on text
        this.handleGoogleDocsInput(text, rect);
      }, 300)
    );
  }

  getGoogleDocsText() {
    // Try to get text from the current line
    const cursor = document.querySelector(".kix-cursor");
    if (!cursor) return null;

    // Find the line containing the cursor
    const line = cursor.closest(".kix-lineview");
    if (!line) return null;

    // Get text content
    return line.textContent;
  }

  async handleGoogleDocsInput(text, cursorRect) {
    if (!text) return;

    const context = {
      text: text,
      cursorPosition: text.length,
    };

    try {
      const suggestion = await this.model.getSuggestion(context);
      if (suggestion) {
        // Position ghost text at cursor position
        this.ghostText.showAtPosition(cursorRect, suggestion);
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
