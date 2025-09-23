// auth.ts
import NextAuth from "next-auth";
import { authConfig } from "./app/api/auth/[...nextauth]/config";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);