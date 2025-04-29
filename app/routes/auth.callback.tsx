import { redirect } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { createServerSupabaseClient } from '~/lib/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const response = new Response();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (code) {
    const supabase = createServerSupabaseClient(request, response);
    await supabase.auth.exchangeCodeForSession(code);
  }

  return redirect('/', {
    headers: response.headers
  });
};

export default function AuthCallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-center">Processing authentication, please wait...</p>
    </div>
  );
}