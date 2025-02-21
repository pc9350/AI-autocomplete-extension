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

      const prompt = `You are an advanced autocomplete assistant for both code and text. Analyze the input and provide appropriate continuations:

      If the input is CODE (detect based on syntax, symbols, or common patterns):
      - Continue with valid syntax for that programming language
      - Respect code indentation and structure
      - Complete the current statement/block/function
      - Suggest logical next steps in the code
      - For functions, suggest parameters or return statements
      - For objects/arrays, suggest relevant properties/elements
      - For control structures, complete the logic
      - Never explain the code, only provide the continuation
      - Maintain consistent coding style with input
      - If inside a comment, continue the comment appropriately

      If the input is NATURAL TEXT:
      - Continue naturally and contextually
      - Keep it concise (7-9 words or 1-2 sentences)
      - Match the tone and style of the input
      - If a sentence ends with period, start new sentence
      - If mid-sentence, continue the sentence structure
      - For lists, continue with relevant items
      - For technical writing, maintain formal tone
      - For casual text, maintain conversational style

      CRITICAL RULES:
      - Never repeat the input text
      - No explanations or meta-commentary
      - Return only the direct continuation
      - Preserve formatting and style
      - For code, prioritize syntactic correctness
      - For markdown, maintain formatting
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
