class GhostText {
  constructor() {
    this.overlay = null;
    this.currentInput = null;
    this.suggestion = null;
  }

  show(inputElement, suggestion) {
    if (!this.overlay) {
      this.createOverlay();
    }

    this.currentInput = inputElement;
    this.suggestion = suggestion;

    // Get position and styling from the input element
    const rect = inputElement.getBoundingClientRect();
    const style = window.getComputedStyle(inputElement);

    const lineHeight =
      parseInt(style.lineHeight) || parseInt(style.fontSize) * 1.2;

    // Get text and cursor position based on element type
    let currentText, cursorPosition;

    if (
      inputElement.tagName === "INPUT" ||
      inputElement.tagName === "TEXTAREA"
    ) {
      // Regular input elements
      currentText = inputElement.value.slice(0, inputElement.selectionStart);
      cursorPosition = inputElement.selectionStart;
    } else {
      // For contenteditable and rich text editors
      const selection = window.getSelection();

      // Check if there's a valid selection
      if (!selection || !selection.rangeCount) {
        currentText = inputElement.textContent || "";
        cursorPosition = currentText.length;
      } else {
        const range = selection.getRangeAt(0);

        // Get the text before cursor
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(inputElement);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        currentText = preCaretRange.toString();
        cursorPosition = currentText.length;
      }
    }

    // Create a hidden span to measure text width
    const measurer = document.createElement("span");
    measurer.style.visibility = "hidden";
    measurer.style.position = "absolute";
    measurer.style.fontSize = style.fontSize;
    measurer.style.fontFamily = style.fontFamily;
    measurer.style.padding = "0";
    measurer.style.whiteSpace = "pre";
    measurer.textContent = currentText;
    document.body.appendChild(measurer);

    const textWidth = measurer.offsetWidth;
    document.body.removeChild(measurer);

    // Position the overlay to align with input text
    Object.assign(this.overlay.style, {
      left: `${rect.left + textWidth + parseInt(style.paddingLeft || 0)}px`,
      top: `${rect.top + (rect.height - lineHeight) / 2}px`, // Center vertically
      height: `${lineHeight}px`, // Use line height instead of full height
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      lineHeight: `${lineHeight}px`,
      position: "absolute",
      display: "block",
      pointerEvents: "none",
      whiteSpace: "pre",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: `${Math.max(200, rect.width - textWidth - 20)}px`,
    });

    // Show suggestion
    this.overlay.textContent = suggestion;
  }

  hide() {
    if (this.overlay) {
      this.overlay.style.display = "none";
    }
    this.currentInput = null;
    this.suggestion = null;
  }

  accept() {
    if (!this.currentInput || !this.suggestion) return;

    if (
      this.currentInput.tagName === "INPUT" ||
      this.currentInput.tagName === "TEXTAREA"
    ) {
      // Regular input elements
      const cursorPos = this.currentInput.selectionStart;
      this.currentInput.value =
        this.currentInput.value.slice(0, cursorPos) +
        this.suggestion +
        this.currentInput.value.slice(cursorPos);

      // Move cursor to end of inserted text
      const newPos = cursorPos + this.suggestion.length;
      this.currentInput.setSelectionRange(newPos, newPos);
    } else {
      // Rich text editors and contenteditable
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);

      // Insert the suggestion text
      const textNode = document.createTextNode(this.suggestion);
      range.insertNode(textNode);

      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.hide();
  }

  isVisible() {
    return this.overlay?.style.display === "block";
  }

  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.className = "ai-ghost-text";
    document.body.appendChild(this.overlay);
  }

  showAtPosition(rect, suggestion) {
    if (!this.overlay) {
      this.createOverlay();
    }

    // Position the overlay at the cursor position
    Object.assign(this.overlay.style, {
      left: `${rect.right}px`,
      top: `${rect.top}px`,
      height: `${rect.height}px`,
      position: "absolute",
      display: "block",
      pointerEvents: "none",
      whiteSpace: "pre",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "200px",
      fontSize: `${rect.height * 0.8}px`, // Approximate font size
      lineHeight: `${rect.height}px`,
    });

    this.suggestion = suggestion;
    this.overlay.textContent = suggestion;
  }
}

window.GhostText = GhostText;
