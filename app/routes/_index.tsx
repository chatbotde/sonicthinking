import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@remix-run/react";
import { ChatProvider, useChat } from "~/context/chat-context";
import { ChatLayout } from "./_layout";
import { getDefaultLlm } from "~/lib/ai/models.config";
import { useSupabase } from "~/hooks/use-supabase";
import { MessageWithActions } from "~/components/message";

// No SimpleMessage needed

export const meta: MetaFunction = () => [
  { title: "Sonicthinking" },
  { name: "description", content: "Start a new conversation with Sonicthinking AI." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  return json({});
}

function IndexPageContent() {
  const navigate = useNavigate();
  const supabase = useSupabase();
  const { createNewChat, sendMessage, inputDraft, setInputDraft, selectedModel: contextModel, setSelectedModel: setContextModel, messages, isLoading } = useChat();
  
  const [selectedModel, setSelectedModel] = useState(contextModel || getDefaultLlm()?.id || "gemini");
  const [input, setInput] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [shouldShowMessages, setShouldShowMessages] = useState(false);

  useEffect(() => {
    if (inputDraft) setInput(inputDraft);
    localStorage.removeItem('pendingMessageForNewChat');
    sessionStorage.removeItem('pendingMessage');
    // Clear pending stream requests from previous failed attempts
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('pendingAIStreamRequest_')) {
        localStorage.removeItem(key);
      }
    });
  }, [inputDraft]);

  useEffect(() => { setSelectedModel(contextModel); }, [contextModel]);

  // Navigate to chat page when AI finishes responding
  useEffect(() => {
    if (currentChatId && !isLoading && shouldShowMessages && messages.length >= 2) {
      // Give a short delay to make sure the user sees the response
      const timer = setTimeout(() => {
        navigate(`/chat/${currentChatId}`, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentChatId, isLoading, shouldShowMessages, messages.length, navigate]);

  const handleInputChange = (value: string) => {
    setInput(value);
    setInputDraft(value);
  };

  // Renamed and Refactored: handleStartChatAndSendMessage
  const handleStartChatAndSendMessage = async (userMessageContent: string) => {
    if (!userMessageContent.trim() || isStartingChat) return;

    setIsStartingChat(true);
    const originalInput = input; // Keep original input in case of error
    setInput(""); 
    setInputDraft("");

    try {
      // 1. Create new chat ID
      const newChatId = await createNewChat();
      console.log(`IndexPage: New chat created with ID: ${newChatId}`);
      setCurrentChatId(newChatId);

      // 2. Show messages area
      setShouldShowMessages(true);

      // 3. Send the first message using the context's sendMessage
      console.log(`IndexPage: Calling sendMessage for new chat ${newChatId} with message: "${userMessageContent}"`);
      await sendMessage(userMessageContent, true, newChatId); // (message, shouldStream, chatId)
      console.log(`IndexPage: sendMessage call for new chat ${newChatId} completed.`);
      
      // Navigation to chat page will happen in the useEffect after message is completed

    } catch (error: any) {
      console.error("IndexPage: Error starting chat and sending message:", error);
      setInput(originalInput); // Restore input on error
      setInputDraft(originalInput);
      alert(`An error occurred: ${error.message || "Failed to start chat and send message."}`);
      setIsStartingChat(false); // Reset loading state on error to allow retry
      setShouldShowMessages(false);
      setCurrentChatId(null);
    } 
  };

  return (
    <ChatLayout
      input={input}
      onInputChange={handleInputChange}
      onSubmit={handleStartChatAndSendMessage} // Use the new handler
      selectedModel={selectedModel}
      setSelectedModel={(modelId) => {
        setSelectedModel(modelId);
        setContextModel(modelId);
      }}
      isIndexPage={true}
      customPlaceholder={isLoading ? "AI is thinking..." : (isStartingChat ? "Starting your chat..." : "Type to start a new chat...")}
    >
      {shouldShowMessages ? (
        <MessageWithActions />
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 py-12">
          <div className="text-center max-w-2xl px-4">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Welcome to Sonicthinking</h1>
            <p className="text-muted-foreground">
              Ask anything, get answers, and explore ideas.
            </p>
          </div>
        </div>
      )}
    </ChatLayout>
  );
}

export default function IndexPage() {
  const initialModelId = getDefaultLlm()?.id || "gemini";
  return (
    <ChatProvider initialModel={initialModelId}>
      <IndexPageContent />
    </ChatProvider>
  );
}





