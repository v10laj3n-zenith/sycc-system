import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canRoleAccessPath, ROLE_DEFAULT_HOME } from "@/lib/rbac";
import type { AppRole, Database } from "@/types/database.types";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function updateSessionAndGuard(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const isConfigured =
    url.startsWith("https://") &&
    !url.includes("<") &&
    anonKey.length > 20 &&
    !anonKey.includes("<");

  if (!isConfigured) {
    if (!isPublicPath(pathname) && pathname !== "/login") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow offline QR pass shell if already cached; unauthenticated requests to protected routes go to /login
  if (!user) {
    if (isPublicPath(pathname) || pathname === "/qr-pass") {
      return supabaseResponse;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user hitting /login -> send to role home
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role: AppRole = profile?.role ?? "member";

  if (pathname === "/login") {
    return NextResponse.redirect(
      new URL(ROLE_DEFAULT_HOME[role], request.url)
    );
  }

  if (!canRoleAccessPath(role, pathname)) {
    return NextResponse.redirect(
      new URL(ROLE_DEFAULT_HOME[role], request.url)
    );
  }

  return supabaseResponse;
}
