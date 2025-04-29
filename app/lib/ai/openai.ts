import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Creates an OpenAI client instance.
 */
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }
  return new OpenAI({ apiKey });
}

/**
 * Helper function to transform the OpenAI stream into the expected format.
 * @param stream - The stream from OpenAI API.
 * @returns An async generator that yields objects with a text() method.
 */
async function* openAIStreamTransformer(
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
 * Generates a chat response using the OpenAI API.
 * @param messages - The messages to send to the chat model.
 * @param modelName - The specific OpenAI model to use (e.g., 'gpt-4o').
 * @returns The generated response content.
 */
export async function generateChatResponse(
  messages: ChatCompletionMessageParam[],
  modelName: string = "gpt-4o" // Default to gpt-4o
): Promise<{ content: string }> {
  const client = getOpenAIClient();
  try {
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: 0.7,
    });
    return { content: completion.choices[0].message.content || "" };
  } catch (error) {
    console.error(`Error generating chat response with OpenAI (${modelName}):`, error);
    throw new Error(`Failed to generate response with OpenAI (${modelName}).`);
  }
}

/**
 * Streams a chat response using the OpenAI API.
 * @param messages - The messages to send to the chat model.
 * @param modelName - The specific OpenAI model to use (e.g., 'gpt-4o').
 * @param signal - Optional AbortSignal to cancel the request.
 * @returns An object containing the async iterable stream compatible with other providers.
 */
export async function streamChatResponse(
  messages: ChatCompletionMessageParam[],
  modelName: string = "gpt-4o",
  signal?: AbortSignal // Add signal parameter
): Promise<{ stream: AsyncIterable<{ text: () => string }> }> {
  const client = getOpenAIClient();
  try {
    const stream = await client.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: 0.7,
      stream: true,
    }, { signal }); // Pass signal to the create method options

    const transformedStream = openAIStreamTransformer(stream);
    return { stream: transformedStream };
  } catch (error: any) {
    if (error.name === 'AbortError') {
        console.log(`OpenAI stream request aborted (${modelName}).`);
        // Re-throw the AbortError so the caller can handle it
        throw error;
    }
    console.error(`Error streaming chat response with OpenAI (${modelName}):`, error);
    throw new Error(`Failed to stream response with OpenAI (${modelName}).`);
  }
}
