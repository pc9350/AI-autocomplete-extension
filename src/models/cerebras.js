class Cerebras {
  constructor() {
    this.model = "llama3.1-8b";
    this.currentRequest = null;
    this.client = null;
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

  async getSuggestion(context) {
    if (!this.client || !context.text || context.text.trim().length < 2)
      return null;

    try {
      if (this.currentRequest) {
        this.currentRequest.abort();
      }

      this.currentRequest = new AbortController();

      const prompt = this.constructPrompt(context);
      const completion = await this.client.completions(
        {
          prompt,
          model: this.model,
          max_tokens: 50,
          temperature: 0.3,
          stop: this.getStopTokens(context),
          stream: false,
        },
        {
          signal: this.currentRequest.signal,
        }
      );

      console.log("Response time:", completion.time_info.total_time);

      const suggestion = completion.choices[0].text.trim();
      console.log("Cerebras raw response:", suggestion);

      return suggestion || null;
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Request cancelled");
      } else {
        console.error("Cerebras error:", error);
      }
      return null;
    }
  }

  constructPrompt(context) {
    const isCode = this.detectCodeContext(context.text);
    const isSearch = context.isSearchInput;

    if (isCode) {
      if (
        context.text.includes("class Solution:") ||
        context.text.includes("def ")
      ) {
        return `Complete this Python LeetCode solution. Return the most optimal solution and keep the indentation consistent:
    ${context.text}`;
      }
      return `Complete this code. Maintain proper indentation:
${context.text}`;
    } else if (isSearch) {
      return `Complete this search query:
  ${context.text}`;
    } else {
      return `Complete this text naturally:
  ${context.text}`;
    }
  }

  getStopTokens(context) {
    if (this.detectCodeContext(context.text)) {
      return [
        "\n\n", // Double newline
        "class ", // New class definition
        "def ", // New function definition
        "# ", // Python comment
        "'''", // Python docstring
      ];
    } else if (context.isSearchInput) {
      return ["\n"];
    } else {
      return [".", "!", "?", "\n"];
    }
  }

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
