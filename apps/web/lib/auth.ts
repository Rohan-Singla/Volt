import { decodeToken, isExpired, type TokenPayload } from "./token";

export type { TokenPayload };

const TOKEN_KEY = "token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The cookie is the single source of truth for the session.
 *
 * proxy.ts can only read cookies, so anything kept solely in localStorage is
 * invisible to it: the UI would render a signed-in header while every
 * navigation to /dashboard bounced back to "/".
 */
function writeCookie(token: string) {
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function saveToken(token: string) {
  writeCookie(token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;

  const cookie = readCookie();
  if (cookie) return cookie;

  // Sessions created before the cookie became authoritative live only in
  // localStorage. Promote one if present, then drop the copy so there is
  // exactly one source of truth from here on.
  const legacy = localStorage.getItem(TOKEN_KEY);
  if (!legacy) return null;

  writeCookie(legacy);
  localStorage.removeItem(TOKEN_KEY);
  return legacy;
}

export function getPayload(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;

  const payload = decodeToken(token);
  if (!payload || isExpired(payload)) {
    // Clear it rather than leaving a token the proxy will keep rejecting.
    signOut();
    return null;
  }

  return payload;
}

export function isLoggedIn(): boolean {
  return getPayload() !== null;
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}
