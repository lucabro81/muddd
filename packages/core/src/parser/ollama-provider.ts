export interface LLMProvider {
  /**
    * Generates text in streaming based on a specific prompt and model.
    * @param prompt The text input for the LLM.
    * @param model The name of the LLM model to use (e.g. 'llama3').
    * @returns An AsyncIterable that produces generated text chunks.
    */
  generateText(prompt: string, model: string): AsyncIterable<string>;
}

export interface OllamaStreamResponse {
  model: string;
  created_at: string;
  response: string; // chunk of generated text
  done: boolean; // true if the generation is complete
  // Other possible fields: context, total_duration, ecc.
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;

  // The base URL of the Ollama API (e.g. http://localhost:11434)
  constructor(baseUrl: string = 'http://localhost:11434') {
    // Remove any trailing slashes for consistency
    this.baseUrl = baseUrl.replace(/\/$/, '');
    console.log(`[OllamaProvider] Initialized with base URL: ${this.baseUrl}`);
  }

  async *generateText(prompt: string, model: string): AsyncIterable<string> {
    // TODO: endpoint should be passed as a parameter?
    const endpoint = `${this.baseUrl}/api/generate`;
    console.log(`[OllamaProvider] Sending request to ${endpoint} for model ${model}`);

    let response: Response | null = null;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: true,
          // options: { // Additional options if needed
          //     temperature: 0.7,
          // }
        }),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.text();
        console.error(`[OllamaProvider] Error response ${response.status} from Ollama: ${errorBody}`);
        throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[OllamaProvider] Stream finished.');
          break;
        }

        buffer += decoder.decode(value, { stream: true }); // 'stream: true' helps with multi-byte characters being split

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex); // Extract a line of text
          buffer = buffer.slice(newlineIndex + 1); // Remove the line from the buffer

          if (line.trim() === '') continue; // Skip empty lines

          try {
            const parsedLine = JSON.parse(line) as OllamaStreamResponse;
            if (parsedLine.response) {
              yield parsedLine.response;
            }
            // If we receive the final chunk with done=true, we might want to exit before
            // even though the stream is not formally 'done' from the reader
            if (parsedLine.done) {
              console.log('[OllamaProvider] Received done:true in stream.');
              // Should we close the reader here? Depends on the desired error/completion handling.
              // await reader.cancel(); // Optional: force closure
              return; // Terminate the generator
            }
          } catch (e) {
            console.warn(`[OllamaProvider] Failed to parse JSON line: "${line}"`, e);
            // Decide how to handle parsing errors (ignore? throw error?)
          }
        }
      }

      if (buffer.trim() !== '') {
        console.warn("[OllamaProvider] Residual buffer at end of stream:", buffer);
        try {
          const parsedLine = JSON.parse(buffer) as OllamaStreamResponse;
          if (parsedLine.response) yield parsedLine.response;
        } catch (e) {
          console.warn("[OllamaProvider] Failed to parse residual buffer:", e);
        }
      }

    } catch (error) {
      console.error("[OllamaProvider] Error during streaming fetch:", error);
      // Throw the error to indicate failure in generating streaming text
      throw new Error(`Failed to generate streaming text via Ollama: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}