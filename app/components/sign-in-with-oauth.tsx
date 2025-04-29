import { useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";

interface UseGoogleSignInReturn {
  signInWithGoogle: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useGoogleSignIn(supabase: SupabaseClient): UseGoogleSignInReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Determine if we're in development or production
      const isDevelopment = window.location.hostname === 'localhost';
      
      // Choose appropriate redirect URL based on environment
      const redirectUrl = isDevelopment 
        ? 'http://localhost:5173/auth/callback'
        : 'https://sonicthinking.com/auth/callback';
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(`Error signing in with Google: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithGoogle,
    isLoading,
    error,
  };
}