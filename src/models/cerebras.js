class Cerebras {
  constructor() {
    this.model = "llama3.1-8b";
    this.currentRequest = null;
    this.client = null;
    this.maxInputLength = 100;
    this.contextWindow = 75;
    this.initModel();
  }

  async initModel() {
    if (!window.CEREBRAS_API_KEY) {
      console.error("Cerebras API key not found");
      return;
    }
    this.client = new window.CerebrasSDK(window.CEREBRAS_API_KEY);
    console.log("Cerebras initialized");
  }

  getRelevantContext(text) {
    // Get last few complete lines
    const lines = text.split("\n");
    let context = "";
    let length = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (length + lines[i].length > this.contextWindow) break;
      context = lines[i] + "\n" + context;
      length += lines[i].length;
    }

    // If no line breaks, just take last N chars
    if (!context) {
      context = text.slice(-this.contextWindow);
    }

    return context.trim();
  }

  async getSuggestion(context) {
    if (!this.client || !context.text || context.text.trim().length < 2)
      return null;

    const truncatedText = context.text.slice(0, this.maxInputLength);

    try {
      if (this.currentRequest) {
        this.currentRequest.abort();
      }

      this.currentRequest = new AbortController();

      const text = context.text.trim().slice(-this.contextWindow);

      const completion = await this.client.completions(
        {
          prompt: text,
          model: this.model,
          max_tokens: 30,
          temperature: 0.7,
          stop: ["\n", ".", "!", "?"],
          stream: false,
        },
        {
          signal: this.currentRequest.signal,
        }
      );

      console.log("Response time:", completion.time_info.total_time);

      let suggestion = completion.choices[0].text.trim();
      console.log("Cerebras raw response:", suggestion);

      // Clean up any template patterns
      suggestion = suggestion
        .replace(/\[[^\]]+\]/g, "")
        .replace(/\{[^\}]+\}/g, "")
        .replace(/\s+/g, " ")
        .trim();

      console.log("Cerebras clean response:", suggestion);

      return suggestion || null;
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Request cancelled");
      } else {
        console.error("Cerebras error:", error);
        if (error.message.includes("422") && truncatedText.length > 200) {
          return this.getSuggestion({
            ...context,
            text: truncatedText.slice(0, 200),
          });
        }
      }
      return null;
    }
  }

  constructPrompt(context) {
    const isCode = this.detectCodeContext(context.text);
    const relevantText = this.getRelevantContext(context.text);

    if (isCode) {
      return `Complete this code naturally, continuing from the last line. Maintain the same style and indentation:

${relevantText}`;
    } else {
      return `Continue this text naturally, matching the tone and style. Use specific details, never templates or placeholders. Complete the current thought or start a natural continuation:

${relevantText}`;
    }
  }

  cleanTemplateText(text) {
    return text
      .replace(/\[[^\]]+\]/g, "") // Remove [Your Name] style templates
      .replace(/\{[^\}]+\}/g, "") // Remove {placeholder} style templates
      .replace(/\<[^\>]+\>/g, "") // Remove <placeholder> style templates
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\s,/g, ",") // Fix spacing around punctuation
      .trim();
  }

  hasTemplatePatterns(text) {
    const templatePatterns = [
      /\[[^\]]+\]/, // [placeholder]
      /\{[^\}]+\}/, // {placeholder}
      /<[^>]+>/, // <placeholder>
      /\[.*\]/, // [anything]
      /placeholder/i,
      /template/i,
      /your/i,
    ];

    return templatePatterns.some((pattern) => pattern.test(text));
  }

  // getStopTokens(context) {
  //   if (this.detectCodeContext(context.text)) {
  //     return ["\n\n", "class ", "def ", "# ", "'''"];
  //   } else if (context.isSearchInput) {
  //     return ["\n"];
  //   } else {
  //     // Enhanced stop tokens for natural text
  //     return [
  //       ".",
  //       "!",
  //       "?",
  //       "\n",
  //       "[", // Stop before any template-like brackets
  //       "{",
  //       "<",
  //     ];
  //   }
  // }

  detectCodeContext(text) {
    if (this.currentElement?.classList.contains("monaco-mouse-cursor-text")) {
      return true;
    }

    const codePatterns = [
      /[{}\[\]()]/,
      /\b(function|const|let|var|if|for|while|class|import|export|def)\b/, // Added 'def' for Python
      /[;=<>+\-*/%]/,
      /\bclass\s+\w+:/, // Python class definition
      /\bdef\s+\w+\s*\(/, // Python function definition
    ];
    return codePatterns.some((pattern) => pattern.test(text));
  }
}

// Expose to window
if (typeof window !== "undefined") {
  window.Cerebras = Cerebras;
}
