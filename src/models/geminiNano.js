class GeminiNano {
  constructor() {
    this.model = null;
    this.currentRequest = null;
    this.initModel();
  }

  async initModel() {
    try {
      const capabilities = await window.ai?.languageModel?.capabilities();
      if (!capabilities?.available) {
        console.warn("Gemini Nano is not available");
        return;
      }

      this.model = await window.ai.languageModel.create();
      console.log("Gemini Nano initialized");
    } catch (error) {
      console.error("Failed to initialize Gemini Nano:", error);
    }
  }

  async getSuggestion(context) {
    if (!this.model || context.text.length < 3) return null;

    try {
      if (this.currentRequest) {
        this.currentRequest.abort();
      }

      this.currentRequest = new AbortController();

      const prompt = `You are an English language autocomplete system. Complete this text naturally with 7-9 words or 1-2 sentences wherever necessary but in English only. it doesn't need to be a story or information available directly on the web. Respond with ONLY the completion:
          TEXT: "${context.text}"
          CONTINUATION:`;

      const response = await Promise.race([
        this.model.prompt(prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000)
        ),
      ]);

      // Clean up the response to ensure it's a proper continuation
      const cleanResponse = response
        ?.trim()
        ?.replace(/^["']|["']$/g, "") // Remove quotes
        ?.replace(context.text, "") // Remove any repeated input
        ?.replace(/[^\x00-\x7F]/g, ""); // Remove any repeated input

      return cleanResponse || null;
    } catch (error) {
      if (error.message?.includes("untested language")) {
        console.log("Skipping suggestion for potential non-English input");
        return null;
      }

      // Log other errors
      if (error.message !== "Timeout" && !error.message.includes("cancelled")) {
        console.error("Error getting suggestion:", error);
      }
      return null;
    } finally {
      this.currentRequest = null;
    }
  }

  destroy() {
    if (this.model) {
      this.model.destroy();
      this.model = null;
    }
  }
}

if (typeof window !== "undefined") {
  window.GeminiNano = GeminiNano;
}
