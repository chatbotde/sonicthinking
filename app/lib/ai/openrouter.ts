import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Creates an OpenRouter client instance with the provided API key.
 * @returns An OpenAI-compatible client configured for OpenRouter.
 */
export function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set.');
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://sonicthinking.com",//ite URL for rankings on openrouter.ai
      "X-Title": "Sonicthinking", // Site title for rankings on openrouter.ai
    },
  });
}

/**
 * Helper function to transform the OpenRouter stream into the expected format.
 * @param stream - The stream from OpenRouter API.
 * @returns An async generator that yields objects with a text() method.
 */
async function* openRouterStreamTransformer(
  stream: AsyncIterable<any>
): AsyncGenerator<{ text: () => string }> {
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      // Yield an object with a text() method, similar to Gemini's response format
      yield { text: () => content };
    }
  }
}

/**
 * Generates a chat response using the OpenRouter API.
 * @param messages - The messages to send to the chat model.
 * @param modelName - The specific OpenRouter model identifier (e.g., 'deepseek/deepseek-chat').
 * @returns The generated response content.
 */
export async function generateChatResponse(
  messages: ChatCompletionMessageParam[],
  modelName: string // Make modelName required
): Promise<{ content: string }> {
  const client = getOpenRouterClient();
  
  try {
    const completion = await client.chat.completions.create({
      model: modelName, // Use the provided modelName
      messages: messages,
      temperature: 0.7,
      max_tokens: 32000,
    });
    
    return { content: completion.choices[0].message.content || "" };
  } catch (error) {
    console.error(`Error generating chat response with OpenRouter (${modelName}):`, error);
    throw new Error(`Failed to generate response with OpenRouter (${modelName}).`);
  }
}

/**
 * Streams a chat response using the OpenRouter API.
 * @param messages - The messages to send to the chat model.
 * @param modelName - The specific OpenRouter model identifier (e.g., 'deepseek/deepseek-chat').
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns An object containing the async iterable stream compatible with other providers.
 */
export async function streamChatResponse(
  messages: ChatCompletionMessageParam[],
  modelName: string,
  signal?: AbortSignal // Add signal parameter
): Promise<{ stream: AsyncIterable<{ text: () => string }> }> {
  const client = getOpenRouterClient();

  try {
    const stream = await client.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: 0.7,
      stream: true,
    }, { signal }); // Pass signal to the create method options

    const transformedStream = openRouterStreamTransformer(stream);
    return { stream: transformedStream };
  } catch (error: any) {
     if (error.name === 'AbortError') {
        console.log(`OpenRouter stream request aborted (${modelName}).`);
        // Re-throw the AbortError so the caller can handle it
        throw error;
    }
    console.error(`Error streaming chat response with OpenRouter (${modelName}):`, error);
    throw new Error(`Failed to stream response with OpenRouter (${modelName}).`);
  }
}