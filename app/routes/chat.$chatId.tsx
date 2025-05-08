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
  const { inputDraft, setInputDraft, sendMessage, selectedModel, setSelectedModel, isLoading, messages } = useChat();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messageProcessed = useRef(false);
  const sendAttempts = useRef(0);
  const chatFullyLoaded = useRef(false);
  const initialRender = useRef(true);

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
    const timer = setTimeout(() => {
      chatFullyLoaded.current = true;
    }, 200);

    return () => clearTimeout(timer);
  }, [chatId]);

  // CRITICAL: Process pending message to ensure it gets sent to API only once
  useEffect(() => {
    // If already processed or not the first render, skip
    if (messageProcessed.current || !initialRender.current) return;
    
    // Mark first render as complete
    initialRender.current = false;
    
    // Skip if there are already messages in this chat
    if (messages && messages.length > 0) {
      messageProcessed.current = true;
      return;
    }

    const processMessage = async () => {
      // Check for a pending message from all possible sources
      let pendingMessage = location.state?.pendingMessage 
        || localStorage.getItem(`chat_${chatId}_pendingMessage`) 
        || sessionStorage.getItem('pendingMessage');

      // If no message found, don't proceed
      if (!pendingMessage) return;

      console.log("Found pending message to process:", pendingMessage);
      
      // Mark as being processed to prevent duplicate attempts
      messageProcessed.current = true;
      setIsProcessing(true);

      // Clear all storage locations immediately to prevent duplicates
      sessionStorage.removeItem('pendingMessage');
      localStorage.removeItem(`chat_${chatId}_pendingMessage`);
      // Clear any additional storage that might exist
      localStorage.removeItem('pendingChatMessage');
      localStorage.removeItem('pendingMessageTime');

      // Function to send the message only once
      const sendPendingMessage = async () => {
        if (!chatFullyLoaded.current) {
          setTimeout(sendPendingMessage, 100);
          return;
        }

        try {
          console.log("Sending message to API:", pendingMessage);
          await sendMessage(pendingMessage!, true);
          console.log("Message sent successfully");
          setIsProcessing(false);
        } catch (error) {
          console.error("Failed to send message:", error);
          if (sendAttempts.current < 1) { // Only retry once
            sendAttempts.current++;
            console.log(`Retrying send attempt ${sendAttempts.current}`);
            setTimeout(sendPendingMessage, 500);
          } else {
            setIsProcessing(false);
            alert("Failed to send your message. Please try again.");
          }
        }
      };

      // Only start sending once
      sendPendingMessage();
    };

    // Only process the message once
    processMessage();
  }, [chatId, location.state, sendMessage, messages]);

  // Simple send message handler for subsequent messages
  const handleSend = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading || isProcessing) return;

    // Clear input immediately
    setInput("");
    setInputDraft("");
    
    try {
      await sendMessage(trimmedMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <ChatLayout
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      input={input}
      onInputChange={handleInputChange}
      onSubmit={handleSend}
      isIndexPage={false}
      customPlaceholder={isProcessing ? "Processing message..." : "Type a message..."}
    >
      <MessageWithActions />
    </ChatLayout>
  );
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageContent />
    </ChatProvider>
  );
}
