import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { ChatProvider, useChat } from "~/context/chat-context";
import { getDefaultLlm } from "~/lib/ai/models.config"; // Import for default LLM

export const meta: MetaFunction = () => [
  { title: "Sonicthinking - New Chat" },
  { name: "description", content: "Creating a new chat..." },
];

export async function loader({ request }: LoaderFunctionArgs) {
  // This loader doesn't need to do much as redirection is client-side via createNewChat
  return json({});
}

function IndexRedirector() {
  const navigate = useNavigate();
  const { createNewChat } = useChat();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (isRedirecting) return; // Prevent multiple attempts

    const performRedirect = async () => {
      setIsRedirecting(true);
      try {
        // createNewChat should handle the chat creation and return the new ID
        const newChatId = await createNewChat();
        if (newChatId) {
          navigate(`/chat/${newChatId}`, { replace: true });
        } else {
          // Handle the case where newChatId might not be returned
          // For now, navigating to a generic chat or showing an error might be options
          // Or, if createNewChat itself navigates, this might be redundant.
          // Based on _layout.tsx, createNewChat returns ID, then navigate is called.
          console.error("Failed to obtain new chat ID for redirection.");
          // Optionally, navigate to a fallback or show error
        }
      } catch (error) {
        console.error("Error creating new chat and redirecting:", error);
        // Handle error, maybe show a message to the user
        setIsRedirecting(false); // Reset if redirect failed to allow potential retry or user action
      }
    };

    performRedirect();
  }, [navigate, createNewChat, isRedirecting]);

  return (
    <div>
      {/* No need for loading UI since we're just redirecting */}
    </div>
  );
}

export default function IndexPage() {
  // Use the default LLM for the ChatProvider, similar to chat.$chatId.tsx if needed
  // Or rely on createNewChat to set the model from context.
  // For consistency, if ChatProvider can take an initialModel, it's good to provide one.
  const initialModelId = getDefaultLlm()?.id || "gemini"; // Ensure a fallback

  return (
    <ChatProvider initialModel={initialModelId}>
      <IndexRedirector />
    </ChatProvider>
  );
}





