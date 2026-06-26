import { authConfig, auth, handlers, signIn, signOut, getSession } from '@/lib/actions/auth';

export const authOptions = authConfig;

export { auth, handlers, signIn, signOut, getSession };
