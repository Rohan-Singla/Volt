export interface TokenPayload {
  userId: string;
  username: string;
  exp: number;
}

/**
 * Decodes a JWT payload without verifying its signature.
 *
 * Verification needs JWT_SECRET, which lives only on the backend — neither the
 * browser nor the Next proxy may hold it. Callers here use this for routing and
 * UI state only; `requireAuth` on the Express API is the real security boundary.
 *
 * Runtime-agnostic on purpose: imported by both client components and proxy.ts,
 * so it must stay free of DOM and Node APIs.
 */
export function decodeToken(token: string): TokenPayload | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;

  const segment = segments[1];
  if (!segment) return null;

  try {
    // JWTs are base64url; atob expects base64 with padding.
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof (payload as TokenPayload).userId !== "string" ||
      typeof (payload as TokenPayload).username !== "string" ||
      typeof (payload as TokenPayload).exp !== "number"
    ) {
      return null;
    }

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export function isExpired(payload: TokenPayload): boolean {
  return payload.exp * 1000 < Date.now();
}
