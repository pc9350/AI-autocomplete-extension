(function(window) {
    class CerebrasSDK {
      constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.cerebras.ai/v1';
      }
  
      async completions({ prompt, model, max_tokens = 50, temperature = 0.7, stop = [], stream = false }, { signal } = {}) {
        try {
          const response = await fetch(`${this.baseUrl}/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              prompt,
              model,
              max_tokens,
              temperature,
              stop,
              stream
            }),
            signal
          });
  
          if (!response.ok) {
            throw new Error(`Cerebras API error: ${response.status}`);
          }
  
          return await response.json();
        } catch (error) {
          console.error('Cerebras API error:', error);
          throw error;
        }
      }
    }
  
    // Expose to window
    window.CerebrasSDK = CerebrasSDK;
  })(window);