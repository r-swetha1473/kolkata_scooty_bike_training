/**
 * Single place for JWT persistence. Prefer localStorage so tokens survive tab close
 * and stay aligned with OAuth callback (profile flow previously wrote localStorage only).
 */
const TOKEN_KEY = 'token';

export function getAuthToken(): string | null {
  const fromLocal = localStorage.getItem(TOKEN_KEY)?.trim();
  if (fromLocal) {
    return fromLocal;
  }
  const fromSession = sessionStorage.getItem(TOKEN_KEY)?.trim();
  if (fromSession) {
    localStorage.setItem(TOKEN_KEY, fromSession);
    sessionStorage.removeItem(TOKEN_KEY);
    return fromSession;
  }
  return null;
}

export function setAuthToken(token: string): void {
  const t = String(token).trim();
  if (!t) {
    return;
  }
  localStorage.setItem(TOKEN_KEY, t);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
