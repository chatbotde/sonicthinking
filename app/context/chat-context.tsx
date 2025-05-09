import { createContext, useContext, useEffect, useState, useRef } from "react"; // Import useRef
import { useNavigate, useParams } from "@remix-run/react";
import { v4 as uuidv4 } from "uuid";
import { useSupabase } from "~/hooks/use-supabase";
import { getDefaultLlm } from "~/lib/ai/models.config"; // Import default LLM getter

type Message = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  user_id?: string;
  isStreaming?: boolean;
  streamingContent?: string;
  history?: string[]; // Add history field
};

type ChatContextType = {
  messages: Message[];
  chatId: string;
  isLoading: boolean;
  selectedModel: string; // Holds the LlmConfig.id (e.g., 'gemini-1.5-flash')
  setSelectedModel: (modelId: string) => void; // Takes LlmConfig.id
  sendMessage: (message: string, useStreaming?: boolean, overrideChatId?: string, isContinuation?: boolean) => Promise<void>;
  createNewChat: () => Promise<string>;
  error: string | null;
  updateStreamingContent: (messageId: string, content: string) => void;
  finalizeStreamingMessage: (messageId: string, finalContent: string) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  stopGeneration: () => void; // Add stop function type
  inputDraft: string;
  setInputDraft: (draft: string) => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children, initialModel }: { children: React.ReactNode; initialModel?: string }) {
  const navigate = useNavigate();
  const params = useParams();
  const supabase = useSupabase();
  // Default to the first available LLM's ID if initialModel is not provided
  const [selectedModel, setSelectedModel] = useState<string>(initialModel || getDefaultLlm()?.id || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputDraft, setInputDraft] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null); // Ref to hold the AbortController

  // Update model when initialModel prop changes (e.g., from parent component)
  useEffect(() => {
    // Only update if initialModel is provided and different
    if (initialModel && initialModel !== selectedModel) {
        setSelectedModel(initialModel);
    }
  }, [initialModel]);

  // Add this to track the current user
  const [user, setUser] = useState<{id: string} | null>(null);
  
  // Add effect to get the current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser({ id: data.user.id });
      }
    };
    
    fetchUser();
  }, [supabase]);

  // Get chatId from URL or create a new one
  useEffect(() => {
    const id = params.chatId || uuidv4();
    setChatId(id);
    fetchMessages(id);
  }, [params.chatId]);

  // Fetch messages for the current chat
  const fetchMessages = async (id: string) => {
    if (!id) return;
    setIsLoading(true); // Start loading when fetching
    setError(null);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*") // Select all fields including potential history
        .eq("chat_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      // Ensure history is always an array
      const messagesWithHistory = (data || []).map(msg => ({
        ...msg,
        history: msg.history || []
      }));
      setMessages(messagesWithHistory);
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
    } finally {
      setIsLoading(false); // Stop loading after fetch
    }
  };

  // Update streaming content for a message by appending new content
  const updateStreamingContent = (messageId: string, chunk: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, streamingContent: (msg.streamingContent || "") + chunk }
          : msg
      )
    );
  };

  // Finalize a streaming message with its complete content
  const finalizeStreamingMessage = (messageId: string, finalContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: finalContent, isStreaming: false, streamingContent: undefined }
          : msg
      )
    );
    setIsLoading(false);
  };

  // Function to trigger title summarization - improve this function
  const summarizeChatTitle = async (currentChatId: string) => {
    // Check if we have at least two messages (user + assistant)
    if (messages.length < 2) return; 
    
    console.log('Triggering title summarization for chat:', currentChatId);

    try {
      // Add headers and improve fetch request
      const response = await fetch(`/api/chats/${currentChatId}/summarize-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.slice(0, 2) // Send just the first exchange to summarize
        })
      });
      
      if (!response.ok) {
        console.error('Title summarization response not OK:', response.status);
      } else {
        console.log('Title summarization request successful');
      }
    } catch (error) {
      console.error("Error triggering title summarization:", error);
    }
  };

  // Function to stop the current streaming request
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      console.log("Aborting generation...");
      abortControllerRef.current.abort();
      abortControllerRef.current = null; // Clear the ref
      setIsLoading(false); // Immediately set loading to false on manual stop
    }
  };

  // Send a message to the AI
  const sendMessage = async (content: string, useStreaming = true, overrideChatId?: string, isContinuation = false) => {
    if (!content.trim()) return;
    setIsLoading(true); 
    setError(null);

    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentChatId = overrideChatId || chatId; 
    if (!currentChatId) {
      console.error("sendMessage: No chatId available (context or override). Aborting.");
      setError("Chat session not properly initialized.");
      setIsLoading(false);
      return;
    }
    
    const assistantMessageId = uuidv4(); // Define assistantMessageId here

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setError("You must be logged in to send messages");
      setIsLoading(false);
      return;
    }
    
    // Skip adding/saving user message if this is a continuation of the first message
    if (!isContinuation) {
      const userMessageId = uuidv4();
      const userMessage: Message = {
        id: userMessageId,
        chat_id: currentChatId, 
        role: "user",
        content,
        created_at: new Date().toISOString(),
        user_id: userId,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        console.log("Saving user message to database:", userMessage);
        const { error: userMsgError } = await supabase
          .from("messages")
          .insert(userMessage); 

        if (userMsgError) {
          console.error("Error saving user message:", userMsgError);
        }
      } catch (err) {
        console.error("Exception saving user message:", err);
      }
    }
    
    const messagesForThisChat = messages.filter(m => m.chat_id === currentChatId);
    const shouldTriggerTitleSummarization = !isContinuation ? messagesForThisChat.length <= 1 : messagesForThisChat.length < 2;

    if (!params.chatId && !overrideChatId && !isContinuation) {
      navigate(`/chat/${currentChatId}`, { replace: true });
    }

    try {
      if (useStreaming) {
        const assistantMessage: Message = {
          id: assistantMessageId, 
          chat_id: currentChatId, 
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          user_id: userId, 
          isStreaming: true,
          streamingContent: ""
        };
        setMessages(prev => [...prev, assistantMessage]);

        const formData = new FormData();
        formData.append("chatId", currentChatId); 
        formData.append("message", content); 
        formData.append("model", selectedModel);

        console.log(
          `sendMessage to /api/stream: chatId=${currentChatId}, model=${selectedModel}, isContinuation=${isContinuation}, content="${content}"`
        );
        const response = await fetch("/api/stream", {
          method: "POST",
          body: formData,
          signal: controller.signal, // Pass the signal here
        });
        console.log(`sendMessage response from /api/stream: status=${response.status}`);

        if (!response.ok) {
            console.error(`sendMessage error: API response not OK - ${response.status} ${response.statusText}`);
            try {
                const errorText = await response.text();
                console.error("API error response text:", errorText);
            } catch (e) {
                console.error("Could not get error text from API response.");
            }
            throw new Error(`Failed to send message. Status: ${response.status}`);
        }
        if (!response.body) throw new Error("No response body");

        // Process the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = "";
        let messageData = null;
        let completeMarkerIndex = -1;

        while (true) {
          const { done, value } = await reader.read();
          // Check if aborted *before* processing chunk
          if (controller.signal.aborted) {
              console.log("Stream reading aborted.");
              // Finalize with potentially partial content
              finalizeStreamingMessage(assistantMessageId, streamedContent);
              // Don't save partial message to DB on abort? Or save with a flag?
              // For now, just finalize UI and stop.
              setIsLoading(false); // Ensure loading is false
              return; // Exit the loop and function
          }

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          streamedContent += chunk; 

          completeMarkerIndex = streamedContent.indexOf("\n\n__STREAM_COMPLETE__\n\n");

          if (completeMarkerIndex !== -1) {
            const jsonData = streamedContent.substring(completeMarkerIndex + 23);
            try {
              messageData = JSON.parse(jsonData);
              streamedContent = streamedContent.substring(0, completeMarkerIndex);
            } catch (e) {
              console.error("Error parsing message data:", e);
            }
            break;
          }

          if (completeMarkerIndex === -1) {
            updateStreamingContent(assistantMessageId, chunk);
          }
        }

        // If loop finishes normally (not aborted)
        abortControllerRef.current = null; // Clear controller ref

        const finalContent = completeMarkerIndex !== -1 
          ? streamedContent.substring(0, completeMarkerIndex) 
          : streamedContent;

        // Save assistant message to database (only if not aborted)
        try {
          console.log("Saving assistant message to database");
          const { error: assistantMsgError } = await supabase
            .from("messages")
            .insert({
              id: assistantMessageId,
              chat_id: currentChatId, // Use currentChatId
              user_id: userId,
              role: "assistant",
              content: finalContent,
              created_at: assistantMessage.created_at
            });

          if (assistantMsgError) {
            console.error("Error saving assistant message:", assistantMsgError);
          }
        } catch (err) {
          console.error("Exception saving assistant message:", err);
        }

        if (messageData) {
          finalizeStreamingMessage(assistantMessageId, messageData.content); 
        } else {
          finalizeStreamingMessage(assistantMessageId, finalContent);
        }

        // Always trigger title summarization after the first exchange
        if (shouldTriggerTitleSummarization) {
          console.log(`Triggering title summarization for chat ${currentChatId} (continuation: ${isContinuation})`);
          setTimeout(() => {
            summarizeChatTitle(currentChatId); 
          }, 1000); 
        }
      } else {
        // Non-streaming API code... (Consider if this path is still needed)
        // If needed, update this to call /api/ai and pass the selectedModel ID
        console.warn("Non-streaming path in sendMessage needs review for isContinuation and title summarization.");
        setIsLoading(false); // Ensure loading stops if this path is taken without action
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Fetch aborted by user.");
      } else {
        console.error("Error sending message:", err);
        setError(err.message || "Failed to send message");
        // Clear placeholder on error using the ID defined outside the try block
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId && msg.role === 'assistant')); 
      }
      setIsLoading(false); 
      abortControllerRef.current = null; 
    }
  };

  // Regenerate an assistant message
  const regenerateMessage = async (messageId: string) => {
    setIsLoading(true); // Set loading true
    setError(null);

    // Cancel any previous request
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex <= 0) {
      setError("Cannot regenerate the first message or a user message.");
      setIsLoading(false);
      return;
    }

    const messageToRegenerate = messages[messageIndex];
    const userMessage = messages[messageIndex - 1];

    if (messageToRegenerate.role !== 'assistant' || userMessage.role !== 'user') {
      setError("Regeneration requires an assistant message preceded by a user message.");
      setIsLoading(false);
      return;
    }

    // Get user ID for database operations
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setError("You must be logged in to regenerate messages");
      setIsLoading(false);
      return;
    }

    // 1. Update state to start streaming and add current content to history
    const currentContent = messageToRegenerate.content;
    const newHistory = [currentContent, ...(messageToRegenerate.history || [])];

    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              history: newHistory,
              isStreaming: true,
              streamingContent: '',
              content: '', // Clear old content
            }
          : msg
      )
    );

    try {
      // 2. Call the streaming API with signal
      const formData = new FormData();
      formData.append("chatId", chatId);
      formData.append("message", userMessage.content); 
      formData.append("model", selectedModel); 

      const response = await fetch("/api/stream", {
        method: "POST",
        body: formData,
        signal: controller.signal, // Pass the signal
      });

      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
      if (!response.body) throw new Error("No response body");

      // 3. Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";
      let messageData = null;
      let completeMarkerIndex = -1;

      while (true) {
        const { done, value } = await reader.read();
         // Check if aborted *before* processing chunk
         if (controller.signal.aborted) {
            console.log("Regeneration stream reading aborted.");
            // Finalize with potentially partial content
            finalizeStreamingMessage(messageId, streamedContent);
            setIsLoading(false); // Ensure loading is false
            return; // Exit the loop and function
        }
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamedContent += chunk;

        completeMarkerIndex = streamedContent.indexOf("\n\n__STREAM_COMPLETE__\n\n");

        if (completeMarkerIndex !== -1) {
          const jsonData = streamedContent.substring(completeMarkerIndex + 23);
          try {
            messageData = JSON.parse(jsonData);
            streamedContent = streamedContent.substring(0, completeMarkerIndex);
          } catch (e) {
            console.error("Error parsing message data:", e);
            // Continue processing the text part even if JSON fails
          }
          break; // Exit loop once marker is found
        }

        // Update streaming content in state for the specific message
        if (completeMarkerIndex === -1) {
           updateStreamingContent(messageId, chunk);
        }
      }

      // If loop finishes normally (not aborted)
      abortControllerRef.current = null; // Clear controller ref

      const finalContent = completeMarkerIndex !== -1
        ? streamedContent.substring(0, completeMarkerIndex)
        : streamedContent;

      // 4. Save the regenerated message to the database (only if not aborted)
      try {
        console.log("Updating regenerated message in database:", messageId, "with history:", newHistory); // Added logging
        const { data: updateData, error: updateMsgError } = await supabase // Capture data too
          .from("messages")
          .update({
            content: finalContent,
            history: newHistory, // Save the updated history
            updated_at: new Date().toISOString() // Update timestamp
          })
          .eq('id', messageId)
          .eq('user_id', userId) // Ensure user owns the message
          .select(); // Select the updated row to confirm

        if (updateMsgError) {
          console.error("Error updating regenerated message:", updateMsgError);
          // Don't throw here, just log, UI state is already updated optimistically
        } else {
          console.log("Successfully updated message in DB:", updateData); // Log success
        }
      } catch (err) {
        console.error("Exception updating regenerated message:", err);
      }

      // 5. Finalize the message state in the UI
      finalizeStreamingMessage(messageId, finalContent);

    } catch (err: any) {
       // Handle AbortError specifically
       if (err.name === 'AbortError') {
        console.log("Regeneration fetch aborted by user.");
        // Revert UI state on abort? Or keep partial?
        // For now, keep partial content shown by finalizeStreamingMessage called in the loop.
      } else {
        console.error("Error regenerating message:", err);
        setError(err.message || "Failed to regenerate message");
        // Revert UI state on other errors
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  isStreaming: false,
                  content: currentContent, // Revert to original content
                  history: messageToRegenerate.history || [], // Revert history
                  streamingContent: undefined,
                }
              : msg
          )
        );
      }
      setIsLoading(false); // Ensure loading is false on any error
      abortControllerRef.current = null; // Clear controller ref on error too
    }
  };

  // Create a new chat and reset messages
  const createNewChat = async (): Promise<string> => {
    setIsLoading(true);
    setError(null);
    console.log("Attempting to create a new chat via API...");
  
    try {
      const formData = new FormData();
      formData.append('intent', 'create-chat');
  
      const response = await fetch('/api/ai/chat', { // This API endpoint seems different from /api/stream
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }
  
      const { chatId: newIdFromApi } = await response.json(); // Renamed to avoid conflict with context's chatId
  
      if (!newIdFromApi) {
        throw new Error("API did not return a chat ID");
      }
  
      console.log("New chat created via API, ID:", newIdFromApi);
      setChatId(newIdFromApi); // Update context state with the ID from the backend
      setMessages([]); 
      setInputDraft(""); 
      setIsLoading(false);
      return newIdFromApi; 
  
    } catch (err: any) {
      console.error("Error creating new chat:", err);
      setError(err.message || "Failed to create chat");
      setIsLoading(false);
      throw err; 
    }
  };
  

  return (
    <ChatContext.Provider
      value={{
        messages,
        chatId,
        isLoading,
        selectedModel,
        setSelectedModel,
        sendMessage,
        createNewChat,
        error,
        updateStreamingContent,
        finalizeStreamingMessage,
        regenerateMessage,
        stopGeneration,
        inputDraft,
        setInputDraft,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
