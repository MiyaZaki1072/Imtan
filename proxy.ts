import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase session cookie and does optimistic redirects only.
// Real checks happen on the server in lib/auth.ts (require*).

const STAFF = ['/vendor', '/admin', '/demo'];
const OPEN = ['/welcome', '/login'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) return response;

  const { pathname, search } = request.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return response;

  const target = STAFF.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ? '/login'
    : '/welcome';
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  // Pages only: skip Next internals, API routes and files with an extension.
  matcher: ['/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)'],
};
