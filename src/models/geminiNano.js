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

      const prompt = `You are an advanced English autocomplete assistant. Your task is to continue the text provided in a natural, coherent, and contextually appropriate manner. Follow these guidelines:
                      - Do not repeat any part of the input text.
                      - Generate a continuation that builds on the given text and adds new, meaningful content.
                      - Your completion should be concise—either around 7 to 9 words or 1 to 2 complete sentences.
                      - Do not include any commentary, explanations, or extra text; return only the continuation.
                      - Ensure the completion flows logically from the input.
                      - if the previous text ends with a sentence, start the continuation with a new sentence.
                      - if the previous text ends with a word, start the continuation with a new word.
                      - if the previous text ends with a phrase, start the continuation with a new phrase.
                      - if the previous text ends with a paragraph, start the continuation with a new paragraph.
                      - MAKE SURE NOT TO REPEAT ANY PART OF THE INPUT TEXT.
          TEXT: "${context.text}"
          CONTINUATION:`;

      const response = await Promise.race([
        this.model.prompt(prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000)
        ),
      ]);

      console.log("Raw response from model:", response);

      // Clean up the response to ensure it's a proper continuation
      const cleanResponse = response?.trim()?.replace(/^["']|["']$/g, "");
      
      console.log("clean response", cleanResponse);
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
