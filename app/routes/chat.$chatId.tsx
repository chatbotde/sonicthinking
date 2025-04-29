import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useLocation } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { ChatLayout } from "./_layout";
import { MessageWithActions } from "~/components/message";
import { ChatProvider, useChat } from "~/context/chat-context";
import { getDefaultLlm } from "~/lib/ai/models.config"; // Import default LLM getter

export const meta: MetaFunction = () => [
  { title: "Sonicthinking" },
  { name: "description", content: "Chat with AI" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  return json({ chatId: params.chatId });
}

function ChatPageContent() {
  const { chatId } = useLoaderData<typeof loader>();
  const location = useLocation();
  // Get model state and sendMessage from context
  const { inputDraft, setInputDraft, sendMessage, selectedModel, setSelectedModel, isLoading } = useChat();
  const [input, setInput] = useState("");
  // const [selectedModel, setSelectedModel] = useState("gemini"); // Remove local model state, use context
  const [isProcessing, setIsProcessing] = useState(false); // Keep local processing state for UI feedback
  const messageProcessed = useRef(false);
  const [autoSendMessage, setAutoSendMessage] = useState<string | null>(null);
  const sendAttempts = useRef(0);
  const chatFullyLoaded = useRef(false);

  // Sync local input with context draft if needed
  useEffect(() => {
    setInput(inputDraft);
  }, [inputDraft]);

  // Update context draft when local input changes
  const handleInputChange = (value: string) => {
    setInput(value);
    setInputDraft(value);
  };

  // Wait for chat context to be fully initialized
  useEffect(() => {
    // Mark chat as fully loaded after a short delay
    const timer = setTimeout(() => {
      chatFullyLoaded.current = true;
      console.log("Chat context fully loaded, ready to process messages");
    }, 800); // Give enough time for chat context to initialize

    return () => clearTimeout(timer);
  }, [chatId]);

  // Process pending message with better timing and retry logic
  useEffect(() => {
    if (messageProcessed.current) return;

    const processMessage = async () => {
      // Try all possible sources for the pending message
      let pendingMessage: string | null = null;

      // Check all possible sources in order of preference
      if (location.state?.pendingMessage) {
        pendingMessage = location.state.pendingMessage;
        console.log("Found pending message in location state:", pendingMessage);
      } 
      else if (sessionStorage.getItem('pendingMessage')) {
        pendingMessage = sessionStorage.getItem('pendingMessage');
        console.log("Found pending message in sessionStorage:", pendingMessage);
      } 
      else if (localStorage.getItem('pendingChatMessage')) {
        pendingMessage = localStorage.getItem('pendingChatMessage');
        console.log("Found pending message in localStorage:", pendingMessage);
      }

      // If no message found, don't proceed
      if (!pendingMessage) {
        console.log("No pending message found");
        return;
      }

      // Mark as being processed to prevent duplicate attempts
      messageProcessed.current = true;
      setAutoSendMessage(pendingMessage);
      setInput(pendingMessage); // Keep input populated for visibility
      setInputDraft(pendingMessage); // Update draft as well
      setIsProcessing(true); // Use local processing state

      // First, clear storage immediately to prevent duplicate processing
      sessionStorage.removeItem('pendingMessage');
      localStorage.removeItem('pendingChatMessage');
      localStorage.removeItem('pendingMessageTime');

      // Function to attempt sending the message
      const attemptSend = async () => {
        if (!chatFullyLoaded.current) {
          console.log("Chat not fully loaded yet, waiting...");
          // Wait a bit longer before trying
          setTimeout(attemptSend, 500);
          return;
        }

        try {
          console.log("Sending pending message via context:", pendingMessage);
          // Use context's sendMessage (which includes the selectedModel)
          await sendMessage(pendingMessage!);

          console.log("Pending message successfully sent via context");
          setInput(""); // Clear local input
          setInputDraft(""); // Clear context draft
          setAutoSendMessage(null);
          setIsProcessing(false); // Clear local processing state
        } catch (error) {
          console.error("Context sendMessage failed for pending message:", error);

          // Retry logic
          if (sendAttempts.current < 3) {
            sendAttempts.current++;
            console.log(`Retrying send (attempt ${sendAttempts.current})...`);

            // Try again after a delay
            setTimeout(attemptSend, 1000);
          } else {
             // Keep message in input/draft for manual retry
             setAutoSendMessage(null);
             setIsProcessing(false);
             alert("Failed to send your message automatically. Please try sending it again.");
          }
        }
      };

      // Start the send process with a delay to ensure everything is ready
      setTimeout(attemptSend, 1000);
    };

    // Start processing the message after a delay to ensure component is fully mounted
    const timer = setTimeout(processMessage, 500);
    return () => clearTimeout(timer);
  }, [chatId, location.state, sendMessage, setInputDraft]); // Add dependencies


  // Use context's sendMessage in the handler
  const handleSend = async (message: string) => {
    const trimmedMessage = message.trim();
    // Use context's isLoading state + local isProcessing state
    if (!trimmedMessage || isLoading || isProcessing) return;

    // Store the message and clear input immediately
    setInput(""); // Clear input right away
    setInputDraft(""); // Clear context draft immediately
    setIsProcessing(true); // Set local processing state

    try {
      // Call context's sendMessage
      await sendMessage(trimmedMessage);
    } catch (error) {
      console.error("Failed to send message via context:", error);
      // Optionally restore the message on failure
      // setInput(trimmedMessage);
      // setInputDraft(trimmedMessage);
    } finally {
       setIsProcessing(false); // Clear local processing state regardless of context isLoading
    }
  };

  return (
    <ChatLayout
      // Pass context model state and setter to ChatLayout
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      // Use local input state for the input field display
      input={isProcessing && autoSendMessage ? autoSendMessage : input}
      onInputChange={handleInputChange} // Use updated handler
      onSubmit={handleSend} // Use updated handler
      isIndexPage={false}
    >
      <MessageWithActions />
      {/* Display loading indicator based on context's isLoading */}
      {/* {isLoading && <div>Loading response...</div>} */}
    </ChatLayout>
  );
}

export default function ChatPage() {
  // No need to manage selectedModel state here anymore
  // const [selectedModel, setSelectedModel] = useState("gemini");

  return (
    // ChatProvider now defaults the model if not provided
    <ChatProvider>
      <ChatPageContent />
    </ChatProvider>
  );
}
