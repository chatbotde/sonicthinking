import { useState, useEffect, useRef, ReactNode } from "react";
import { useSupabase } from "~/hooks/use-supabase";
import { useNavigate, useLocation } from "@remix-run/react";
import { ChatProvider, useChat } from "~/context/chat-context";

// UI Components
import { ModeToggle } from "~/components/mode-toggle";
import { Login } from "~/components/login-dialog";
import { SignUp } from "~/components/signup-dialog";
import { LogoutDialog } from "~/components/logout-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarProvider, useSidebar, SidebarTrigger } from "~/components/ui/sidebar";
import { ScrollButton } from "~/components/ui/scrollbutton";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { PromptInputWithActions } from "~/components/chat";
import { useIsMobile } from "~/hooks/use-mobile";
import { AVAILABLE_LLMS, getDefaultLlm } from "~/lib/ai/models.config"; // Import model config

interface ChatLayoutProps {
  children?: ReactNode;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (message: string) => Promise<void>;
  selectedModel: string; // This will now be the LlmConfig.id
  setSelectedModel: (modelId: string) => void; // Setter takes LlmConfig.id
  isIndexPage?: boolean;
  customPlaceholder?: string;
}

// Inner component that uses useSidebar hook
function ChatLayoutContent({
  children,
  input,
  onInputChange,
  onSubmit,
  selectedModel, // Receives LlmConfig.id
  setSelectedModel, // Receives setter for LlmConfig.id
  isIndexPage = false,
  customPlaceholder,
}: ChatLayoutProps) {
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const supabase = useSupabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { openMobile, setOpenMobile, open } = useSidebar();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { createNewChat, selectedModel: contextModel, setSelectedModel: setContextModel } = useChat(); // Get model state from context
  const location = useLocation();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const messageToSendRef = useRef<string | null>(null);

  // Improved submission handler that immediately clears input
  const handleSubmit = async (message: string) => {
    if (!message.trim() || isCreatingChat) return;
    
    if (isIndexPage) {
      // Store the original message
      const originalMessage = message;
      messageToSendRef.current = originalMessage;
      
      // Immediately clear input to prevent duplicate submissions
      onInputChange("");
      setIsCreatingChat(true);
      
      try {
        console.log("Creating new chat for message:", originalMessage);
        const newChatId = await createNewChat();
        console.log("Created chat ID:", newChatId);
        
        if (!newChatId) {
          throw new Error("Failed to create chat - no chat ID returned");
        }
        
        const timestamp = Date.now().toString();
        
        // Store in multiple locations for reliability
        sessionStorage.setItem('pendingMessage', originalMessage);
        localStorage.setItem('pendingChatMessage', originalMessage);
        localStorage.setItem('pendingMessageTime', timestamp);
        localStorage.setItem(`chat_${newChatId}_pendingMessage`, originalMessage);
        
        console.log("Stored message for transition:", originalMessage);
        
        // Navigate with a short delay to ensure storage is committed
        setTimeout(() => {
          navigate(`/chat/${newChatId}`, {
            state: { pendingMessage: originalMessage, timestamp },
            replace: true
          });
        }, 200);
      } catch (error) {
        console.error("Failed to create chat:", error);
        setIsCreatingChat(false);
        messageToSendRef.current = null;
        
        // Restore the original message if chat creation fails
        onInputChange(originalMessage);
        alert("There was an error creating your chat. Please try again.");
      }
    } else {
      // On chat page - store message and clear input immediately
      const messageToSend = message;
      onInputChange(""); // Clear input right away
      
      // Send the message
      try {
        await onSubmit(messageToSend);
      } catch (error) {
        console.error("Failed to send message:", error);
        // Optionally restore the message on failure
        // onInputChange(messageToSend);
      }
    }
  };

  // Authentication effect
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUserLoggedIn(!!data.session);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const isAuthenticated = !!session;
        setUserLoggedIn(isAuthenticated);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Scroll to bottom when changing routes
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-[oklch(0.147_0.004_49.25)]">
      <AppSidebar />
      <div className={`flex flex-col flex-1 h-screen overflow-hidden bg-white dark:bg-[oklch(0.216_0.006_56.043)] transition-all duration-300 ${
        isMobile && openMobile ? 'opacity-30' : 'opacity-100'
      }`}>
        <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[oklch(0.216_0.006_56.043)] z-10">
          <div className="flex items-center gap-2">
            {(!open && !openMobile) && (
              isMobile ? (
                <button
                  type="button"
                  className="p-2 rounded-md hover:bg-muted"
                  onClick={() => setOpenMobile(true)}
                  aria-label="Open Sidebar"
                >
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sidebar">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18"/>
                  </svg>
                </button>
              ) : (
                <SidebarTrigger className="h-8 w-8 p-0" />
              )
            )}
            <h1 className="text-lg font-semibold truncate"></h1>
          </div>
          <div className="flex items-center gap-4 w-full justify-end">
            {!userLoggedIn ? (
              // When not logged in, only show login and signup buttons
              <>
                <Login />
                <SignUp />
              </>
            ) : (
              // When logged in, show model selector, theme toggle, and logout
              <>
                <LogoutDialog />
                {/* Model selector only visible when logged in */}
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Model">
                      {AVAILABLE_LLMS.find(llm => llm.id === selectedModel)?.name || "Select Model"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_LLMS.map((llm) => (
                      <SelectItem key={llm.id} value={llm.id}>
                        {llm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-6" />
                <ModeToggle />
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto flex justify-center" ref={containerRef}>
          <div className="h-full w-full max-w-4xl px-6 relative">
            <div className="pt-12">
              {children}
            </div>
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="relative">
          <div className="absolute left-1/2 transform -translate-x-1/2 bottom-4">
            <ScrollButton containerRef={containerRef} scrollRef={bottomRef} />
          </div>
        </div>
        <div className="sticky bottom-0 left-0 right-0 flex justify-center px-5 py-6 z-10 w-full bg-white dark:bg-[oklch(0.216_0.006_56.043)] shadow-sm">
          <div className="w-full max-w-4xl">
            <PromptInputWithActions
              value={isCreatingChat && messageToSendRef.current ? messageToSendRef.current : input}
              onChange={(e) => !isCreatingChat && onInputChange(e.target.value)}
              onSubmit={handleSubmit}
              disabled={isCreatingChat}
              placeholder={
                isCreatingChat 
                  ? "Creating new chat..." 
                  : customPlaceholder || (isIndexPage ? "Type to start a new chat..." : "Type a message...")
              }
            />
            {isCreatingChat && (
              <div className="text-sm text-center mt-2 text-muted-foreground">
                <div className="inline-flex items-center">
                  <span className="mr-2">Creating chat and preparing your message</span>
                  <span className="flex space-x-1">
                    <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0ms]"></span>
                    <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:150ms]"></span>
                    <span className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:300ms]"></span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// The outer component that provides context
export function ChatLayout(props: ChatLayoutProps) {
  // Manage the selected model state here, potentially defaulting
  const [currentModelId, setCurrentModelId] = useState(props.selectedModel || getDefaultLlm()?.id || '');

  // Update context when local selection changes
  const { setSelectedModel: setContextModel } = useChat();
  useEffect(() => {
    setContextModel(currentModelId);
  }, [currentModelId, setContextModel]);


  return (
    <SidebarProvider>
      {/* Pass the currentModelId and setter down */}
      <ChatLayoutContent
        {...props}
        selectedModel={currentModelId}
        setSelectedModel={setCurrentModelId}
      />
    </SidebarProvider>
  );
}

export default function ChatLayoutWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
