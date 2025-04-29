import { LoaderFunctionArgs, ActionFunctionArgs, redirect } from "@remix-run/node";
import { createServerSupabaseClient } from "~/lib/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return redirect('/');
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const response = new Response();
  const supabase = createServerSupabaseClient(request, response);
  
  await supabase.auth.signOut();
  
  return redirect('/', {
    headers: response.headers
  });
};
