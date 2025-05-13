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

// Add a cache to prevent regenerating the same titles repeatedly
const titleGenerationCache = new Map<string, string>();

// Centralized function for generating the best chat title
export async function generateBestChatTitle(
  input: { messages: { role: string; content: string }[] } | { chatId: string; supabase: SupabaseClient; userId: string },
): Promise<string> {
  let messages: { role: string; content: string }[] | null = null;
  let fetchedMessages = false;
  let chatId: string | null = null;

  // --- 1. Get Messages and check cache ---
  if ('chatId' in input) {
    chatId = input.chatId;
    // Check cache first
    if (chatId && titleGenerationCache.has(chatId)) {
      console.log(`Using cached title for chat ${chatId}: "${titleGenerationCache.get(chatId)}"`);
      return titleGenerationCache.get(chatId) || "New Chat";
    }
    
    messages = await fetchFirstMessages(input.chatId, input.supabase, input.userId);
    fetchedMessages = true;
  } else if ('messages' in input) {
    messages = input.messages;
    console.log(`Received ${messages.length} messages for title generation`);
    
    // Create a cache key from first user message if we don't have a chatId
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
      if (firstUserMsg) {
        const cacheKey = `msg_${firstUserMsg.substring(0, 50)}`;
        if (titleGenerationCache.has(cacheKey)) {
          console.log(`Using cached title for message: "${titleGenerationCache.get(cacheKey)}"`);
          return titleGenerationCache.get(cacheKey) || "New Chat";
        }
      }
    }
  }

  if (!messages || messages.length === 0) {
    console.warn("No messages available for title generation.");
    return "New Chat";
  }

  // Find user and assistant messages
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  if (userMessages.length === 0) {
    console.warn("No user messages found, cannot generate title effectively.");
    return "New Chat";
  }

  // Get the first user message and first assistant message (if available)
  const userMsg = userMessages[0].content || '';
  const assistantMsg = assistantMessages.length > 0 ? assistantMessages[0].content || '' : '';

  // Log what we're using for title generation
  console.log(`Generating title using: 
    User message: ${userMsg.substring(0, 100)}...
    Assistant message: ${assistantMsg ? assistantMsg.substring(0, 100) + '...' : 'None'}`);

  // --- 2. Title Generation with Gemini ---
  try {
    console.log("Using Gemini for title generation");
    const genAI = getGeminiClient();
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    let title = await generateInputOutputSummaryTitle(userMsg, assistantMsg, geminiModel);
    title = cleanTitle(title);
    
    if (isValidTitle(title)) {
      console.log(`Successfully generated title: "${title}"`);
      
      // Store in cache
      if (chatId) {
        titleGenerationCache.set(chatId, title);
      } else {
        // Cache by first user message if no chatId
        const cacheKey = `msg_${userMsg.substring(0, 50)}`;
        titleGenerationCache.set(cacheKey, title);
      }
      
      return title;
    }
    
    console.log('Direct title generation failed, trying fallback method...');
    
    // Try with a different prompt as fallback
    const fallbackTitle = await generateFallbackTitle(userMsg, geminiModel);
    
    if (isValidTitle(fallbackTitle)) {
      console.log(`Fallback title generation succeeded: "${fallbackTitle}"`);
      
      // Store in cache
      if (chatId) {
        titleGenerationCache.set(chatId, fallbackTitle);
      }
      
      return fallbackTitle;
    }
    
    // Ultimate fallback: use the beginning of the user message
    console.log('All title generation methods failed, using snippet fallback');
    const snippetTitle = generateSnippetTitle(userMsg);
    
    // Store in cache
    if (chatId) {
      titleGenerationCache.set(chatId, snippetTitle);
    }
    
    return snippetTitle;
  } catch (error) {
    console.error("Error during title generation:", error);
    return generateSnippetTitle(userMsg);
  }
}

// Helper function for fallback title generation
async function generateFallbackTitle(userInput: string, model: GenerativeModel): Promise<string> {
  try {
    const prompt = `Create a very short title (2-4 words) for this question: "${userInput.slice(0, 200)}"`;
    const result = await model.generateContent(prompt);
    return cleanTitle(result.response.text());
  } catch (err) {
    console.error("Fallback title generation failed:", err);
    return "";
  }
}

// Generate a title from the first part of the user message
function generateSnippetTitle(userMsg: string): string {
  const snippet = userMsg.slice(0, 48).replace(/[^a-zA-Z0-9 ]/g, '').trim() + '...';
  return cleanTitle(snippet) || "New Chat";
}

// Validate if a title is acceptable
function isValidTitle(title: string): boolean {
  const cleaned = title.toLowerCase().trim();
  return !!cleaned &&
         cleaned.length > 3 &&
         cleaned.length <= 100 && // Ensure reasonable length
         !GENERIC_TITLES.some(t => cleaned.includes(t)) &&
         cleaned !== "new chat" &&
         cleaned !== "..."; // Avoid empty snippet fallback
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
  if (!userInput) return "New Chat";
  try {
    let geminiModel = model;
    if (!geminiModel) {
      const genAI = getGeminiClient();
      geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    }
    
    // Improved prompt to generate better titles
    const prompt = `Generate a brief, descriptive title (3-5 words) that captures the core topic from this conversation:

User: ${userInput.slice(0, 250)}
${aiOutput ? `AI: ${aiOutput.slice(0, 250)}` : ''}

REQUIREMENTS:
- Title should be 3-5 words maximum
- Focus specifically on the main topic or question
- Be descriptive and specific
- Avoid generic words like "chat", "conversation" or "assistance"
- Don't use quotes or punctuation in the title
- Make it useful for finding this conversation later

ONLY OUTPUT THE TITLE, NOTHING ELSE.`;

    console.log("Using title prompt:", prompt.substring(0, 100) + "...");
    
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    let title = response.text().trim();
    
    // Clean up title
    title = title.replace(/^\s*["'`*\-]+|["'`*\-]+\s*$/g, "");
    title = title.replace(/\b(Chat|Summary|Conversation|Title)\b/gi, "").trim();
    title = title.replace(/\s{2,}/g, " ");
    
    console.log(`Raw generated title: "${title}"`);
    return title.length > 2 ? title.substring(0, 100) : "New Chat";
  } catch (err) {
    console.error("Error in generateInputOutputSummaryTitle:", err);
    return userInput.slice(0, 30) + "..."; // Use beginning of user input as fallback
  }
}

export { getGeminiClient };
