import type { User, Chat } from '~/types';
import { useNavigate, Link, useLocation, useFetcher } from '@remix-run/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { isToday, isYesterday, subMonths, subWeeks, format } from 'date-fns';

import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { useSidebar } from '~/components/ui/sidebar';
import { useIsMobile } from '~/hooks/use-mobile';
import { useChatVisibility } from '~/hooks/use-chat-visibility';
import { useSupabase } from '~/hooks/use-supabase';
import { TrashIcon, PencilEditIcon, MoreHorizontalIcon } from '~/components/icons';

export function SidebarHistory({ user }: { user: User | undefined }) {
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { chatVisibility } = useChatVisibility(user?.id);
  const supabase = useSupabase();
  const fetcher = useFetcher();
  
  const [history, setHistory] = useState<Array<Chat>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [generatingTitles, setGeneratingTitles] = useState<string[]>([]);
  
  // Move pendingTitleRef to the component top level
  const pendingTitleRef = useRef<Set<string>>(new Set());
  
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Initial fetch - improve error handling and logging
  useEffect(() => {
    fetchHistory();
  }, [supabase, user]);

  // New function to trigger title generation with retry limitation
  const generateChatTitle = useCallback(async (chatId: string) => {
    if (!user?.id || generatingTitles.includes(chatId)) return;
    
    try {
      // Add to generating titles list to prevent duplicate requests
      setGeneratingTitles(prev => [...prev, chatId]);
      
      console.log(`Generating title for chat ${chatId}`);
      
      // Call the API endpoint to generate and save the title
      const response = await fetch(`/api/chats/${chatId}/summarize-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin' // Ensure cookies are sent for authentication
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`API error (${response.status}): ${errorData.error || response.statusText}`);
        
        if (response.status === 422) {
          // Chat has no messages yet, mark it to avoid repeated attempts
          console.log(`Chat ${chatId} has no messages, setting a temporary title`);
          setHistory(prev => 
            prev.map(chat => 
              chat.id === chatId 
                ? { ...chat, title: "New Chat" } 
                : chat
            )
          );
        }
        
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.title) {
        console.log(`Title generated for chat ${chatId}: "${result.title}"`);
        // Manually update the title in case real-time subscription doesn't capture it
        setHistory(prev => 
          prev.map(chat => 
            chat.id === chatId 
              ? { ...chat, title: result.title }
              : chat
          )
        );
      } else {
        console.error(`Failed to generate title for chat ${chatId}:`, result.error);
      }
    } catch (error) {
      console.error(`Error generating title for chat ${chatId}:`, error);
    } finally {
      setGeneratingTitles(prev => prev.filter(id => id !== chatId));
    }
  }, [user?.id, generatingTitles]);

  // Check for chats that need titles - with pendingTitleRef moved to component level
  useEffect(() => {
    if (!user?.id) return;
    
    // Find chats with default or empty titles that we haven't tried yet
    const chatsNeedingTitles = history.filter(chat => 
      (
        !chat.title || 
        chat.title === 'New Chat' || 
        chat.title.trim() === ''
      ) && 
      !pendingTitleRef.current.has(chat.id) && 
      !generatingTitles.includes(chat.id)
    );
    
    // Generate titles one by one with delay between requests
    if (chatsNeedingTitles.length > 0 && generatingTitles.length === 0) {
      const chatToProcess = chatsNeedingTitles[0];
      console.log(`Found chat needing title generation: ${chatToProcess.id}`);
      
      // Mark this chat as attempted
      pendingTitleRef.current.add(chatToProcess.id);
      
      // Add a short delay to prevent immediate generation which might lack context
      setTimeout(() => generateChatTitle(chatToProcess.id), 2000);
    }
  }, [history, user?.id, generateChatTitle, generatingTitles]);

  // Real-time subscription for chat changes
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up real-time subscription for user:', user.id);
    
    const channelName = `chat-changes-${user.id}`;
    console.log(`Creating Supabase channel: ${channelName}`);
    
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'chats',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('Chat change received:', payload);

        if (payload.eventType === 'INSERT') {
          console.log('Inserting new chat into history:', payload.new);
          setHistory(prev => {
            // Check for duplicates first
            const exists = prev.some(chat => chat.id === payload.new.id);
            if (exists) {
              console.log('Chat already exists in history, not adding duplicate');
              return prev;
            }
            
            const newChat = {
              id: payload.new.id,
              title: payload.new.title || 'New Chat',
              userId: payload.new.user_id,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
              visibility: payload.new.visibility || 'private'
            };
            
            // Add the new chat at the top of the list
            const updatedHistory = [newChat, ...prev].sort((a, b) => {
              // Sort by updated_at date, newest first
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
            
            // Trigger title generation for the new chat
            if (!newChat.title || newChat.title === 'New Chat') {
              setTimeout(() => generateChatTitle(newChat.id), 500);
            }
            
            return updatedHistory;
          });
        } else if (payload.eventType === 'UPDATE') {
          console.log('Updating chat in history:', payload.new);
          setHistory(prev => {
            // Create a new array with the updated chat
            const updated = prev.map(chat => 
              chat.id === payload.new.id 
                ? {
                    ...chat,
                    title: payload.new.title || 'New Chat',
                    updatedAt: payload.new.updated_at,
                    visibility: payload.new.visibility || chat.visibility
                  }
                : chat
            );
            
            // Sort the array by updated_at date
            return updated.sort((a, b) => 
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          });
        } else if (payload.eventType === 'DELETE') {
          console.log('Removing chat from history:', payload.old.id);
          setHistory(prev => prev.filter(chat => chat.id !== payload.old.id));
        }
      })
      .subscribe(status => {
        console.log(`Subscription status for ${channelName}:`, status);
      });

    console.log('Subscription created:', subscription);

    return () => {
      console.log(`Cleaning up subscription for channel: ${channelName}`);
      supabase.removeChannel(subscription);
    };
  }, [supabase, user, generateChatTitle]);

  // Force refresh history when component mounts or when user changes
  useEffect(() => {
    if (user?.id) {
      console.log('Force refreshing chat history for user:', user.id);
      fetchHistory(); // Call the fetch history function directly
    }
  }, [user?.id]); // Only depend on user.id to prevent excessive fetching

  // Extract fetchHistory as a named function for reuse
  const fetchHistory = async () => {
    if (!user?.id) {
      console.log('No user ID, skipping fetch');
      return;
    }
  
    console.log('Fetching chat history for user:', user.id);
    setIsLoading(true);
    setError(null);
  
    try {
      const { data: chats, error: chatsError } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
  
      if (chatsError) {
        console.error('Error fetching chats:', chatsError);
        throw chatsError;
      }
  
      console.log(`Fetched ${chats?.length || 0} chats:`, chats);
  
      const formattedChats = (chats || []).map(chat => ({
        id: chat.id,
        title: chat.title || 'New Chat',
        userId: chat.user_id,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        visibility: chat.visibility as 'private' | 'public'
      }));
  
      setHistory(formattedChats);
    } catch (error: any) {
      console.error("Error fetching chats:", error);
      setError(`Failed to load chats: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus the input field when editing starts
  useEffect(() => {
    if (editingChatId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingChatId]);

  const startRenaming = (chat: Chat) => {
    setEditingChatId(chat.id);
    setNewTitle(chat.title || 'New Chat');
    setOpenMenuId(null);
  };

  const cancelRenaming = () => {
    setEditingChatId(null);
    setNewTitle('');
  };

  const saveNewTitle = async () => {
    if (!editingChatId) return;
    
    try {
      const userId = user?.id || (process.env.NODE_ENV === 'development' ? '00000000-0000-0000-0000-000000000000' : null);
      
      if (!userId) return;
      
      // Use Remix fetcher for optimistic updates
      fetcher.submit(
        { title: newTitle.trim() || 'New Chat' },
        { 
          method: 'post',
          action: `/api/chats/${editingChatId}/rename`
        }
      );
      
      // Optimistically update local state
      setHistory(history.map((chat) => 
        chat.id === editingChatId ? { ...chat, title: newTitle.trim() || 'New Chat' } : chat
      ));
      
      setEditingChatId(null);
      setNewTitle('');
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNewTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRenaming();
    }
  };

  const deleteChat = async (id: string) => {
    try {
      const userId = user?.id || (process.env.NODE_ENV === 'development' ? '00000000-0000-0000-0000-000000000000' : null);
      
      if (!userId) return;
      
      // First delete all messages associated with the chat
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', id);

      if (messagesError) throw messagesError;

      // Then delete the chat
      const { error: chatError } = await supabase
        .from('chats')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (chatError) throw chatError;
      
      // Optimistically update local state
      setHistory(history.filter((chat: Chat) => chat.id !== id));
      setOpenMenuId(null);
      
      // If we're on the deleted chat page, navigate to home
      const currentPath = window.location.pathname;
      if (currentPath.includes(`/chat/${id}`)) {
        navigate('/');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setError('Failed to delete chat. Please try again.');
    }
  };

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const groupChatsByDate = useCallback((chats: Chat[]) => {
    const groups: { [key: string]: Chat[] } = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: []
    };

    chats.forEach(chat => {
      const date = new Date(chat.updatedAt || chat.createdAt);
      
      if (isToday(date)) {
        groups.today.push(chat);
      } else if (isYesterday(date)) {
        groups.yesterday.push(chat);
      } else if (date > subWeeks(new Date(), 1)) {
        groups.lastWeek.push(chat);
      } else if (date > subMonths(new Date(), 1)) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }
    });
    return groups;
  }, []);

  return (
    <div className="flex flex-col gap-2 px-2">
      {error && (
        <div className="px-2 text-sm text-red-500">
          {error}
        </div>
      )}
      
      {chatVisibility && (
        <>
          {isLoading ? (
            <div className="space-y-2 px-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : history.length === 0 ? (
            <div className="px-2 text-sm text-muted-foreground">
              No chat history
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupChatsByDate(history)).map(([period, chats]) => 
                chats.length > 0 ? (
                  <div key={period}>
                    <div className="px-2 text-xs font-semibold text-muted-foreground uppercase mb-2">
                      {period === 'today' ? 'Today' :
                       period === 'yesterday' ? 'Yesterday' :
                       period === 'lastWeek' ? 'Last 7 Days' :
                       period === 'lastMonth' ? 'Last 30 Days' : 'Older'}
                    </div>
                    <div className="space-y-1">
                      {chats.map((chat: Chat) => (
                        <div
                          key={chat.id}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted"
                        >
                          {editingChatId === chat.id ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={newTitle}
                              onChange={(e) => setNewTitle(e.target.value)}
                              onBlur={saveNewTitle}
                              onKeyDown={handleKeyDown}
                              className="flex-1 bg-transparent text-sm rounded border border-input px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                              placeholder="Chat name"
                            />
                          ) : (
                            <Link
                              to={`/chat/${chat.id}`}
                              className="flex-1 truncate text-sm flex items-center"
                              onClick={() => {
                                if (isMobile) {
                                  setOpenMobile(false);
                                }
                              }}
                            >
                              {generatingTitles.includes(chat.id) ? (
                                <>
                                  <span className="inline-block w-3 h-3 bg-muted-foreground animate-pulse rounded-full mr-2"></span>
                                  <span className="text-muted-foreground">Generating title...</span>
                                </>
                              ) : (
                                chat.title || 'New Chat'
                              )}
                            </Link>
                          )}
                          
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => toggleMenu(chat.id, e)}
                            >
                              <MoreHorizontalIcon size={14} />
                              <span className="sr-only">More options</span>
                            </Button>
                            
                            {openMenuId === chat.id && (
                              <div 
                                ref={menuRef}
                                className="absolute right-0 mt-1 w-36 rounded-md bg-background shadow-lg border border-border z-50"
                              >
                                <div className="py-1">
                                  <button
                                    className="flex w-full items-center px-3 py-2 text-sm hover:bg-muted"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      startRenaming(chat);
                                    }}
                                  >
                                    <span className="mr-2">
                                      <PencilEditIcon size={14} />
                                    </span>
                                    Rename
                                  </button>
                                  <button
                                    className="flex w-full items-center px-3 py-2 text-sm hover:bg-muted"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      generateChatTitle(chat.id);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    <span className="mr-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m12 14 4-4"/>
                                        <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
                                      </svg>
                                    </span>
                                    Generate title
                                  </button>
                                  <button
                                    className="flex w-full items-center px-3 py-2 text-sm text-red-500 hover:bg-muted"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      deleteChat(chat.id);
                                    }}
                                  >
                                    <span className="mr-2">
                                      <TrashIcon size={14} />
                                    </span>
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


