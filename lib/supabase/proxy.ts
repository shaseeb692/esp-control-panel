import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(
  request: NextRequest
) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            }
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const { data: claimsData } =
    await supabase.auth.getClaims();

  const claims = claimsData?.claims ?? null;

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/auth/");

  /*
   * USER IS NOT LOGGED IN
   *
   * Protect everything except /auth/*
   */

  if (!claims && !isAuthPage) {
    return NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
  }

  /*
   * USER IS ALREADY LOGGED IN
   *
   * Don't allow logged-in users to stay
   * on login/signup/auth pages.
   */

  if (claims && isAuthPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  return response;
}