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
        try {
          const me = await requestJson<AuthUser>(apiBaseUrl, '/auth/me');
          if (me.source === 'access-control-disabled') {
            setUser(me);
            setStatus('authenticated');
            setError(null);
            return;
          }
        } catch {
          // No token and access control enabled.
        }
        setStatus('unauthenticated');
        return;
      }

      try {
        const me = await verifyToken(token);
        setUser(me);
        setStatus('authenticated');
        setError(null);
      } catch (e: any) {
        clearStoredAuthToken();
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

