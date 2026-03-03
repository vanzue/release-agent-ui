import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiIssueDashboardResponse, ApiIssueSyncStatus, ApiIssueStats } from '../api/types';
import { useRepo } from '../context/RepoContext';

const DASHBOARD_REFRESH_MS = 60_000;
const SYNC_STATUS_POLL_MS = 30_000;
const STALE_THRESHOLD_MS = 10 * 60_000;

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DashboardPage() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);
  const { repo } = useRepo();

  const [dashboard, setDashboard] = useState<ApiIssueDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<ApiIssueSyncStatus | null>(null);
  const [stats, setStats] = useState<ApiIssueStats | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick every 10s to keep relative timestamps current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!api) return;
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const response = await api.getIssueDashboard(repo, {
        semanticLimit: 6,
        issuesPerSemantic: 8,
        minSimilarity: 0.84,
      });
      setDashboard(response);
      if (!silent) setError(null);
    } catch (e: unknown) {
      if (!silent) {
        const message =
          e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load dashboard';
        setError(message);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [api, repo]);

  const loadSyncStatus = useCallback(async () => {
    if (!api) return;
    try {
      const [status, issueStats] = await Promise.all([
        api.getIssueSyncStatus(repo),
        api.getIssueStats(repo),
      ]);
      setSyncStatus(status);
      setStats(issueStats);
    } catch {
      // Sync status is non-critical; silently ignore errors
    }
  }, [api, repo]);

  // Initial load
  useEffect(() => {
    void loadDashboard();
    void loadSyncStatus();
  }, [loadDashboard, loadSyncStatus]);

  // Auto-refresh dashboard every 60s (silent)
  useEffect(() => {
    const id = setInterval(() => void loadDashboard(true), DASHBOARD_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadDashboard]);

  // Poll sync status every 30s
  useEffect(() => {
    const id = setInterval(() => void loadSyncStatus(), SYNC_STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [loadSyncStatus]);

  const isStale = syncStatus?.lastSyncedAt
    ? Date.now() - new Date(syncStatus.lastSyncedAt).getTime() > STALE_THRESHOLD_MS
    : false;
  const neverSynced = syncStatus !== null && syncStatus.lastSyncedAt === null;

  // Force re-evaluation of timeAgo by reading `now`
  void now;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Issue Semantic Dashboard</h1>
          <p className="text-gray-600">Latest release hotspots grouped by semantic similarity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { void loadDashboard(); void loadSyncStatus(); }} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Link to="/issues">
            <Button className="bg-gray-900 text-white hover:bg-gray-800">Open Clusters</Button>
          </Link>
        </div>
      </div>

      {/* Sync status bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {syncStatus && (
          <Badge variant="outline" className={
            neverSynced
              ? 'bg-red-50 text-red-700 border-red-200'
              : isStale
                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                : 'bg-green-50 text-green-700 border-green-200'
          }>
            {neverSynced ? '⚠ Never synced' : isStale ? `⚠ Synced ${timeAgo(syncStatus.lastSyncedAt)}` : `Synced ${timeAgo(syncStatus.lastSyncedAt)}`}
          </Badge>
        )}
        {stats && (
          <>
            <Badge variant="outline" className="bg-gray-50 border-gray-200">
              {stats.totalIssues.toLocaleString()} issues
            </Badge>
            <Badge variant="outline" className="bg-gray-50 border-gray-200">
              {stats.openIssues.toLocaleString()} open
            </Badge>
            <Badge variant="outline" className="bg-gray-50 border-gray-200">
              {stats.embeddedOpenIssues.toLocaleString()} embedded
            </Badge>
          </>
        )}
        {dashboard?.generatedAt && (
          <Badge variant="outline" className="bg-gray-50 border-gray-200">
            Dashboard computed {timeAgo(dashboard.generatedAt)}
          </Badge>
        )}
        <span className="text-xs text-gray-400 ml-auto">Auto-refreshes every 60s</span>
      </div>

      {neverSynced && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          No issues have been synced yet. Go to the <Link to="/issues/admin" className="underline font-medium">sync admin page</Link> to start an issue sync.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="bg-gray-50 border-gray-200">
            Repo: {repo}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Latest version: {dashboard?.latestRelease.version ?? 'N/A'}
          </Badge>
          {dashboard?.latestRelease.tag && (
            <Badge variant="outline" className="bg-gray-50 border-gray-200">
              Tag: {dashboard.latestRelease.tag}
            </Badge>
          )}
          {dashboard?.latestRelease.publishedAt && (
            <Badge variant="outline" className="bg-gray-50 border-gray-200">
              Published: {new Date(dashboard.latestRelease.publishedAt).toLocaleDateString()}
            </Badge>
          )}
          <Badge variant="outline" className="bg-gray-50 border-gray-200">
            Source: {dashboard?.latestRelease.source ?? 'none'}
          </Badge>
          {dashboard?.latestRelease.url && (
            <a
              href={dashboard.latestRelease.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              View release
            </a>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900">Hottest Issue</h2>
            <p className="text-gray-500 text-sm">Most active issue in latest release scope.</p>
          </div>
          {dashboard?.hottestIssue && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Score {dashboard.hottestIssue.hotScore.toFixed(2)}
            </Badge>
          )}
        </div>

        {dashboard?.hottestIssue ? (
          <div className="mt-4 space-y-2">
            <a
              href={`https://github.com/${repo}/issues/${dashboard.hottestIssue.issueNumber}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline"
            >
              #{dashboard.hottestIssue.issueNumber} {dashboard.hottestIssue.title}
            </a>
            <div className="text-sm text-gray-600">
              {dashboard.hottestIssue.state} | reactions {dashboard.hottestIssue.reactionsCount} | comments {dashboard.hottestIssue.commentsCount} | Updated{' '}
              {new Date(dashboard.hottestIssue.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-gray-500">No hottest issue found for latest release.</div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(dashboard?.semanticGroups ?? []).map((group) => (
          <Card key={group.semanticId} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm text-gray-500">Semantic Group</div>
                <a
                  href={`https://github.com/${repo}/issues/${group.representativeIssueNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-900 hover:text-blue-700"
                >
                  #{group.representativeIssueNumber} {group.representativeTitle}
                </a>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-gray-900">{group.issueCount}</div>
                <div className="text-xs text-gray-500">issues</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                Open {group.openIssueCount}/{group.issueCount}
              </Badge>
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                Hot {group.hotScore.toFixed(2)}
              </Badge>
              {group.productLabel && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {group.productLabel}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {group.issues.map((issue) => (
                <a
                  key={issue.issueNumber}
                  href={`https://github.com/${repo}/issues/${issue.issueNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-gray-200 p-3 hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="text-sm text-gray-900 truncate">
                    #{issue.issueNumber} {issue.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {issue.state} | sim {(issue.similarity * 100).toFixed(1)}% | reactions {issue.reactionsCount} | comments {issue.commentsCount}
                  </div>
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {dashboard && dashboard.semanticGroups.length === 0 && !isLoading && (
        <Card className="p-8 text-center text-gray-500">
          No semantic groups found for latest release. Run issue sync/embedding and try again.
        </Card>
      )}
    </div>
  );
}
