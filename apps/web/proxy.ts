import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeToken, isExpired } from "@/lib/token";

const PROTECTED = ["/dashboard", "/project"];
const AUTH_ONLY = ["/signin", "/signup"];

/**
 * Optimistic auth routing only.
 *
 * The signature is deliberately not verified here — JWT_SECRET stays on the
 * backend, and Next's docs are explicit that proxy "should not be used as a
 * full session management or authorization solution". `requireAuth` on the
 * Express API remains the security boundary; this just avoids rendering pages
 * the user cannot use.
 */
export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload = token ? decodeToken(token) : null;
  const signedIn = payload !== null && !isExpired(payload);

  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));

  if (isProtected && !signedIn) {
    const url = new URL("/", req.url);
    url.searchParams.set("auth", token ? "expired" : "required");
    url.searchParams.set("next", pathname + search);

    const res = NextResponse.redirect(url);
    // A present-but-unusable token would otherwise bounce every navigation
    // with nothing to show for it.
    if (token) res.cookies.delete("token");
    return res;
  }

  if (isAuthOnly && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/project/:path*", "/signin", "/signup"],
};
