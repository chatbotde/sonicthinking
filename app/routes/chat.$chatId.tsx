import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useLocation } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { ChatLayout } from "./_layout";
import { MessageWithActions } from "~/components/message";
import { ChatProvider, useChat } from "~/context/chat-context";

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
  const { inputDraft, setInputDraft, sendMessage, selectedModel, setSelectedModel, isLoading, messages } = useChat();
  const [input, setInput] = useState("");
  
  const chatFullyLoaded = useRef(false); // Keep chatFullyLoaded as it might be used generally

  useEffect(() => {
    setInput(inputDraft);
  }, [inputDraft]);

  const handleInputChange = (value: string) => {
    setInput(value);
    setInputDraft(value);
  };

  // Restore chatFullyLoaded timer effect
  useEffect(() => {
    console.log(`ChatPage [${chatId}]: Setting up chatFullyLoaded timer.`);
    const timer = setTimeout(() => { 
      console.log(`ChatPage [${chatId}]: chatFullyLoaded.current set to true.`);
      chatFullyLoaded.current = true; 
    }, 200);
    return () => clearTimeout(timer);
  }, [chatId]);

  const handleSend = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;
    setInput("");
    setInputDraft("");
    try {
      await sendMessage(trimmedMessage, true, chatId); 
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
      customPlaceholder={isLoading ? "AI is thinking..." : "Type a message..."}
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
