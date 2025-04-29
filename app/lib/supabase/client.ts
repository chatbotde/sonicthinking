// Supabase client configuration for browser
import { createBrowserClient } from '@supabase/ssr';

// Add ENV type to Window interface
declare global {
  interface Window {
    ENV?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
  }
}

export function createClient() {
  // For client-side code, we need to access environment variables differently
  // These values need to be exposed to the client via the loader
  const supabaseUrl = typeof document !== 'undefined' 
    ? window.ENV?.SUPABASE_URL 
    : process.env.SUPABASE_URL;
  
  const supabaseAnonKey = typeof document !== 'undefined'
    ? window.ENV?.SUPABASE_ANON_KEY
    : process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    throw new Error('Missing Supabase environment variables');
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}
