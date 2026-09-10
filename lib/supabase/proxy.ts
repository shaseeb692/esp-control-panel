import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  /* =====================================================
     PUBLIC DEVICE API ROUTES
     These routes use x-device-key authentication instead
     of normal Supabase user session authentication.
  ===================================================== */

  const isPublicDeviceApi =
    pathname === "/api/device/status" ||
    pathname.startsWith("/api/device/status/");

  if (isPublicDeviceApi) {
    console.log("=================================");
    console.log("PROXY REQUEST:", pathname);
    console.log("PROXY: allowing public device API");
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
    }
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
      new URL("/auth/login", request.url)
    );
  }

  if (user && isAuthPage) {
    console.log("PROXY: logged-in user -> dashboard");

    return NextResponse.redirect(
      new URL("/dashboard", request.url)
    );
  }

  console.log("PROXY: allowing request");

  return response;
}