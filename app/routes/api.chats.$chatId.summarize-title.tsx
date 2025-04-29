// External imports
import { json, type ActionFunctionArgs } from "@remix-run/node";


// Internal imports
import { requireAuth } from "~/lib/auth.server";
// Import the centralized function
import { generateBestChatTitle } from "~/lib/ai/gemini";

// Types
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// --- Action: POST handler for chat title generation ---
export async function action({ request, params }: ActionFunctionArgs) {
  const response = new Response();
  
  // Authentication and parameter validation
  const { session, supabase } = await requireAuth(request);
  if (!session?.user?.id) {
    return json({ success: false, error: "Authentication required" }, { status: 401, headers: response.headers });
  }
  
  const userId = session.user.id;
  const chatId = params.chatId;
  
  if (!chatId) {
    return json({ success: false, error: "Chat ID is required" }, { status: 400, headers: response.headers });
  }
  
  if (!supabase) {
    return json({ success: false, error: "Database connection unavailable" }, { status: 503, headers: response.headers });
  }

  try {
    // Verify chat ownership before proceeding
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single();
      
    if (chatError || !chatData) {
      console.error(`Ownership verification failed for chat ${chatId}`, chatError);
      return json({ 
        success: false, 
        error: "Chat not found or access denied" 
      }, { status: 403, headers: response.headers });
    }
    
    // Fetch the first message exchange (one user message and one assistant response)
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(2);
    
    if (messagesError) {
      console.error(`Failed to fetch messages for chat ${chatId}:`, messagesError);
      return json({ 
        success: false, 
        error: "Could not retrieve chat messages" 
      }, { status: 500, headers: response.headers });
    }
    
    // Validate message structure
    if (!messages || messages.length < 2 || messages[0].role !== 'user' || messages[1].role !== 'assistant') {
      console.warn(`Chat ${chatId} has insufficient or invalid messages for title generation`);
      return json({ 
        success: false, 
        error: "This chat doesn't have enough valid messages to generate a title" 
      }, { status: 422, headers: response.headers });
    }
    
    // Generate title using the centralized function
    let newTitle = '';
    try {
      // Pass the fetched messages directly
      newTitle = await generateBestChatTitle({ messages });

      // The centralized function handles fallbacks, so we just check the final result
      if (!newTitle || newTitle === 'New Chat') {
         // If even the fallback failed or returned "New Chat", use a basic snippet
         console.warn(`generateBestChatTitle returned invalid/default title for chat ${chatId}. Using basic snippet.`);
         newTitle = messages[0].content
           .slice(0, 50)
           .replace(/[^a-zA-Z0-9 ]/g, '')
           .trim() + '...';
         if (!newTitle) newTitle = "Chat Summary"; // Absolute fallback
      }

    } catch (error) {
      console.error('Critical failure calling generateBestChatTitle:', error);
      return json({
        success: false,
        error: "Title generation service encountered an error",
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 503, headers: response.headers });
    }
    
    // Update chat title in database
    const { error: updateError } = await supabase
      .from("chats")
      .update({ 
        title: newTitle, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", chatId)
      .eq("user_id", userId);
    
    if (updateError) {
      console.error(`Failed to update title for chat ${chatId}:`, updateError);
      return json({ 
        success: false, 
        error: "Generated title could not be saved" 
      }, { status: 500, headers: response.headers });
    }
    
    console.log(`Successfully updated title for chat ${chatId}: "${newTitle}"`);
    return json({ 
      success: true, 
      title: newTitle 
    }, { headers: response.headers });
    
  } catch (error: unknown) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Unexpected error during title generation for chat ${chatId}:`, error);
    
    return json({ 
      success: false, 
      error: "An unexpected error occurred", 
      details: errorMessage 
    }, { status: 500, headers: response.headers });
  }
}

// --- Loader: GET handler (method not allowed) ---
export async function loader() {
  return json({ 
    message: "This endpoint only accepts POST requests for chat title generation" 
  }, { status: 405 });
}
