const AUTH_TOKEN_KEY = 'release-agent.auth-token';
const LEGACY_GITHUB_TOKEN_KEY = 'release-agent.github-token';

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token =
    window.localStorage.getItem(AUTH_TOKEN_KEY) ??
    window.localStorage.getItem(LEGACY_GITHUB_TOKEN_KEY);
  if (!token || token.trim().length === 0) return null;
  return token.trim();
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
  window.localStorage.removeItem(LEGACY_GITHUB_TOKEN_KEY);
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_GITHUB_TOKEN_KEY);
}
