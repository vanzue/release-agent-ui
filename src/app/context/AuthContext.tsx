import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { requestJson } from '../api/client';
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from '../auth/tokenStorage';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthUser = {
  login: string;
  source: 'community-md' | 'extra-allowlist' | 'access-control-disabled';
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  signInWithGithub: () => void;
  signOut: () => void;
};

type AuthCacheEntry = {
  token: string;
  user: AuthUser;
  checkedAt: number;
};

const AUTH_CACHE_KEY = 'release-agent.auth-user-cache';
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | null>(null);

function getApiBaseUrl(): string | null {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return apiBaseUrl && apiBaseUrl.length > 0 ? apiBaseUrl : null;
}

function clearOAuthHashFragment(): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', cleanUrl);
}

function readOAuthFragment(): { token: string | null; error: string | null } {
  if (typeof window === 'undefined') return { token: null, error: null };
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return { token: null, error: null };
  const params = new URLSearchParams(hash);
  return {
    token: params.get('ra_token'),
    error: params.get('ra_error'),
  };
}

function readAuthCache(token: string): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthCacheEntry;
    if (!parsed || parsed.token !== token) return null;
    if (typeof parsed.checkedAt !== 'number') return null;
    if (Date.now() - parsed.checkedAt > AUTH_CACHE_TTL_MS) return null;
    if (!parsed.user || typeof parsed.user.login !== 'string' || typeof parsed.user.source !== 'string') return null;
    return parsed.user;
  } catch {
    return null;
  }
}

function writeAuthCache(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  const entry: AuthCacheEntry = {
    token,
    user,
    checkedAt: Date.now(),
  };
  window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(entry));
}

function clearAuthCache(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_CACHE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyToken = useCallback(async (token: string): Promise<AuthUser> => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      throw new Error('Missing VITE_API_BASE_URL');
    }

    return requestJson<AuthUser>(apiBaseUrl, '/auth/me', {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  }, []);

  const signInWithGithub = useCallback(() => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      setError('Missing VITE_API_BASE_URL');
      return;
    }
    if (typeof window === 'undefined') return;

    const returnTo = `${window.location.pathname}${window.location.search}`;
    const redirect = new URL('/auth/github/start', apiBaseUrl);
    redirect.searchParams.set('returnTo', returnTo);
    window.location.assign(redirect.toString());
  }, []);

  const signOut = useCallback(() => {
    clearStoredAuthToken();
    clearAuthCache();
    setUser(null);
    setStatus('unauthenticated');
    setError(null);
  }, []);

  useEffect(() => {
    const boot = async () => {
      const apiBaseUrl = getApiBaseUrl();
      if (!apiBaseUrl) {
        setStatus('unauthenticated');
        setError('Missing VITE_API_BASE_URL');
        return;
      }

      const oauth = readOAuthFragment();
      if (oauth.token && oauth.token.trim()) {
        setStoredAuthToken(oauth.token.trim());
        clearOAuthHashFragment();
      }
      if (oauth.error) {
        clearOAuthHashFragment();
        setError(oauth.error);
      }

      const token = getStoredAuthToken();
      if (!token) {
        // Default fast path: when no token, go directly to unauthenticated.
        // Optional probe can be enabled for environments that rely on access-control-disabled mode.
        const probeAccessDisabled =
          String((import.meta.env.VITE_AUTH_PROBE_ACCESS_DISABLED as string | undefined) ?? 'false').toLowerCase() ===
          'true';

        if (probeAccessDisabled) {
          try {
            const me = await requestJson<AuthUser>(apiBaseUrl, '/auth/me');
            if (me.source === 'access-control-disabled') {
              setUser(me);
              setStatus('authenticated');
              setError(null);
              return;
            }
          } catch {
            // Access control is enabled.
          }
        }

        setStatus('unauthenticated');
        return;
      }

      const cachedUser = readAuthCache(token);
      if (cachedUser) {
        setUser(cachedUser);
        setStatus('authenticated');
      }

      try {
        const me = await verifyToken(token);
        writeAuthCache(token, me);
        setUser(me);
        setStatus('authenticated');
        setError(null);
      } catch (e: any) {
        clearStoredAuthToken();
        clearAuthCache();
        setUser(null);
        setStatus('unauthenticated');
        setError(e?.message ?? 'Authentication failed');
      }
    };

    void boot();
  }, [verifyToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      signInWithGithub,
      signOut,
    }),
    [status, user, error, signInWithGithub, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
