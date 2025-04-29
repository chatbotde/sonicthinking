import { useState, useEffect } from 'react';
import { useSupabase } from '~/hooks/use-supabase';

type VisibilityType = 'private' | 'public';

interface ChatVisibilityParams {
  chatId: string;
  initialVisibility?: VisibilityType;
}

// This hook can be used in two ways:
// 1. With a chatId to manage visibility of a specific chat
// 2. With a userId to manage general chat visibility preference
export function useChatVisibility(userId?: string): { chatVisibility: boolean; setChatVisibility: (value: boolean) => Promise<void> };
export function useChatVisibility(params: ChatVisibilityParams): { visibilityType: VisibilityType; setVisibilityType: (type: VisibilityType) => Promise<void> };
export function useChatVisibility(paramsOrUserId?: ChatVisibilityParams | string) {
  const supabase = useSupabase();
  
  // For general chat visibility (user preference)
  const [chatVisibility, setChatVisibilityState] = useState<boolean>(true);
  
  // For specific chat visibility type
  const [visibilityType, setVisibilityTypeState] = useState<VisibilityType>(
    typeof paramsOrUserId === 'object' && paramsOrUserId?.initialVisibility
      ? paramsOrUserId.initialVisibility
      : 'private'
  );

  useEffect(() => {
    // If userId is provided, fetch the user's chat visibility preference
    if (typeof paramsOrUserId === 'string' && paramsOrUserId) {
      const fetchUserPreference = async () => {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('chat_visibility')
          .eq('user_id', paramsOrUserId)
          .single();
        
        if (!error && data) {
          setChatVisibilityState(data.chat_visibility);
        }
      };
      
      fetchUserPreference();
    }
  }, [paramsOrUserId, supabase]);

  const setChatVisibility = async (value: boolean) => {
    if (typeof paramsOrUserId === 'string' && paramsOrUserId) {
      setChatVisibilityState(value);
      
      // Update in database
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: paramsOrUserId, 
          chat_visibility: value,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error updating chat visibility:', error);
      }
    }
  };

  const setVisibilityType = async (type: VisibilityType) => {
    if (typeof paramsOrUserId === 'object' && paramsOrUserId?.chatId) {
      setVisibilityTypeState(type);
      
      // Update in database
      const { error } = await supabase
        .from('chats')
        .update({ 
          visibility: type,
          updated_at: new Date().toISOString()
        })
        .eq('id', paramsOrUserId.chatId);
      
      if (error) {
        console.error('Error updating chat visibility type:', error);
      }
    }
  };

  // Return appropriate interface based on the input type
  if (typeof paramsOrUserId === 'string' || paramsOrUserId === undefined) {
    return { chatVisibility, setChatVisibility };
  } else {
    return { visibilityType, setVisibilityType };
  }
}
