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
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  isIndexPage?: boolean;
  customPlaceholder?: string;
}

// Inner component that uses useSidebar hook
function ChatLayoutContent({
  children,
  input,
  onInputChange,
  onSubmit,
  selectedModel,
  setSelectedModel,
  isIndexPage = false,
  customPlaceholder,
}: ChatLayoutProps) {
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const supabase = useSupabase();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { openMobile, setOpenMobile, open } = useSidebar();
  const isMobile = useIsMobile();
  const { 
    selectedModel: contextModel, 
    setSelectedModel: setContextModel,
    messages
  } = useChat(); 
  const location = useLocation();
  const isSubmitting = useRef(false);

  // Simplified handleSubmit: it now directly calls the onSubmit prop from the parent.
  // The parent (_index.tsx or chat.$chatId.tsx) is responsible for the actual logic
  // (creating chat, sending message, clearing input, etc.)
  const handleInternalSubmit = async (message: string) => {
    if (!message.trim() || isSubmitting.current) return;
    
    isSubmitting.current = true;
    try {
      await onSubmit(message); // Call the parent's onSubmit
    } catch (error) {
      console.error("Error during submission:", error);
      // Parent's onSubmit should handle error states and potentially restore input
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
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, location.pathname]);

  // Reset submission state when route changes
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
        <div className="flex-1 overflow-y-auto" ref={containerRef}>
          <div className="h-full w-full max-w-4xl mx-auto px-6 flex flex-col">
            <div className="flex-grow flex flex-col justify-center pt-12">
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
              onSubmit={handleInternalSubmit}
              disabled={isSubmitting.current}
              placeholder={
                customPlaceholder || 
                (isIndexPage ? "Type to start a new chat..." : "Type a message...")
              }
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
