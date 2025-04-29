-- Assuming a users table exists in Supabase Auth schema (auth.users).
-- We will reference auth.users.id instead of creating a public.users table.

-- Enable pgcrypto extension if not already enabled (needed for gen_random_uuid())
-- You might need to run this separately in Supabase SQL Editor if you get an error.
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table for AI Models
CREATE TABLE IF NOT EXISTS public.ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL UNIQUE, -- Assuming model_id should be unique
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    config JSONB, -- Use JSONB for better indexing and querying in PostgreSQL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table for Chat sessions
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Reference Supabase auth users
    title TEXT NOT NULL,
    model TEXT,
    visibility TEXT CHECK (visibility IN ('private', 'public')) DEFAULT 'private' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Table for Messages within a Chat
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Reference Supabase auth users
    content TEXT NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    model_params JSONB,
    metadata JSONB,
    history JSONB, -- Add the history column (jsonb is flexible for arrays)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE -- Nullable
);

-- Table for Votes on Messages
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Reference Supabase auth users
    vote TEXT CHECK (vote IN ('up', 'down')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    -- Add a unique constraint to prevent a user from voting multiple times on the same message
    UNIQUE (message_id, user_id)
);

-- Optional: Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_message_id ON public.votes(message_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON public.votes(user_id);

-- Optional: Add a trigger function to automatically update `updated_at` timestamps
-- For chats table
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Drop trigger if exists before creating, to avoid errors on re-run
DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;

CREATE TRIGGER update_chats_updated_at
BEFORE UPDATE ON public.chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grant usage permissions for the public schema and select/insert/update/delete permissions on the new tables
-- Adjust these grants based on your specific security requirements (e.g., RLS policies)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated; -- postgres is the superuser, anon/authenticated are Supabase roles
GRANT ALL ON TABLE public.ai_models, public.chats, public.messages, public.votes TO postgres, anon, authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO postgres, anon, authenticated;

-- Note: Supabase manages sequence permissions automatically, but if you had custom sequences, you'd grant usage:
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated;

-- Apply Row Level Security (RLS) - IMPORTANT for Supabase
-- Enable RLS for each table
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (You MUST tailor these to your application's logic)

-- ai_models: Allow read access to all authenticated users
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.ai_models;
CREATE POLICY "Allow authenticated read access" ON public.ai_models
    FOR SELECT USING (auth.role() = 'authenticated');

-- chats: Allow users to manage their own chats
DROP POLICY IF EXISTS "Allow individual insert access" ON public.chats;
CREATE POLICY "Allow individual insert access" ON public.chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual select access" ON public.chats;
CREATE POLICY "Allow individual select access" ON public.chats
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual update access" ON public.chats;
CREATE POLICY "Allow individual update access" ON public.chats
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow individual delete access" ON public.chats;
CREATE POLICY "Allow individual delete access" ON public.chats
    FOR DELETE USING (auth.uid() = user_id);

-- messages: Allow users to manage messages in their own chats
DROP POLICY IF EXISTS "Allow insert access based on chat ownership" ON public.messages;
CREATE POLICY "Allow insert access based on chat ownership" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Allow select access based on chat ownership" ON public.messages;
CREATE POLICY "Allow select access based on chat ownership" ON public.messages
    FOR SELECT USING (
        auth.uid() = user_id AND
        chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
    );

-- Add UPDATE policy for messages
DROP POLICY IF EXISTS "Allow update access based on ownership" ON public.messages;
CREATE POLICY "Allow update access based on ownership" ON public.messages
    FOR UPDATE USING (auth.uid() = user_id) -- User can update their own messages
    WITH CHECK (auth.uid() = user_id); -- Ensure they don't change ownership

-- Note: Decide if users should be able to update/delete messages. Add policies if needed.
-- Add DELETE policy for messages (Optional)
-- DROP POLICY IF EXISTS "Allow delete access based on ownership" ON public.messages;
-- CREATE POLICY "Allow delete access based on ownership" ON public.messages
--     FOR DELETE USING (auth.uid() = user_id);