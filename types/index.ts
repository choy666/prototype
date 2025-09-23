// En types/index.ts
export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  emailVerified?: Date | null;
  image?: string | null;
}