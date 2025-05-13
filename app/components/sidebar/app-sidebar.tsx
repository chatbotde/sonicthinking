import type { User } from '~/types';
import { useNavigate, Link, useParams } from '@remix-run/react';
import { useEffect, useState } from 'react';

import { NewChatIcon, SidebarLeftIcon } from '~/components/icons';
import { SidebarHistory } from '~/components/sidebar/sidebar-history';
import { SidebarUserNav } from '~/components/sidebar/sidebar-user-nav';
import { Button } from '~/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
  SidebarTrigger
} from '~/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useSupabase } from '~/hooks/use-supabase';
import { useChat } from '~/context/chat-context';
import { useIsMobile } from '~/hooks/use-mobile';

export function AppSidebar() {
  const navigate = useNavigate();
  const params = useParams();
  const { setOpenMobile, open, setOpen, openMobile } = useSidebar();
  const supabase = useSupabase();
  const { createNewChat, messages } = useChat();
  const [user, setUser] = useState<User | undefined>(undefined);
  const isMobile = useIsMobile();

  // Initialize mobile sidebar state
  useEffect(() => {
    if (isMobile) {
      // Ensure the sidebar is initially closed on mobile
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  // Improve user fetch effect with better error handling
  useEffect(() => {
    const fetchUser = async () => {
      try {
        console.log('Fetching current user');
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError) {
          console.error('Auth error fetching user:', authError);
          return;
        }
        
        if (!authUser) {
          console.log('No authenticated user found');
          return;
        }
        
        console.log('Auth user found:', authUser.id);
        
        try {
          // Get additional user data if needed
          const { data, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
            
          if (profileError) {
            console.error('Error fetching user profile:', profileError);
          }
            
          if (data) {
            console.log('User profile found');
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              name: data.name || authUser.email?.split('@')[0] || '',
              avatar_url: data.avatar_url || authUser.user_metadata?.avatar_url || '',
            });
          } else {
            // Fallback if user record not found
            console.log('No user profile found, using auth data');
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
              avatar_url: authUser.user_metadata?.avatar_url || '',
            });
          }
        } catch (profileError) {
          console.error('Exception fetching user profile:', profileError);
          // Still set the user with basic auth info
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0] || '',
            avatar_url: '', // Ensure avatar_url is always defined
          });
        }
      } catch (error) {
        console.error('Exception in fetchUser:', error);
      }
    };

    fetchUser();
  }, [supabase]);

  // Get history from sidebar-history component
  const [history, setHistory] = useState<Array<any>>([]);
  useEffect(() => {
    if (window.chatHistory) {
      setHistory(window.chatHistory);
    }
  }, []);

  // Improve the new chat handler with better empty chat detection
  const handleNewChat = async () => {
    console.log('handleNewChat called. User:', user); // Log user state
    if (!user) {
      console.error('No user found, cannot create chat');
      // Optionally show a message to the user to log in
      return;
    }

    try {
      // Check if there's already an empty chat we can navigate to
      const emptyChats = history?.filter(chat => 
        chat.isEmpty === true || 
        (chat.title === 'New Chat' && !chat.hasMessages)
      );

      if (emptyChats?.length > 0) {
        console.log('Found existing empty chat, navigating instead of creating new one:', emptyChats[0].id);
        setOpenMobile(false);
        navigate(`/chat/${emptyChats[0].id}`);
        return;
      }

      console.log('No empty chats found, creating new chat for user:', user.id);
      const newChatId = await createNewChat(); // Await the async function
      console.log('New chat created successfully, navigating to:', newChatId);
      setOpenMobile(false); // Close mobile sidebar on navigation
      navigate(`/chat/${newChatId}`);
    } catch (error) {
      console.error('Failed to create new chat:', error);
      // You might want to show an error toast or message to the user here
    }
  };

  // Disable button if on a chat page (/chat/...) and there are no messages yet
  // OR if there's already an empty chat
  const hasEmptyChat = history?.some(chat => 
    chat.isEmpty === true || 
    (chat.title === 'New Chat' && !chat.hasMessages)
  );
  
  const isNewChatButtonDisabled = 
    (!!params.chatId && messages.length === 0) || 
    hasEmptyChat;

  // Determine if the New Chat button should be visible
  const showNewChatButton = open || openMobile;

  return (
    <>
      {/* Fixed mobile trigger button */}
      {isMobile && !openMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-2 top-2 z-50 bg-background/80 backdrop-blur-sm rounded-md shadow-md h-10 px-3"
          onClick={() => setOpenMobile(true)}
        >
          <SidebarLeftIcon />
          <span className="sr-only">Open Sidebar</span>
        </Button>
      )}
      
      <Sidebar className={`bg-[var(--sidebar-background)] group-data-[side=left]:border-r transition-all duration-300 ${open ? 'w-64' : 'w-0 sm:w-16'}`}>
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row justify-between items-center">
              <Link
                to="/"
                onClick={() => {
                  setOpenMobile(false);
                }}
                className="flex flex-row gap-3 items-center"
              >
                {(open || openMobile) && (
                  <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                    Sonicthinking
                  </span>
                )}
              </Link>
              <div className="flex items-center">
                {/* Conditionally render the New Chat button based on visibility state */}
                {showNewChatButton && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        type="button"
                        className="p-2 h-fit"
                        onClick={handleNewChat}
                        disabled={isNewChatButtonDisabled}
                      >
                        <NewChatIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="end">New Chat</TooltipContent>
                  </Tooltip>
                )}
                {!isMobile && (
                  <SidebarTrigger className="hidden sm:flex h-8 w-8" />
                )}
                {isMobile && openMobile && (
                  <Button
                    variant="ghost"
                    type="button"
                    className="p-2 h-fit"
                    onClick={() => setOpenMobile(false)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                      <path d="M18 6 6 18"/>
                      <path d="m6 6 12 12"/>
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className={(open || openMobile) ? '' : 'hidden sm:block'}>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter className={(open || openMobile) ? '' : 'hidden sm:block'}>
          {user && <SidebarUserNav user={user} />}
        </SidebarFooter>
      </Sidebar>

      {/* Desktop reopen button when closed */}
      {!open && !isMobile && (
        <SidebarTrigger 
          className="hidden sm:flex fixed left-2 top-2 z-20 bg-background/80 backdrop-blur-sm rounded-md shadow-md h-10 px-4"
        />
      )}
    </>
  );
}


