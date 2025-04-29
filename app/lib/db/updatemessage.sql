-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow insert access based on chat ownership" ON public.messages;

-- Create a new policy to allow users to insert messages in their own chats
CREATE POLICY "Allow insert access based on chat ownership" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
    );

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow select access based on chat ownership" ON public.messages;

-- Create a new policy to allow users to select messages from their own chats
CREATE POLICY "Allow select access based on chat ownership" ON public.messages
    FOR SELECT USING (
        auth.uid() = user_id AND
        chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
    );
--Grant usage permissions for the public schema and select/insert/update/delete permissions on the new tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated; -- postgres is the superuser, anon/authenticated are Supabase roles
GRANT ALL ON TABLE public.ai_models, public.chats, public.messages, public.votes TO postgres, anon, authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO postgres, anon, authenticated;  
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;  