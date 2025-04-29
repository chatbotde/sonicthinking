// This file contains the server-side code for handling authentication.
import { createCookieSessionStorage, json, redirect } from '@remix-run/node';
import { createServerSupabaseClient } from './supabase/server';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set');
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    secure: process.env.NODE_ENV === 'production',
    secrets: [process.env.SESSION_SECRET],
    sameSite: 'lax',
    path: '/',
    httpOnly: true,
  },
});

export async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

// Export the createServerSupabaseClient function
export { createServerSupabaseClient };

export async function isAuthenticated(request: Request) {
  const response = new Response();
  const supabase = createServerSupabaseClient(request, response);
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

export async function requireAuth(request: Request, redirectTo = '/') {
  const response = new Response();
  const supabase = createServerSupabaseClient(request, response);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw redirect(redirectTo);
  }

  return { supabase, session };
}

export async function logout(request: Request) {
  const response = new Response();
  const supabase = createServerSupabaseClient(request, response);
  
  await supabase.auth.signOut();
  
  return redirect('/', {
    headers: response.headers
  });
}

// Create a consolidated auth object that includes all authentication functions
export const auth = {
  isAuthenticated,
  requireAuth,
  logout,
  getSession
};

// Also maintain the old exports for backward compatibility
export const authenticator = {
  isAuthenticated,
  requireAuth,
  logout
};
