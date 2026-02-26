import { useState, type FormEvent, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuth } from '../../context/AuthContext';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, error, signIn } = useAuth();
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mergedError = formError ?? error;

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await signIn(token);
      setToken('');
    } catch (err: any) {
      setFormError(err?.message ?? 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-600">Verifying access...</div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return <>{children}</>;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <form
        onSubmit={(e) => void handleSignIn(e)}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Community Access Required</h1>
            <p className="text-sm text-slate-600">
              Sign in with a GitHub token from a user listed in PowerToys COMMUNITY.md.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="github-token">
            GitHub Personal Access Token
          </label>
          <Input
            id="github-token"
            type="password"
            autoComplete="off"
            placeholder="github_pat_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={submitting}
          />
        </div>

        {mergedError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{mergedError}</div>
        )}

        <Button type="submit" className="w-full" disabled={submitting || token.trim().length === 0}>
          {submitting ? 'Verifying...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
