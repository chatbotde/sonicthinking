export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  visibility: 'private' | 'public';
}
