import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  LiveReload,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import clsx from "clsx";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { useEffect, useState } from 'react';
import { useSupabase } from './hooks/use-supabase';
import { ensureTablesExist } from './lib/db/init-db';

import "./tailwind.css";
import { themeSessionResolver } from "./sessions.server";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// Return the theme from the session storage using the loader
export async function loader({ request }: LoaderFunctionArgs) {
  const { getTheme } = await themeSessionResolver(request);
  
  // Expose Supabase environment variables to the client
  return {
    theme: getTheme(),
    ENV: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    },
  };
}

// Wrap your app with ThemeProvider.
export default function AppWithProviders() {
  const data = useLoaderData<typeof loader>();
  return (
    <ThemeProvider specifiedTheme={data.theme} themeAction="/action/set-theme">
      <App />
    </ThemeProvider>
  );
}

export function App() {
  const data = useLoaderData<typeof loader>();
  const [theme] = useTheme();
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const supabase = useSupabase();
  
  useEffect(() => {
    const checkDatabase = async () => {
      try {
        const ready = await ensureTablesExist(supabase);
        setDbReady(ready);
      } catch (error) {
        console.error('Error checking database:', error);
        setDbReady(false);
      }
    };
    
    checkDatabase();
  }, [supabase]);

  return (
    <html lang="en" className={clsx(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
        <Links />
      </head>
      <body>
        {dbReady === false ? (
          <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="max-w-md p-6 bg-card rounded-lg shadow-lg">
              <h1 className="text-2xl font-bold mb-4">Database Setup Required</h1>
              <p className="mb-4">
                The required database tables aren't set up correctly. Please run the SQL setup script
                provided in the documentation.
              </p>
              <pre className="bg-muted p-4 rounded text-sm mb-4 overflow-auto">
                CREATE TABLE public.chats (...);<br />
                CREATE TABLE public.messages (...);<br />
                {/* SQL setup summary */}
              </pre>
              <p>
                After setting up the database, refresh this page.
              </p>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
        <ScrollRestoration />
        {/* Add ENV variables to window object */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
          }}
        />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
