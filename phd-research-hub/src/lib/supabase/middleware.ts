import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/update-password"];

export function allowedEmail(email: string | undefined | null): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true; // no allow-list configured: any confirmed account (sign-ups should be disabled in Supabase)
  return !!email && list.includes(email.toLowerCase());
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !url || !key;
  if (demo) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (user && !allowedEmail(user.email)) {
    await supabase.auth.signOut();
    const r = NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  }

  if (!user && !isPublic) {
    const to = new URL("/login", request.url);
    if (path !== "/") to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (user && path === "/login") return NextResponse.redirect(new URL("/", request.url));
  return response;
}
