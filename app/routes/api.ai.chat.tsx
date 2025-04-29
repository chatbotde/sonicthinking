// External libraries
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient, User } from "@supabase/supabase-js"; // Import User type

// Internal modules
import { createServerSupabaseClient } from '~/lib/supabase/server';
import { authenticator, requireAuth } from '~/lib/auth.server';
// Import specific AI generation functions if needed for non-streaming tasks here
import { generateChatResponse as generateGeminiResponse } from "~/lib/ai/gemini";
import { generateChatResponse as generateOpenAIResponse } from "~/lib/ai/openai";
import { generateChatResponse as generateOpenRouterResponse } from "~/lib/ai/openrouter";
import { generateBestChatTitle } from "~/lib/ai/gemini"; // Keep for title generation intent
import { findLlmById, getDefaultLlm } from "~/lib/ai/models.config"; // Import model config

// Define types for better type safety
type MessageRole = 'user' | 'assistant';
interface Message {
  role: MessageRole;
  content: string;
  created_at?: string; // <-- Add this line
};

// Centralized error response helper
function errorResponse(message: string, status = 500, headers?: HeadersInit, details?: any) {
  console.error(`Error (${status}): ${message}`, details ? { details } : ''); // Log errors centrally
  return json({ error: message, ...(details ? { details } : {}) }, { status, headers });
}

// --- Database Helper Functions ---

/** Creates or validates a chat ID and ensures the chat exists for the user. */
async function ensureChatExists(
  supabase: SupabaseClient,
  userId: string,
  chatId: string | null
): Promise<{ validChatId: string; needsTitleGeneration: boolean; error?: Response }> {
  let validChatId = chatId || uuidv4();
  let needsTitleGeneration = false;

  // Validate UUID format if provided
  if (chatId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId)) {
     console.warn(`Invalid chatId format received: ${chatId}. Generating new UUID.`);
     validChatId = uuidv4();
     needsTitleGeneration = true; // New chat needs a title
  }

  try {
    const { data: existingChat, error: checkChatError } = await supabase
      .from('chats')
      .select('id, title')
      .eq('id', validChatId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkChatError) {
      return { validChatId, needsTitleGeneration, error: errorResponse('Database error checking chat.', 500, undefined, checkChatError.message) };
    }

    if (!existingChat) {
      console.log(`Chat ${validChatId} not found for user ${userId}. Creating...`);
      const { error: insertChatError } = await supabase
        .from('chats')
        .insert([{
          id: validChatId,
          title: 'New Chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: userId,
          visibility: 'private',
        }]);

      if (insertChatError) {
        return { validChatId, needsTitleGeneration, error: errorResponse('Failed to create chat.', 500, undefined, insertChatError.message) };
      }
      needsTitleGeneration = true; // Newly created chat needs a title
    } else if (existingChat.title === 'New Chat') {
      needsTitleGeneration = true; // Existing chat still needs a title
    }

    return { validChatId, needsTitleGeneration };
  } catch (err: any) {
     return { validChatId, needsTitleGeneration, error: errorResponse('Failed to verify or create chat session.', 500, undefined, err.message) };
  }
}

/** Saves a message to the database. */
async function saveMessage(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  role: MessageRole,
  content: string
): Promise<{ messageId: string; error?: Response }> {
  const messageId = uuidv4();
  try {
    const { error } = await supabase
      .from('messages')
      .insert([{
        id: messageId,
        chat_id: chatId,
        role,
        content,
        created_at: new Date().toISOString(),
        user_id: userId,
      }]);

    if (error) {
      console.error(`Error saving ${role} message for chat ${chatId}:`, error);
      // Decide whether to return an error or just log. For now, log and continue.
      // return { messageId, error: errorResponse(`Failed to save ${role} message.`, 500, undefined, error.message) };
    }
    return { messageId };
  } catch (err: any) {
    console.error(`Unexpected error saving ${role} message for chat ${chatId}:`, err);
    // return { messageId, error: errorResponse(`Failed to save ${role} message.`, 500, undefined, err.message) };
    return { messageId }; // Log and continue
  }
}

/** Fetches message history for a chat. */
async function getMessageHistory(
  supabase: SupabaseClient,
  chatId: string
): Promise<{ history: Message[]; error?: Response }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('role, content, created_at') // <-- Add created_at here
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      return { history: [], error: errorResponse('Error fetching message history.', 500, undefined, error.message) };
    }
    return { history: (data as Message[]) || [] };
  } catch (err: any) {
    return { history: [], error: errorResponse('Unexpected error fetching message history.', 500, undefined, err.message) };
  }
}

/** Generates and updates the chat title if needed. */
async function generateAndUpdateTitleIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  chatId: string,
  forceRegeneration: boolean = false // Add flag for explicit regeneration
): Promise<{ error?: Response }> {
  try {
    let needsUpdate = forceRegeneration;
    if (!forceRegeneration) {
      const { data: currentChat, error: fetchChatError } = await supabase
        .from('chats')
        .select('title')
        .eq('id', chatId)
        .eq('user_id', userId)
        .single();

      if (fetchChatError) {
        // Log error but don't block the main flow if title generation isn't critical
        console.error(`Error fetching chat ${chatId} for title check:`, fetchChatError);
        return {}; // Proceed without title generation attempt
      }
      if (currentChat && currentChat.title === 'New Chat') {
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      console.log(`Attempting title generation for chat ${chatId} (force=${forceRegeneration})...`);
      const newTitle = await generateBestChatTitle({ chatId, supabase, userId });

      if (newTitle && newTitle !== 'New Chat') {
        const { error: updateTitleError } = await supabase
          .from('chats')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', chatId)
          .eq('user_id', userId);

        if (updateTitleError) {
          console.error(`Failed to update title for chat ${chatId}:`, updateTitleError);
          // Log error, maybe return it depending on criticality
          // return { error: errorResponse('Failed to save generated title.', 500, undefined, updateTitleError.message) };
        } else {
          console.log(`Updated title for chat ${chatId} to "${newTitle}".`);
        }
      } else {
        console.log(`Title generation skipped or failed for chat ${chatId} (result: '${newTitle}').`);
      }
    } else {
       console.log(`Title generation not needed for chat ${chatId}.`);
    }
    return {}; // Success (or skipped)
  } catch (titleError: any) {
    console.error(`Error during title generation/update for chat ${chatId}:`, titleError);
    // return { error: errorResponse('Failed during title generation process.', 500, undefined, titleError.message) };
    return {}; // Log error and continue
  }
}


// --- Main Loader ---
export async function loader({ request }: LoaderFunctionArgs) {
  // ... existing loader code ...
  try {
    const { session } = await requireAuth(request);
    return json({ user: session?.user || null });
  } catch (err: any) {
    // Use centralized error response
    return errorResponse('Failed to load user session', 500, undefined, err?.message);
  }
}

// --- Main Action Handler ---
export async function action({ request }: ActionFunctionArgs) {
  const response = new Response(); // Keep for potential header propagation if needed later
  let session: { user: User | null } | null = null; // Use Supabase User type
  let supabase: SupabaseClient | null = null;

  try {
    ({ session, supabase } = await requireAuth(request));
    if (!session?.user || !supabase) {
      // Throw to be caught by the outer catch block
      throw new Error('Authentication failed or Supabase client unavailable.');
    }
  } catch (err: any) {
    return errorResponse('Unauthorized', 401, response.headers, err?.message);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: any) {
    return errorResponse('Invalid form data', 400, response.headers, err?.message);
  }

  const intent = formData.get('intent') as string;
  const user = session.user; // User is guaranteed non-null here

  // Intent handler map
  const intentHandlers: Record<string, Function> = {
    'chat': handleChatIntent,
    'create-chat': handleCreateChatIntent,
    'edit-message': handleEditMessageIntent,
    'regenerate-title': handleRegenerateTitleIntent,
  };

  const handler = intentHandlers[intent];
  if (!handler) {
    return errorResponse('Invalid intent', 400, response.headers);
  }

  try {
    // Pass necessary context: formData, user, supabase, response headers
    return await handler(formData, user, supabase, response.headers);
  } catch (err: any) {
    // Catch errors thrown from handlers or unexpected errors
    console.error(`Unhandled error in intent handler '${intent}':`, err);
    return errorResponse('Internal server error', 500, response.headers, err?.message);
  }
}

// Helper to adapt message history format (similar to api.stream.ts)
function adaptMessageHistoryForNonStreaming(messages: Message[], provider: 'google' | 'openai' | 'openrouter'): any[] {
    if (provider === 'google') {
        return messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || "" }]
        }));
    } else {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content || ""
        }));
    }
}


// --- Intent Handlers ---

// Handler for the chat intent (Likely less used if frontend uses /api/stream)
async function handleChatIntent(
  formData: FormData,
  user: User,
  supabase: SupabaseClient,
  headers: HeadersInit
) {
  const chatIdFromRequest = formData.get('chatId') as string | null;
  const messageContent = formData.get('message') as string;
  const isStreaming = formData.get('stream') === 'true'; // Check if streaming was intended
  const modelId = formData.get('model') as string | null; // Get model ID

  console.warn("handleChatIntent in api.ai.chat.tsx invoked. Frontend should ideally use /api/stream directly.");

  if (isStreaming) {
      // This endpoint shouldn't handle streaming directly.
      // The frontend ChatContext calls /api/stream.
      return errorResponse('Streaming requests should go to /api/stream', 400, headers);
  }

  // --- Handle Non-Streaming Chat (if still needed) ---
  if (!messageContent) return errorResponse('Missing message content', 400, headers);
  if (!modelId) return errorResponse('Missing model ID for non-streaming chat', 400, headers);

  const llmConfig = findLlmById(modelId);
  if (!llmConfig) return errorResponse(`Unsupported model: ${modelId}`, 400, headers);

  // 1. Ensure Chat Exists
  const { validChatId, needsTitleGeneration, error: chatError } = await ensureChatExists(supabase, user.id, chatIdFromRequest);
  if (chatError) return chatError;

  // 2. Save User Message
  const { error: userMsgError } = await saveMessage(supabase, validChatId, user.id, 'user', messageContent);
  if (userMsgError) console.error(`Failed to save user message for chat ${validChatId} (non-streaming).`); // Log and continue

  // 3. Fetch History
  const { history: messageHistory, error: historyError } = await getMessageHistory(supabase, validChatId);
  if (historyError) return historyError;
  if (messageHistory.length === 0) messageHistory.push({ role: 'user', content: messageContent });

  // 4. Generate Non-Streaming AI Response
  try {
      const adaptedHistory = adaptMessageHistoryForNonStreaming(messageHistory, llmConfig.provider);
      let assistantResponseResult: { content: string };

      switch(llmConfig.provider) {
          case 'google':
              assistantResponseResult = await generateGeminiResponse(adaptedHistory, { model: llmConfig.modelName });
              break;
          case 'openai':
              assistantResponseResult = await generateOpenAIResponse(adaptedHistory, llmConfig.modelName);
              break;
          case 'openrouter':
              assistantResponseResult = await generateOpenRouterResponse(adaptedHistory, llmConfig.modelName);
              break;
          default:
              throw new Error(`Unsupported provider: ${llmConfig.provider}`);
      }

      const responseText = assistantResponseResult.content || "Sorry, I couldn't generate a response.";

      // 5. Save Assistant Message
      const { messageId: assistantMessageId, error: assistantMsgError } = await saveMessage(supabase, validChatId, user.id, 'assistant', responseText);
      if (assistantMsgError) console.error(`Failed to save assistant message for chat ${validChatId} (non-streaming).`);

      // 6. Generate Title if Needed
      if (needsTitleGeneration) {
        await generateAndUpdateTitleIfNeeded(supabase, user.id, validChatId);
      }

      return json({
        response: responseText,
        chatId: validChatId,
        assistantMessageId,
        modelUsed: llmConfig.id // Return model used
      }, { headers });

  } catch (error: any) {
    console.error(`Error generating non-streaming AI response for chat ${validChatId} (${llmConfig.name}):`, error);
    return errorResponse('Failed to process non-streaming chat request', 500, headers, error.message);
  }
}


// Handler for creating a new chat explicitly
async function handleCreateChatIntent(
  formData: FormData, // Keep formData in case needed later
  user: User,
  supabase: SupabaseClient,
  headers: HeadersInit
) {
  const newChatId = uuidv4();
  try {
    const { error: insertChatError } = await supabase
      .from('chats')
      .insert([{
        id: newChatId,
        title: 'New Chat', // Start with default title
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: user.id,
        visibility: 'private',
      }]);

    if (insertChatError) {
      return errorResponse('Failed to create new chat.', 500, headers, insertChatError.message);
    }

    console.log(`New chat created explicitly with ID: ${newChatId} for user ${user.id}`);
    return json({ chatId: newChatId }, { headers });

  } catch (err: any) {
    return errorResponse('Failed to create new chat session.', 500, headers, err.message);
  }
}

// Handler for editing a message
async function handleEditMessageIntent(
  formData: FormData,
  user: User,
  supabase: SupabaseClient,
  headers: HeadersInit
) {
  const messageId = formData.get('messageId') as string;
  const newContent = formData.get('newContent') as string;
  const chatId = formData.get('chatId') as string;
  const modelId = formData.get('model') as string | null; // Get model ID for regeneration

  if (!messageId || !newContent || !chatId) {
    return errorResponse('Missing required fields for edit (messageId, newContent, chatId)', 400, headers);
  }
  if (!modelId) {
      // Fallback to default model if not provided for regeneration
      console.warn("Model ID not provided for edit/regeneration, using default.");
      // modelId = getDefaultLlm()?.id;
      // if (!modelId) return errorResponse('Default model not configured for regeneration', 500, headers);
       return errorResponse('Model ID is required for regeneration after edit', 400, headers); // Or make it required
  }

  const llmConfig = findLlmById(modelId);
  if (!llmConfig) return errorResponse(`Unsupported model for regeneration: ${modelId}`, 400, headers);


  // 1. Update the user's message
  let editedMessageTimestamp: string | null = null;
  try {
    const { data, error: updateError } = await supabase
      .from('messages')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('role', 'user') // Ensure only user messages
      .eq('chat_id', chatId) // Scope to chat
      // .eq('user_id', user.id) // Add ownership check
      .select('created_at') // Select timestamp for deletion step
      .single(); // Expect exactly one row

    if (updateError) {
      return errorResponse('Failed to update message.', 500, headers, updateError.message);
    }
    if (!data) {
       return errorResponse('Message not found or not owned by user.', 404, headers);
    }
    editedMessageTimestamp = data.created_at;

  } catch (err: any) {
    return errorResponse('Failed to update message.', 500, headers, err.message);
  }

  // 2. Delete subsequent messages
  try {
    if (!editedMessageTimestamp) {
        throw new Error("Edited message timestamp not available for deletion.");
    }
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', chatId)
      .gt('created_at', editedMessageTimestamp); // Delete messages after the edited one

    if (deleteError) {
      console.error(`Error deleting subsequent messages for chat ${chatId} after edit:`, deleteError);
      // Decide if this is critical. Maybe log and continue.
    }
  } catch (err: any) {
    console.error(`Unexpected error deleting subsequent messages for chat ${chatId}:`, err);
  }

  // 3. Fetch updated message history (up to the edited point)
  const { history: messageHistory, error: historyError } = await getMessageHistory(supabase, chatId);
   if (historyError) return historyError;
   // Filter history to include only messages up to the edited one based on timestamp
   const filteredHistory = messageHistory.filter(
     msg =>
       msg.created_at !== undefined &&
       editedMessageTimestamp !== null &&
       editedMessageTimestamp !== undefined &&
       new Date(msg.created_at) <= new Date(editedMessageTimestamp)
   );


  // 4. Regenerate AI response (Non-Streaming for simplicity in this handler)
  try {
    const adaptedHistory = adaptMessageHistoryForNonStreaming(filteredHistory, llmConfig.provider); // Use filtered history
    let assistantResponseResult: { content: string };

    console.log(`Regenerating response after edit using ${llmConfig.name}`);

    switch(llmConfig.provider) {
        case 'google':
            assistantResponseResult = await generateGeminiResponse(adaptedHistory, { model: llmConfig.modelName });
            break;
        case 'openai':
            assistantResponseResult = await generateOpenAIResponse(adaptedHistory, llmConfig.modelName);
            break;
        case 'openrouter':
            assistantResponseResult = await generateOpenRouterResponse(adaptedHistory, llmConfig.modelName);
            break;
        default:
            throw new Error(`Unsupported provider: ${llmConfig.provider}`);
    }

    const responseText = assistantResponseResult.content || "Sorry, I couldn't regenerate a response.";

    // Save the new assistant message
    const { messageId: assistantMessageId, error: assistantMsgError } = await saveMessage(supabase, chatId, user.id, 'assistant', responseText);
    if (assistantMsgError) {
        console.error(`Failed to save regenerated assistant message for chat ${chatId}.`);
    }

    return json({
      response: responseText,
      assistantMessageId,
      modelUsed: llmConfig.id // Return model used
    }, { headers });

  } catch (error: any) {
    console.error(`Error regenerating AI response after edit for chat ${chatId} (${llmConfig.name}):`, error);
    return errorResponse('Failed to regenerate AI response', 500, headers, error.message);
  }
}


// Handler for regenerating chat titles (uses generateBestChatTitle internally)
async function handleRegenerateTitleIntent(
  formData: FormData,
  user: User,
  supabase: SupabaseClient,
  headers: HeadersInit
) {
  const chatId = formData.get('chatId') as string;

  if (!chatId) {
    return errorResponse('Chat ID is required for title regeneration', 400, headers);
  }

  // TODO: Add check to ensure user owns the chat

  // Call the centralized title generation function with force=true
  const { error: titleError } = await generateAndUpdateTitleIfNeeded(supabase, user.id, chatId, true);

  if (titleError) {
    // The helper function already logs details, just return the error response
    return titleError;
  }

  // Fetch the potentially updated title to return it
  try {
      const { data, error: fetchError } = await supabase
          .from('chats')
          .select('title')
          .eq('id', chatId)
          .eq('user_id', user.id)
          .single();

      // Check for error first
      if (fetchError) {
          console.error(`Failed to fetch updated title for chat ${chatId} after regeneration:`, fetchError);
          // Return success=true because regeneration likely worked, but title fetch failed
          return json({ success: true, title: null, error: `Regeneration succeeded, but failed to fetch updated title: ${fetchError.message}` }, { headers });
      }
      // Check if data exists after confirming no error
      if (!data) {
          console.error(`Chat ${chatId} not found after title regeneration.`);
           // Should not happen if regeneration succeeded, but handle defensively
          return json({ success: true, title: null, error: 'Regeneration succeeded, but chat not found afterwards.' }, { headers });
      }


      console.log(`Successfully regenerated title for chat ${chatId}. New title: "${data.title}"`);
      return json({ success: true, title: data.title }, { headers });

  } catch(fetchErr: any) {
      console.error(`Unexpected error fetching title post-regeneration for chat ${chatId}:`, fetchErr);
      return json({ success: true, title: null, error: `Regeneration succeeded, but failed to fetch updated title: ${fetchErr.message}` }, { headers }); // Indicate success but title fetch failed
  }
}
