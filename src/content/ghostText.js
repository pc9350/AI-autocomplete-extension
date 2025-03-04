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

    const rect = inputElement.getBoundingClientRect();
    const style = window.getComputedStyle(inputElement);

    const lineHeight =
      parseInt(style.lineHeight) || parseInt(style.fontSize) * 1.2;


    let currentText, cursorPosition;

    if (inputElement.tagName === "INPUT" || inputElement.tagName === "TEXTAREA") {
      // Regular input elements
      currentText = inputElement.value.slice(0, inputElement.selectionStart);
      cursorPosition = inputElement.selectionStart;
    } else {
      // For contenteditable and rich text editors
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        currentText = inputElement.textContent || "";
        cursorPosition = currentText.length;
      } else {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(inputElement);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        currentText = preCaretRange.toString();
        cursorPosition = currentText.length;
      }
    }
    
    // hidden span to measure text width (for all element types)
    const measurer = document.createElement("span");
    measurer.style.cssText = `
      visibility: hidden;
      position: absolute;
      font: ${style.font};
      padding: ${style.padding};
      white-space: pre-wrap;
      word-wrap: break-word;
      width: ${rect.width}px;
      box-sizing: border-box;
    `;
    measurer.textContent = currentText;
    document.body.appendChild(measurer);
    
    const textWidth = measurer.offsetWidth;
    document.body.removeChild(measurer);
    
 
    Object.assign(this.overlay.style, {
      left: `${rect.left + textWidth + parseInt(style.paddingLeft || 0)}px`,
      top: `${rect.top + (rect.height - lineHeight) / 2}px`,
      fontSize: style.fontSize,
      lineHeight: `${lineHeight}px`
    });

    // Show suggestion
    this.overlay.textContent = suggestion;
  }

  hide() {
    if (this.overlay) {
        this.overlay.style.opacity = '0';
        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.overlay.style.opacity = '0.85'; 
        }, 200); 
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
      
      const cursorPos = this.currentInput.selectionStart;
      this.currentInput.value =
        this.currentInput.value.slice(0, cursorPos) +
        this.suggestion +
        this.currentInput.value.slice(cursorPos);

      
      const newPos = cursorPos + this.suggestion.length;
      this.currentInput.setSelectionRange(newPos, newPos);
    } else {
      
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);

      
      const textNode = document.createTextNode(this.suggestion);
      range.insertNode(textNode);

      
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
      fontSize: `${rect.height * 0.8}px`
  });

    this.suggestion = suggestion;
    this.overlay.textContent = suggestion;
  }
}

window.GhostText = GhostText;
