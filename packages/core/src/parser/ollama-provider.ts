export interface LLMProvider {
  // TBD: should the model be a .ENV variable?
  generateText(prompt: string, model: string): Promise<string>;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
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

  async generateText(prompt: string, model: string): Promise<string> {
    const endpoint = `${this.baseUrl}/api/generate`;
    console.log(`[OllamaProvider] Sending request to ${endpoint} for model ${model}`);
    // console.debug(`[OllamaProvider] Prompt:\n${prompt}`); // Attention to log long prompts

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false, // Request complete response, not streaming (simpler initially)
          // options: { // Additional options if needed
          //     temperature: 0.7,
          // }
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[OllamaProvider] Error response ${response.status} from Ollama: ${errorBody}`);
        throw new Error(`Ollama API request failed with status ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as OllamaResponse;
      console.log(`[OllamaProvider] Received response from model ${data.model}`);
      return data.response?.trim() || ''; // Return the generated text

    } catch (error) {
      console.error("[OllamaProvider] Error during fetch:", error);
      throw error; // Rethrow the error for higher-level handling
    }
  }
}