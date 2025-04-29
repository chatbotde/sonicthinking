import { json } from "@remix-run/node";
// Remove direct AI SDK imports if not used here anymore
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import OpenAI from 'openai';
import { findLlmById } from "~/lib/ai/models.config"; // Keep config lookup if needed

// Potentially keep title generation if it's a non-streaming task handled here
// import { generateBestChatTitle } from "~/lib/ai/gemini";

export async function action({ request }: { request: Request }) {
  let message: string | undefined,
      chatId: string | undefined,
      modelId: string | undefined, // Expect model ID
      intent: string | undefined; // Add intent for potential actions

  try {
    const body = await request.json();
    message = body.message;
    chatId = body.chatId;
    modelId = body.model; // Get model ID
    intent = body.intent; // Get intent
  } catch (e) {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Example: Handle a specific non-streaming intent like title generation
  if (intent === 'generate-title') {
      if (!chatId || !message) { // Or require message history instead of single message
          return json({ error: "Missing chatId or message history for title generation" }, { status: 400 });
      }
      try {
          // TODO: Implement title generation logic here if needed
          // const newTitle = await generateBestChatTitle({ chatId, supabase, userId }); // Needs supabase/userId context
          console.warn("Title generation via /api/ai endpoint not fully implemented.");
          return json({ title: "Title Generation Pending" });
      } catch (error: any) {
          console.error(`Error generating title:`, error);
          return json({ error: `Failed to generate title: ${error.message}` }, { status: 500 });
      }
  }

  // --- Default Non-Streaming Chat (Likely Deprecated) ---
  if (!message) {
    return json({ error: "Message content is required for default action" }, { status: 400 });
  }
  if (!modelId) {
    return json({ error: "Model ID is required for default action" }, { status: 400 });
  }

  const llmConfig = findLlmById(modelId);
  if (!llmConfig) {
      return json({ error: `Unsupported model: ${modelId}` }, { status: 400 });
  }

  console.warn(`Non-streaming request received for model ${llmConfig.name}. This path might be deprecated.`);

  // Placeholder for non-streaming generation - recommend using streaming endpoint instead
  try {
    let aiResponse = `Response from ${llmConfig.name} (non-streaming - not implemented)`;

    // Example structure if you were to implement non-streaming calls:
    // switch (llmConfig.provider) {
    //   case 'google':
    //     // Call Gemini non-streaming generate function
    //     break;
    //   case 'openai':
    //     // Call OpenAI non-streaming generate function
    //     break;
    //   case 'openrouter':
    //     // Call OpenRouter non-streaming generate function
    //     break;
    //   default:
    //     throw new Error(`Unsupported provider: ${llmConfig.provider}`);
    // }

    return json({ response: aiResponse, modelUsed: llmConfig.id });

  } catch (error: any) {
    console.error(`Error in non-streaming AI API (${llmConfig.name}):`, error);
    return json({ error: `Failed to fetch non-streaming response from ${llmConfig.name}: ${error.message}` }, { status: 500 });
  }
}