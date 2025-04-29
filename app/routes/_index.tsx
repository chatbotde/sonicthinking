import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useState, useEffect } from "react";
import { ChatLayout } from "./_layout";
// Removed MessageWithActions import as it's not used here
import { ChatProvider, useChat } from "~/context/chat-context";

export const meta: MetaFunction = () => [
  { title: "Sonicthinking" },
  { name: "description", content: "Welcome to Sonicthinking!" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  return json({});
}

// Removed PROMPT_SUGGESTIONS array

function IndexPageContent() {
  const [selectedModel, setSelectedModel] = useState("gemini");
  const { inputDraft, setInputDraft } = useChat();
  const [input, setInput] = useState("");
  // Removed showSuggestions state

  // Clean up any stale messages and initialize input
  useEffect(() => {
    // Clear any pending messages from previous sessions
    localStorage.removeItem('pendingChatMessage');
    sessionStorage.removeItem('pendingMessage');
    localStorage.removeItem('pendingMessageTime'); // Also clear the timestamp

    // Initialize from draft if available
    if (inputDraft) {
      setInput(inputDraft);
      // Removed setShowSuggestions(false);
    }
  }, [inputDraft]);

  const handleInputChange = (value: string) => {
    setInput(value);
    setInputDraft(value);
    // Removed setShowSuggestions(value.length === 0);
  };

  // Removed handleSuggestionClick function

  return (
    <ChatLayout
      input={input}
      onInputChange={handleInputChange}
      onSubmit={async () => {}} // Will be overridden by layout in _layout.tsx
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      isIndexPage={true}
      customPlaceholder="Ask anything..." // Updated placeholder
    >
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-2xl px-4">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Welcome to Sonicthinking</h1>
          {/* Removed the paragraph below the heading */}
          {/* <p className="text-lg mb-8 text-muted-foreground">
            Your AI-powered thinking partner. Ask a question, get insights, or start a conversation.
          </p> */}

          {/* Removed the suggestions block */}

          {/* Removed the instruction text */}
          {/* <div className="mt-6 text-sm text-muted-foreground">
            Type your message below and press Enter to start a new conversation
          </div> */}
        </div>
      </div>
    </ChatLayout>
  );
}

export default function IndexPage() {
  const [selectedModel] = useState("gemini");

  return (
    <ChatProvider initialModel={selectedModel}>
      <IndexPageContent />
    </ChatProvider>
  );
}





