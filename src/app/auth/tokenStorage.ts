const GITHUB_TOKEN_KEY = 'release-agent.github-token';

export function getStoredGithubToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = window.localStorage.getItem(GITHUB_TOKEN_KEY);
  return token && token.trim().length > 0 ? token.trim() : null;
}

export function setStoredGithubToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GITHUB_TOKEN_KEY, token.trim());
}

export function clearStoredGithubToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GITHUB_TOKEN_KEY);
}

