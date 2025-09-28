import { auth } from '@/lib/actions/auth';

export default auth;

export const config = {
  matcher: ["/dashboard/:path*"],
};