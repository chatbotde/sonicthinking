import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Generate the best possible chat title using OpenRouter, then Gemini as fallback.
 * Always returns a cleaned, non-empty title.
 */
import { generateTitleWithOpenRouter, buildTitlePrompt } from "./openroutertitle";
import { findLlmById } from "./models.config"; // Import config lookup

// Default configuration for the Gemini model
const DEFAULT_CONFIG = {
  temperature: 0.7,
  maxOutputTokens: 32000,
  topK: 40,
  topP: 0.95,
  model: "gemini-2.0-flash" // Default model
};

const GENERIC_TITLES = [
  "new", "chat", "conversation", "untitled", "assistant", "ai", "title", "talk"
];

/**
 * Get an instance of the Gemini API
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment variables. Using fallback logic.");
    
    // Fallback to search for key with different casing in case ENV vars are misconfigured
    const possibleKeys = [
      process.env.GOOGLE_GENERATIVE_AI_KEY,
      process.env.GOOGLE_AI_KEY,
      process.env.GOOGLE_API_KEY
    ];
    
    for (const key of possibleKeys) {
      if (key) {
        console.log("Using alternative API key");
        return new GoogleGenerativeAI(key);
      }
    }
    
    throw new Error("No valid API key found for Gemini. Please set GEMINI_API_KEY in your environment variables.");
  }
  
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate a response for a chat conversation using a specific Gemini model.
 */
export async function generateChatResponse(
  messages: { role: string; parts: { text: string }[] }[], // Expect Gemini format
  config: { model?: string; temperature?: number; maxOutputTokens?: number; topK?: number; topP?: number } = {}
) {
  const genAI = getGeminiClient();
  // Use provided model or fallback to a default Gemini model
  const modelName = config.model || DEFAULT_CONFIG.model;
  const generationConfig = {
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: config.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens,
      topK: config.topK ?? DEFAULT_CONFIG.topK,
      topP: config.topP ?? DEFAULT_CONFIG.topP,
  };

  try {
    console.log(`Generating Gemini response using ${modelName}`);

    // Format messages for Gemini's chat API - handle different formats
    // const formattedMessages = messages.map(msg => ({
    //   role: msg.role === "user" ? "user" : "model",
    //   parts: [{ text: msg.content || "" }]
    // }));
    
    // Get the model instance
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: generationConfig
    });
    
    // Workaround for potentially empty or malformed messages
    if (!messages.length || !messages[0].parts[0].text) {
      return {
        content: "I don't have enough context to respond. Could you provide more information?",
        model: modelName
      };
    }
    
    // If we only have one message, use a direct generation instead of chat
    if (messages.length === 1) {
      const prompt = messages[0].parts[0].text;
      console.log("Generating response to single message:", prompt.substring(0, 50) + "...");
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      return {
        content: responseText,
        model: modelName
      };
    }
    
    // For multiple messages, use the chat API
    // Ensure we have at least 2 messages for history
    const historyMessages = messages.length > 1 ? 
                          messages.slice(0, -1) : 
                          [];
    
    // Start a chat session
    const chat = model.startChat({
      history: historyMessages
    });
    
    // Send the last message to get a response
    const lastMessage = messages[messages.length - 1];
    console.log("Sending to Gemini:", lastMessage.parts[0].text.substring(0, 50) + "...");
    
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const responseText = result.response.text();
    
    return {
      content: responseText,
      model: modelName
    };
  } catch (error) {
    console.error("Error generating chat response:", error);
    
    // Return a user-friendly error message
    let errorMessage = "Sorry, I encountered an error processing your request.";
    
    // Type check the error before accessing properties
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage = "There's an issue with the API configuration. Please contact the administrator.";
      } else if (error.message.includes("quota")) {
        errorMessage = "We've reached our usage limit for the AI service. Please try again later.";
      } else if (error.message.includes("blocked")) {
        errorMessage = "Your request was blocked by the AI safety filters. Please try a different question.";
      }
      
      return {
        content: errorMessage,
        model: modelName,
        error: error.message
      };
    }
    
    return {
      content: errorMessage,
      model: modelName,
      error: String(error)
    };
  }
}

/**
 * Stream a chat response using a specific Gemini model
 */
export async function streamChatResponse(
  messages: { role: string; parts: { text: string }[] }[], // Expect Gemini format
  config: { model?: string; temperature?: number; maxOutputTokens?: number; topK?: number; topP?: number } = {},
  signal?: AbortSignal
) {
  const genAI = getGeminiClient();
  // Use provided model or fallback to a default Gemini model
  const modelName = config.model || DEFAULT_CONFIG.model;
   const generationConfig = {
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxOutputTokens: config.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens,
      topK: config.topK ?? DEFAULT_CONFIG.topK,
      topP: config.topP ?? DEFAULT_CONFIG.topP,
  };

  try {
    console.log(`Streaming Gemini response using ${modelName}`);
    // Get the model instance
    const model = genAI.getGenerativeModel({
      model: modelName, // Use the specific model name
      generationConfig: generationConfig
    });

    // Start a chat session
    // Ensure history format is correct for startChat
    const history = messages.length > 1 ? messages.slice(0, -1) : [];
    const chat = model.startChat({ history });

    // Send the last message to get a streaming response
    const lastMessage = messages[messages.length - 1];
    // Ensure lastMessage and its parts are valid before sending
    if (!lastMessage || !lastMessage.parts || !lastMessage.parts[0] || typeof lastMessage.parts[0].text !== 'string') {
        throw new Error("Invalid last message format for streaming.");
    }
    const result = await chat.sendMessageStream(lastMessage.parts[0].text, { signal });

    // Return the stream result directly, the caller will handle the { text: () => string } transformation if needed
    // Or adapt it here if consistency is desired across all provider functions
    // Example adaptation:
    // async function* transformStream() {
    //    for await (const chunk of result.stream) {
    //        const text = chunk.text();
    //        if (text) yield { text: () => text };
    //    }
    // }
    // return { stream: transformStream() };

    return result; // Returning the raw Gemini stream result for now

  } catch (error) {
    console.error(`Error streaming Gemini response (${modelName}):`, error);
    throw error; // Re-throw to be caught by the caller
  }
}

// Convert Gemini messages to UI messages
export function convertGeminiMessagesToUIMessages(messages: Array<{ role: string; content: string }>) {
  return messages.map((message, index) => ({
    id: `message-${index}`,
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content,
    createdAt: new Date().toISOString(),
  }));
}

// Helper function to fetch first two messages
async function fetchFirstMessages(chatId: string, supabase: SupabaseClient, userId: string): Promise<{ role: string; content: string }[] | null> {
  const { data: messages, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .eq("user_id", userId) // Ensure user owns the messages being fetched
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(2);

  if (error || !messages || messages.length < 2) {
    console.error(`Error fetching messages for title generation (Chat ${chatId}):`, error);
    return null;
  }
  if (messages[0].role !== 'user' || messages[1].role !== 'assistant') {
     console.warn(`Unexpected message sequence for title generation (Chat ${chatId})`);
     return null; // Or handle differently if needed
  }
  return messages;
}

// Centralized function for generating the best chat title
// Consider making OpenRouter the primary attempt
export async function generateBestChatTitle(
  input: { messages: { role: string; content: string }[] } | { chatId: string; supabase: SupabaseClient; userId: string },
  // Remove optional model parameter, decide internally which model to use
): Promise<string> {
  let messages: { role: string; content: string }[] | null = null;
  let fetchedMessages = false;

  // --- 1. Get Messages ---
  if ('messages' in input) {
    messages = input.messages;
  } else if ('chatId' in input && input.supabase && input.userId) {
    messages = await fetchFirstMessages(input.chatId, input.supabase, input.userId);
    fetchedMessages = true;
  }

  if (!messages || messages.length < 2) {
    console.warn("Insufficient messages for title generation.");
    // Attempt fallback with first message if available
    const firstUserMessage = messages?.find(m => m.role === 'user')?.content;
    return firstUserMessage
      ? cleanTitle(firstUserMessage.slice(0, 48).replace(/[^a-zA-Z0-9 ]/g, '').trim() + '...')
      : "New Chat";
  }

  const userMsg = messages.find(m => m.role === 'user')?.content || '';
  const assistantMsg = messages.find(m => m.role === 'assistant')?.content || '';

  if (!userMsg) {
     console.warn("User message content is empty, cannot generate title effectively.");
     return "New Chat";
  }

  // --- 2. Title Generation Attempts ---
  const getTitleWithRetry = async (attempts = 0): Promise<string> => {
    try {
      // Attempt 1: OpenRouter (Primary)
      try {
        console.log(`Title generation attempt ${attempts + 1}: Trying OpenRouter...`);
        const openRouterPrompt = buildTitlePrompt(userMsg, assistantMsg);
        // Use a specific, potentially cheap/fast OpenRouter model for titles
        // Find the config for a suitable model, e.g., Haiku or a free tier model if available
        const titleModelConfig = findLlmById('deepseek-chat') || findLlmById('openai-gpt-3.5-turbo'); // Example fallback
        let title = "New Chat"; // Default
        if (titleModelConfig && titleModelConfig.provider === 'openrouter') {
             // Pass prompt and model name
             title = await generateTitleWithOpenRouter(openRouterPrompt, titleModelConfig.modelName);
        } else {
            console.warn("Suitable OpenRouter model for title generation not found in config.");
            // Fallback to Gemini or skip OpenRouter attempt
             // Pass only prompt if no specific model config found
             title = await generateTitleWithOpenRouter(openRouterPrompt); // Use default model within the function
        }

        title = cleanTitle(title);
        if (isValidTitle(title)) return title;
        console.log('OpenRouter title failed or invalid, trying Gemini fallback.');
      } catch (err) {
        console.warn('OpenRouter title generation failed:', err);
      }

      // Attempt 2: Gemini Input/Output Summary (Fallback)
      try {
        console.log(`Title generation attempt ${attempts + 1}: Trying Gemini...`);
        const genAI = getGeminiClient();
        // Use a specific, potentially cheaper/faster model for titles
        const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

        let title = await generateInputOutputSummaryTitle(userMsg, assistantMsg, geminiModel);
        title = cleanTitle(title);
        if (isValidTitle(title)) return title;
        console.log('Gemini title failed or invalid, using snippet fallback.');
      } catch (err) {
        console.warn('Gemini title generation failed:', err);
      }


      // Retry logic (if desired)
      if (attempts < 1) {
         console.log(`Retrying title generation (Attempt ${attempts + 1})`);
         await new Promise(resolve => setTimeout(resolve, 500));
         return getTitleWithRetry(attempts + 1);
      }

      // Final Fallback: Snippet
      console.log('All title generation methods failed or produced invalid titles. Using snippet fallback.');
      return cleanTitle(userMsg.slice(0, 48).replace(/[^a-zA-Z0-9 ]/g, '').trim() + '...');

    } catch (error) {
      console.error(`Critical error during title generation attempt ${attempts + 1}:`, error);
      if (attempts < 1) { // Retry on critical errors too? Be cautious.
        return getTitleWithRetry(attempts + 1);
      }
      // Final fallback after critical error
      return cleanTitle(userMsg.slice(0, 48).replace(/[^a-zA-Z0-9 ]/g, '').trim() + '...');
    }
  };

  const isValidTitle = (title: string): boolean => {
    const cleaned = title.toLowerCase().trim();
    return !!cleaned &&
           cleaned.length > 3 &&
           cleaned.length <= 100 && // Ensure reasonable length
           !GENERIC_TITLES.some(t => cleaned.includes(t)) &&
           cleaned !== "new chat" &&
           cleaned !== "..."; // Avoid empty snippet fallback
  };

  // Execute title generation
  let finalTitle = await getTitleWithRetry();

  // Ensure final fallback if everything else returns empty/invalid
  if (!isValidTitle(finalTitle)) {
      finalTitle = cleanTitle(userMsg.slice(0, 48).replace(/[^a-zA-Z0-9 ]/g, '').trim() + '...');
      if (!finalTitle) finalTitle = "New Chat"; // Absolute last resort
  }

  console.log(`Final generated title: "${finalTitle}"`);
  return finalTitle;
}

function cleanTitle(title: string): string {
  if (!title) return "";
  // Remove quotes, markdown, and generic words
  let t = title.replace(/^\s*["'`*\-]+|["'`*\-]+\s*$/g, "");
  t = t.replace(/\b(Chat|Summary|Conversation|Title)\b/gi, "").trim();
  t = t.replace(/\s{2,}/g, " ");
  return t.substring(0, 100);
}

/**
 * Generate a chat title as a summary of both the user input and AI output.
 * The title will be a concise summary of the conversation so far.
 */
export async function generateInputOutputSummaryTitle(
  userInput: string,
  aiOutput: string,
  model?: GenerativeModel
): Promise<string> {
  if (!userInput || !aiOutput) return "New Chat";
  try {
    let geminiModel = model;
    if (!geminiModel) {
      const genAI = getGeminiClient();
      geminiModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
    }
    const prompt = `Create a concise 4-6 word title capturing both the user's question and AI's response. Focus on the core topic and solution.\n\nQuestion: ${userInput}\nResponse: ${aiOutput}\n\nTitle Requirements:
1. Combine key elements from both question and answer
2. Use specific terms from the exchange
3. Avoid generic words like "chat" or "discussion"
4. Format as a noun phrase without complete sentences
5. Maximum 6 words

Title:`;
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    let title = response.text().trim();
    // Clean up title
    title = title.replace(/^\s*["'`*\-]+|["'`*\-]+\s*$/g, "");
    title = title.replace(/\b(Chat|Summary|Conversation|Title)\b/gi, "").trim();
    title = title.replace(/\s{2,}/g, " ");
    return title.length > 2 ? title.substring(0, 100) : "New Chat";
  } catch (err) {
    return "New Chat";
  }
}

export { getGeminiClient };
