import { ActionFunctionArgs } from "@remix-run/node";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { streamChatResponse as streamGeminiResponse } from "~/lib/ai/gemini";
import { streamChatResponse as streamOpenAIResponse } from "~/lib/ai/openai"; // Import OpenAI stream function
import { streamChatResponse as streamOpenRouterResponse } from "~/lib/ai/openrouter";
import { findLlmById, getDefaultLlm } from "~/lib/ai/models.config"; // Import model config helpers
import { v4 as uuidv4 } from "uuid";

/**
 * API endpoint for streaming chat responses based on selected model
 */
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const message = formData.get('message') as string;
  const chatId = formData.get('chatId') as string;
  const modelId = formData.get('model') as string; // Get the model ID (e.g., 'gemini-1.5-flash')

  // --- 1. Validate Input ---
  if (!message || !chatId || !modelId) {
    return new Response(JSON.stringify({ error: 'Missing required fields (message, chatId, model)' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- 2. Get Model Configuration ---
  const llmConfig = findLlmById(modelId);
  if (!llmConfig) {
    console.warn(`Unsupported model ID received: ${modelId}. Falling back to default.`);
    // Optionally fallback to default or return error
    // const defaultLlm = getDefaultLlm();
    // if (!defaultLlm) return new Response(JSON.stringify({ error: 'No default model configured.' }), { status: 500, ... });
    // llmConfig = defaultLlm;
     return new Response(JSON.stringify({ error: `Unsupported model: ${modelId}` }), {
       status: 400, headers: { 'Content-Type': 'application/json' }
     });
  }

  console.log(`Streaming request for model: ${llmConfig.name} (Provider: ${llmConfig.provider}, Model: ${llmConfig.modelName})`);

  try {
    // --- 3. Prepare Message History ---
    // TODO: In a real app, fetch actual history from DB based on chatId
    const messageHistory: ChatCompletionMessageParam[] = [{ role: 'user', content: message }];
    const adaptedHistory = adaptMessageHistory(messageHistory, llmConfig.provider);

    // --- 4. Create Streaming Response ---
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Get the AbortSignal from the request if passed (Remix might not pass it directly this way)
        // Alternatively, rely on the connection closing when the client aborts.
        // For robust cancellation, you might need a different mechanism like WebSockets
        // or passing a unique ID to cancel via another request.
        // For now, we primarily handle abort on the client.

        // Let's assume the signal *could* be available via the request object in some setups
        const signal = request.signal; // This might be null or undefined depending on server/setup

        try {
          let responseStreamResult: { stream: AsyncIterable<{ text: () => string }> };

          // --- 5. Route to Provider ---
          // Pass the signal *if* the underlying SDK supports it
          switch (llmConfig.provider) {
            case 'google':
              // Gemini's sendMessageStream accepts a signal in its options
              responseStreamResult = await streamGeminiResponse(adaptedHistory, { model: llmConfig.modelName }, signal);
              break;
            case 'openai':
              // OpenAI's SDK v4+ generally uses AbortSignal passed to the main client method
              // The streamChatResponse function needs to accept and pass it
               responseStreamResult = await streamOpenAIResponse(adaptedHistory, llmConfig.modelName, signal); // Modify openai.ts if needed
              break;
            case 'openrouter':
              // OpenRouter uses OpenAI's SDK, so same principle applies
               responseStreamResult = await streamOpenRouterResponse(adaptedHistory, llmConfig.modelName, signal); // Modify openrouter.ts if needed
              break;
            default:
              throw new Error(`Unsupported provider configured: ${llmConfig.provider}`);
          }

          // --- 6. Process Stream Chunks ---
          let fullResponse = '';
          for await (const chunk of responseStreamResult.stream) {
             // Optional: Check signal here too, though client abort handles UI
             if (signal?.aborted) {
                 console.log("Backend stream processing aborted.");
                 // Clean up resources if possible
                 controller.close(); // Close the stream from backend side
                 return;
             }
            try {
              const text = chunk.text(); // Use the common .text() method
              if (text) {
                fullResponse += text;
                // Stream each character
                for (const char of text) {
                  controller.enqueue(encoder.encode(char));
                  // await new Promise(resolve => setTimeout(resolve, 1)); // Optional delay
                }
              }
            } catch (chunkError) {
              console.error('Error processing chunk:', chunkError);
              // Optionally enqueue an error marker or just continue
              // controller.enqueue(encoder.encode(`[Chunk Error]`));
              continue;
            }
          }

          // --- 7. Send Completion Marker (only if not aborted) ---
          if (!signal?.aborted) {
              controller.enqueue(encoder.encode('\n\n__STREAM_COMPLETE__\n\n' + JSON.stringify({
                id: uuidv4(), // Generate ID here or potentially get from provider if available
                chat_id: chatId,
                role: 'assistant',
                content: fullResponse, // Send the complete content
                model: llmConfig.id, // Include the model ID used
                created_at: new Date().toISOString()
              })));
          } else {
              console.log("Backend aborted before sending completion marker.");
          }

          controller.close();
        } catch (error: any) {
           if (error.name === 'AbortError') {
               console.log("Backend AI request aborted.");
           } else {
               console.error(`Error in streaming response for model ${llmConfig.id}:`, error);
               // Avoid enqueueing error if controller is already closed/closing due to abort
               if (!signal?.aborted) {
                  try { controller.enqueue(encoder.encode(`\nError: Failed to get response from ${llmConfig.name}.`)); } catch {}
               }
           }
           try { controller.close(); } catch {} // Ensure controller is closed
        }
      }
    });

    // --- 8. Return Stream Response ---
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8', // Use text/plain or text/event-stream
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error(`Error setting up stream for model ${llmConfig.id}:`, error);
    return new Response(JSON.stringify({ error: `Failed to set up streaming response for ${llmConfig.name}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper to adapt message history format
function adaptMessageHistory(messages: ChatCompletionMessageParam[], provider: 'google' | 'openai' | 'openrouter'): any[] {
    if (provider === 'google') {
        // Gemini format: [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
        return messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model', // Gemini uses 'model' for assistant/system
            parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }] // Simple text parts
        }));
    } else {
        // OpenAI/OpenRouter format: [{ role: 'user' | 'assistant' | 'system', content: '...' }]
        // Ensure content is string only for these providers for simplicity here
        return messages.map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : ''
        }));
    }
}
