import { useEffect, useMemo, useState } from 'react';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiIssueStats, ApiIssueSyncResetMode, ApiIssueSyncResetResult, ApiIssueSyncStatus } from '../api/types';
import { useRepo } from '../context/RepoContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';

export function IssueSyncAdminPage() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);
  const { repo } = useRepo();

  const [syncStatus, setSyncStatus] = useState<ApiIssueSyncStatus | null>(null);
  const [stats, setStats] = useState<ApiIssueStats | null>(null);
  const [mode, setMode] = useState<ApiIssueSyncResetMode>('soft');
  const [queueFullSync, setQueueFullSync] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResetResult, setLastResetResult] = useState<ApiIssueSyncResetResult | null>(null);

  const loadStatus = async () => {
    if (!api) return;
    const [statusRes, statsRes] = await Promise.all([
      api.getIssueSyncStatus(repo),
      api.getIssueStats(repo),
    ]);
    setSyncStatus(statusRes);
    setStats(statsRes);
  };

  useEffect(() => {
    if (!api) return;
    setError(null);
    void loadStatus().catch((e: unknown) => {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load sync status';
      setError(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, repo]);

  const handleQueueSync = async (fullSync: boolean) => {
    if (!api) return;
    setIsRunning(true);
    setError(null);
    setSuccess(null);
    try {
      await api.enqueueIssueSync(repo, fullSync);
      setSuccess(fullSync ? 'Full sync queued.' : 'Incremental sync queued.');
      await loadStatus();
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to queue sync';
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleResetAndSync = async () => {
    if (!api) return;
    setIsRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.resetAndQueueIssueSync({
        repoFullName: repo,
        mode,
        queueFullSync,
      });
      setLastResetResult(result);
      setSuccess(
        queueFullSync
          ? `Reset complete (${mode}) and full sync queued.`
          : `Reset complete (${mode}).`
      );
      await loadStatus();
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to reset sync data';
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-gray-900 mb-2">Issue Sync Admin</h1>
          <p className="text-gray-600">
            Re-run issue sync and flush stale issue data when issues are closed, changed, or optimized.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadStatus()} disabled={isRunning || !api}>
          Refresh Status
        </Button>
      </div>

      {!api && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Missing <code>VITE_API_BASE_URL</code>. Configure API base URL to use sync admin actions.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-gray-900">Current Status</h2>
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {repo}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Total Issues</div>
            <div className="text-xl font-semibold text-gray-900">{stats?.totalIssues?.toLocaleString() ?? '-'}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Open Issues</div>
            <div className="text-xl font-semibold text-gray-900">{stats?.openIssues?.toLocaleString() ?? '-'}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Embedded (Open)</div>
            <div className="text-xl font-semibold text-gray-900">{stats?.embeddedOpenIssues?.toLocaleString() ?? '-'}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Last Synced</div>
            <div className="text-sm font-medium text-gray-900">
              {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-gray-900">Quick Sync</h2>
        <p className="text-sm text-gray-600">
          Use this when you only want to re-run sync without deleting current issue data.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void handleQueueSync(false)} disabled={isRunning || !api}>
            Queue Incremental Sync
          </Button>
          <Button onClick={() => void handleQueueSync(true)} disabled={isRunning || !api}>
            Queue Full Sync
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-gray-900">Flush and Rebuild</h2>
        <p className="text-sm text-gray-600">
          Use this when existing issue data is stale and you want to flush original data before rebuilding with fresh sync.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('soft')}
            className={`text-left rounded-lg border p-3 transition-colors ${
              mode === 'soft' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">Soft Reset (Recommended)</div>
            <div className="text-sm text-gray-600 mt-1">
              Keeps issues, clears embeddings/clusters/sync cursor, then rebuilds from latest issue state.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('hard')}
            className={`text-left rounded-lg border p-3 transition-colors ${
              mode === 'hard' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">Hard Reset</div>
            <div className="text-sm text-gray-600 mt-1">
              Deletes issue rows and derived data for this repo, then re-imports everything from GitHub.
            </div>
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Checkbox checked={queueFullSync} onCheckedChange={(v) => setQueueFullSync(Boolean(v))} />
          Queue full sync after reset
        </label>

        <div className="flex items-center gap-3">
          <Button
            variant={mode === 'hard' ? 'destructive' : 'default'}
            onClick={() => void handleResetAndSync()}
            disabled={isRunning || !api}
          >
            {mode === 'hard' ? 'Run Hard Reset' : 'Run Soft Reset'}
          </Button>
          {mode === 'hard' && (
            <span className="text-xs text-red-600">Hard reset deletes issue rows in DB for this repo.</span>
          )}
        </div>
      </Card>

      {lastResetResult && (
        <Card className="p-5 space-y-3">
          <h2 className="text-gray-900">Last Reset Result</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-500">Mode:</span> <span className="text-gray-900">{lastResetResult.mode}</span></div>
            <div><span className="text-gray-500">Queued Full Sync:</span> <span className="text-gray-900">{String(lastResetResult.queuedFullSync)}</span></div>
            <div><span className="text-gray-500">Queue Available:</span> <span className="text-gray-900">{String(lastResetResult.queueAvailable)}</span></div>
            <div><span className="text-gray-500">Cleared Embeddings:</span> <span className="text-gray-900">{lastResetResult.reset.clearedEmbeddings}</span></div>
            <div><span className="text-gray-500">Deleted Cluster Map:</span> <span className="text-gray-900">{lastResetResult.reset.deletedIssueClusterMap}</span></div>
            <div><span className="text-gray-500">Deleted Clusters:</span> <span className="text-gray-900">{lastResetResult.reset.deletedClusters}</span></div>
            <div><span className="text-gray-500">Deleted Products:</span> <span className="text-gray-900">{lastResetResult.reset.deletedIssueProducts}</span></div>
            <div><span className="text-gray-500">Deleted Issues:</span> <span className="text-gray-900">{lastResetResult.reset.deletedIssues}</span></div>
            <div><span className="text-gray-500">Deleted Sync State Rows:</span> <span className="text-gray-900">{lastResetResult.reset.deletedSyncStateRows}</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}
