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
  customPlaceholder,
}: ChatLayoutProps) {
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const supabase = useSupabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { openMobile, setOpenMobile, open } = useSidebar();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { 
    createNewChat, 
    selectedModel: contextModel, 
    setSelectedModel: setContextModel,
    messages // Get messages from context for scroll behavior
  } = useChat(); 
  const location = useLocation();
  const isSubmitting = useRef(false);

  // Single submission handler
  const handleSubmit = async (message: string) => {
    if (!message.trim() || isSubmitting.current) return;
    const messageToSend = message.trim();
    onInputChange("");
    try {
      isSubmitting.current = true;
      await onSubmit(messageToSend);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      isSubmitting.current = false;
    }
  };

  // Authentication effect
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setUserLoggedIn(!!data.session);
    };
    checkAuth();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserLoggedIn(!!session);
    });
    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  // Scroll to bottom on new messages or route change
  useEffect(() => {
    if (bottomRef.current) {
      // Check if there are messages to avoid scrolling on initial empty load if not desired
      // However, for "scroll to bottom after first input", this will trigger correctly.
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, location.pathname]); // Add messages as a dependency

  // Reset submission state when route changes (already present, good to keep)
  useEffect(() => {
    isSubmitting.current = false;
  }, [location.pathname]);

  return (
    <div className="fixed inset-0 flex bg-white dark:bg-[oklch(0.147_0.004_49.25)]">
      <AppSidebar />
      <div className={`flex flex-col flex-1 h-full overflow-hidden bg-white dark:bg-[oklch(0.216_0.006_56.043)] transition-all duration-300 ${
        isMobile && openMobile ? 'opacity-30' : 'opacity-100'
      }`}>
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[oklch(0.216_0.006_56.043)] z-10">
          <div className="flex items-center gap-2">
            {(!open && !openMobile) && (
              isMobile ? (
                <button type="button" className="p-2 rounded-md hover:bg-muted" onClick={() => setOpenMobile(true)} aria-label="Open Sidebar">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sidebar"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18"/></svg>
                </button>
              ) : (
                <SidebarTrigger className="h-8 w-8 p-0" />
              )
            )}
            <h1 className="text-lg font-semibold truncate"></h1>
          </div>
          <div className="flex items-center gap-4 w-full justify-end">
            {!userLoggedIn ? (
              <><Login /><SignUp /></>
            ) : (
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Model">{AVAILABLE_LLMS.find(llm => llm.id === selectedModel)?.name || "Select Model"}</SelectValue></SelectTrigger>
                <SelectContent>{AVAILABLE_LLMS.map((llm) => (<SelectItem key={llm.id} value={llm.id}>{llm.name}</SelectItem>))}</SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Chat Content Area */}
        <div className="flex-1 overflow-y-auto" ref={containerRef}> {/* Added overflow-y-auto here */}
          <div className="h-full w-full max-w-4xl mx-auto px-6 flex flex-col"> {/* Centering and column direction */}
            {/* This div will grow and allow content to be centered when small, and messages to stack from top */}
            <div className="flex-grow flex flex-col justify-end pt-12"> {/* Changed to justify-end to keep messages at bottom before scroll kicks in, pt-12 for spacing */}
              {/* Children (MessageWithActions) will render here */}
              {/* If MessageWithActions renders individual messages, they should naturally stack up */}
              {/* If there are no messages, this setup with justify-center in parent might be better */}
              {/* Let's try justify-center first for initial empty state, then rely on scroll for subsequent messages. */}
              <div className="flex-grow flex flex-col justify-center"> {children} </div>
            </div>
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        <div className="relative">
          <div className="absolute left-1/2 transform -translate-x-1/2 bottom-4">
            <ScrollButton containerRef={containerRef} scrollRef={bottomRef} />
          </div>
        </div>

        {/* Prompt Input Area */}
        <div className="sticky bottom-0 left-0 right-0 flex justify-center px-5 py-6 z-10 w-full bg-white dark:bg-[oklch(0.216_0.006_56.043)] shadow-sm">
          <div className="w-full max-w-4xl">
            <PromptInputWithActions
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onSubmit={handleSubmit}
              disabled={isSubmitting.current}
              placeholder={customPlaceholder || "Type a message..."}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// The outer component that provides context
export function ChatLayout(props: ChatLayoutProps) {
  const [currentModelId, setCurrentModelId] = useState(props.selectedModel || getDefaultLlm()?.id || '');
  const { setSelectedModel: setContextModel } = useChat();
  useEffect(() => {
    setContextModel(currentModelId);
  }, [currentModelId, setContextModel]);

  return (
    <SidebarProvider>
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
