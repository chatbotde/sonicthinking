export type Chat = {
  id: string; // UUID stored as string in TypeScript
  title: string;
  created_at: string;
  updated_at: string;
  user_id: string; // UUID stored as string in TypeScript
  visibility: 'private' | 'public';
  model?: string;
};
  
export type Message = {
  id: string; // UUID stored as string in TypeScript
  chat_id: string; // UUID stored as string in TypeScript
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  updated_at?: string;
  user_id: string; // UUID stored as string in TypeScript
  model_params?: Record<string, any>;
  metadata?: Record<string, any>;
};

export type Vote = {
  id: string;
  message_id: string;
  vote: 'up' | 'down';
  created_at: string;
  user_id: string;
};

export type AiModel = {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  is_active: boolean;
  created_at: string;
  config?: Record<string, any>;
};
  
export type Database = {
  public: {
    Tables: {
      chats: {
        Row: Chat;
        Insert: Omit<Chat, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Chat, 'id' | 'created_at'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
      };
      votes: {
        Row: Vote;
        Insert: Omit<Vote, 'id' | 'created_at'>;
        Update: Partial<Omit<Vote, 'id' | 'created_at'>>;
      };
      ai_models: {
        Row: AiModel;
        Insert: Omit<AiModel, 'id' | 'created_at'>;
        Update: Partial<Omit<AiModel, 'id' | 'created_at'>>;
      };
    };
  };
};
