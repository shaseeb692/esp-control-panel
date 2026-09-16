import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  /* =====================================================
     PUBLIC DEVICE API ROUTES

     IMPORTANT:
     "Public" here only means these routes do NOT require
     a normal Supabase browser/user session.

     Each device API route performs its own device
     authentication.

     /api/device/status
       -> current prototype x-device-key authentication

     /api/device/claim-session
       -> x-device-id + unique x-device-secret
  ===================================================== */

  const isPublicDeviceApi =
    pathname === "/api/device/status" ||
    pathname.startsWith("/api/device/status/") ||
    pathname === "/api/device/claim-session" ||
    pathname.startsWith("/api/device/claim-session/");

  if (isPublicDeviceApi) {
    console.log("=================================");
    console.log("PROXY REQUEST:", pathname);
    console.log("PROXY: allowing device API authentication");
    console.log("=================================");

    return response;
  }

  /* =====================================================
     SUPABASE SESSION
  ===================================================== */

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("=================================");
  console.log("PROXY REQUEST:", pathname);
  console.log("USER:", user?.email ?? "NO USER");
  console.log("AUTH ERROR:", error?.message ?? "NONE");
  console.log("=================================");

  const isAuthPage = pathname.startsWith("/auth/");
  const isRootPage = pathname === "/";

  if (!user && !isAuthPage && !isRootPage) {
    console.log("PROXY: redirecting to LOGIN");

    return NextResponse.redirect(
      new URL("/auth/login", request.url),
    );
  }

  if (user && isAuthPage) {
    console.log("PROXY: logged-in user -> dashboard");

    return NextResponse.redirect(
      new URL("/dashboard", request.url),
    );
  }

  console.log("PROXY: allowing request");

  return response;
}