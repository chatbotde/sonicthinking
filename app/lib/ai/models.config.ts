// filename: app/lib/ai/models.config.ts

/**
 * Configuration for an available Large Language Model.
 */
export interface LlmConfig {
    id: string;         // Unique identifier (e.g., 'gemini-1.5-flash', 'openai-gpt-4o')
    name: string;       // Display name (e.g., 'Gemini (Flash)', 'OpenAI (GPT-4o)')
    provider: 'google' | 'openai' | 'openrouter'; // Helps route API requests (string removed for stricter typing)
    modelName: string;  // The actual model identifier used by the API provider
    // Add other relevant config if needed (e.g., requiresApiKey: true)
  }
  
  /**
   * List of available LLMs for the application.
   * Ensure the corresponding environment variables for API keys are set (e.g., GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY).
   */
  export const AVAILABLE_LLMS: LlmConfig[] = [
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      modelName: 'gemini-1.5-flash-latest', // Use the appropriate model name for Gemini API
    },
    // { // Example: Add Gemini Pro if needed
    //   id: 'gemini-pro',
    //   name: 'Gemini Pro',
    //   provider: 'google',
    //   modelName: 'gemini-pro',
    // },
    {
      id: 'openai-gpt-4o',
      name: 'OpenAI (GPT-4o)',
      provider: 'openai',
      modelName: 'gpt-4o',
    },
    {
      id: 'openai-gpt-3.5-turbo',
      name: 'OpenAI (GPT-3.5 Turbo)',
      provider: 'openai',
      modelName: 'gpt-3.5-turbo',
    },
    {
      id: 'deepseek-chat',
      name: 'Deepseek (Chat)',
      provider: 'openrouter', // Use OpenRouter provider
      modelName: 'deepseek/deepseek-chat', // Correct model ID for OpenRouter
    },
    {
      id: 'thudm-glm-z1-32b', // Simplified ID
      name: 'GLM-Z1-32B (Free)',
      provider: 'openrouter', // Use OpenRouter provider
      modelName: 'thudm/glm-z1-32b:free', // Correct model ID for OpenRouter
    },
    // Add more LLM configurations here as needed
  ];
  
  /**
   * Finds an LLM configuration by its ID.
   * @param id The ID of the LLM to find.
   * @returns The LlmConfig object or undefined if not found.
   */
  export function findLlmById(id: string): LlmConfig | undefined {
    return AVAILABLE_LLMS.find(llm => llm.id === id);
  }
  
  /**
   * Gets the default LLM (the first one in the list).
   * @returns The default LlmConfig object or undefined if the list is empty.
   */
  export function getDefaultLlm(): LlmConfig | undefined {
    return AVAILABLE_LLMS[0];
  }