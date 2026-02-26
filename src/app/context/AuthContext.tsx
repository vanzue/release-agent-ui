import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { requestJson } from '../api/client';
import { clearStoredGithubToken, getStoredGithubToken, setStoredGithubToken } from '../auth/tokenStorage';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthUser = {
  login: string;
  source: 'community-md' | 'extra-allowlist' | 'access-control-disabled';
};

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getApiBaseUrl(): string | null {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return apiBaseUrl && apiBaseUrl.length > 0 ? apiBaseUrl : null;
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

  const signIn = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed) {
        throw new Error('Token is required');
      }

      const nextUser = await verifyToken(trimmed);
      setStoredGithubToken(trimmed);
      setUser(nextUser);
      setStatus('authenticated');
      setError(null);
    },
    [verifyToken]
  );

  const signOut = useCallback(() => {
    clearStoredGithubToken();
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

      const token = getStoredGithubToken();
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
          // Ignore and continue to normal unauthenticated state.
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
        clearStoredGithubToken();
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
      signIn,
      signOut,
    }),
    [status, user, error, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
