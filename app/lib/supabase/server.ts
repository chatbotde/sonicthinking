// Supabase server client
import { createServerClient } from '@supabase/ssr';
import { type CookieOptions, createCookie } from '@remix-run/node';

export function createServerSupabaseClient(request: Request, response: Response) {
  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for server');
  }

  const cookies = {
    get(name: string) {
      const cookieHeader = request.headers.get('Cookie') || '';
      // Use a synchronous approach to avoid Promise<string>
      const pairs = cookieHeader.split(';').map(pair => pair.trim().split('='));
      const cookiePair = pairs.find(([key]) => key === name);
      return cookiePair ? decodeURIComponent(cookiePair[1]) : '';
    },
    set(name: string, value: string, options: CookieOptions) {
      // Create a simple cookie string manually
      const cookieOptions = [];
      if (options.maxAge) cookieOptions.push(`Max-Age=${options.maxAge}`);
      if (options.domain) cookieOptions.push(`Domain=${options.domain}`);
      if (options.path) cookieOptions.push(`Path=${options.path}`);
      if (options.httpOnly) cookieOptions.push('HttpOnly');
      if (options.secure) cookieOptions.push('Secure');
      if (options.sameSite) cookieOptions.push(`SameSite=${options.sameSite}`);
      
      const cookieString = `${name}=${encodeURIComponent(value)}; ${cookieOptions.join('; ')}`;
      response.headers.append('Set-Cookie', cookieString);
    },
    remove(name: string, options: CookieOptions) {
      // Set an expired cookie to remove it
      const cookieOptions = [];
      if (options.domain) cookieOptions.push(`Domain=${options.domain}`);
      if (options.path) cookieOptions.push(`Path=${options.path}`);
      if (options.httpOnly) cookieOptions.push('HttpOnly');
      if (options.secure) cookieOptions.push('Secure');
      if (options.sameSite) cookieOptions.push(`SameSite=${options.sameSite}`);
      
      const cookieString = `${name}=; Max-Age=0; ${cookieOptions.join('; ')}`;
      response.headers.append('Set-Cookie', cookieString);
    },
  };

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    { cookies }
  );
}
