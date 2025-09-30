//app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/actions/auth';

export const { GET, POST } = handlers;