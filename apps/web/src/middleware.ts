import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/become-host',
  '/legal',
  '/admin/login',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/community-guidelines',
  '/content-policy',
  '/age-policy',
  '/contact',
];
const PUBLIC_PREFIXES = ['/login/', '/legal/'];
const PROTECTED_PREFIXES = [
  '/home',
  '/favorites',
  '/swipe',
  '/match',
  '/audio-call',
  '/video-call',
  '/wallet',
  '/settings',
  '/promotions',
  '/host',
  '/calls',
  '/referrals',
  '/invite',
  '/reports',
  '/notifications',
  '/onboarding',
  '/profiles',
  '/gifts',
];
const ADMIN_PREFIX = '/admin';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('platform_token')?.value;
  const { pathname } = request.nextUrl;

  // Private /dev/* testing routes: never available in production builds
  if (pathname.startsWith('/dev')) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(null, { status: 404, statusText: 'Not Found' });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/messages')) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  if (pathname === '/match') {
    return NextResponse.redirect(new URL('/video-call', request.url));
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith(ADMIN_PREFIX) && pathname !== '/admin/login';

  if ((isProtected || isAdmin) && !token && !isPublic) {
    const loginUrl = new URL(isAdmin ? '/admin/login' : '/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};