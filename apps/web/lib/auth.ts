export interface TokenPayload {
  userId: string;
  username: string;
  exp: number;
}

export function saveToken(token: string) {
  localStorage.setItem("token", token);
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getPayload(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const raw = token.split(".")[1];
    const payload = JSON.parse(atob(raw)) as TokenPayload;
    if (payload.exp * 1000 < Date.now()) {
      signOut();
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getPayload() !== null;
}

export function signOut() {
  localStorage.removeItem("token");
  document.cookie = "token=; path=/; max-age=0";
}
