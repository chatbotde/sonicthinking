import { useEffect, useState } from 'react';

/**
 * Custom hook to manage animation states with localStorage persistence
 * This ensures animations only play once per message, even across page refreshes
 */
export function useAnimationState(messageId: string): [boolean, (value: boolean) => void] {
  // Initialize state from localStorage if available, otherwise default to false (not animated)
  const [hasAnimated, setHasAnimated] = useState<boolean>(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return false;
    
    try {
      // Get the animation states from localStorage
      const animatedMessages = localStorage.getItem('animatedMessages');
      if (!animatedMessages) return false;
      
      // Parse the JSON and check if this message ID exists
      const animatedMessagesObj = JSON.parse(animatedMessages);
      // Ensure we properly check if this message has been animated before
      return animatedMessagesObj[messageId] === true;
    } catch (error) {
      console.error('Error reading animation state from localStorage:', error);
      return false;
    }
  });

  // Update localStorage when animation state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Get current animated messages
      const animatedMessages = localStorage.getItem('animatedMessages');
      let animatedMessagesObj = animatedMessages ? JSON.parse(animatedMessages) : {};
      
      // Add this message ID to the object if it's been animated
      // or remove it if it hasn't (to ensure consistency)
      if (hasAnimated) {
        animatedMessagesObj[messageId] = true;
      } else {
        delete animatedMessagesObj[messageId];
      }
      
      // Save back to localStorage
      localStorage.setItem('animatedMessages', JSON.stringify(animatedMessagesObj));
    } catch (error) {
      console.error('Error saving animation state to localStorage:', error);
    }
  }, [messageId, hasAnimated]);

  return [hasAnimated, setHasAnimated];
}