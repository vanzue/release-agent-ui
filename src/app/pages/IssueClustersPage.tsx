import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiIssueCluster, ApiIssueProduct, ApiIssueStats, ApiIssueSyncStatus, ApiIssueVersion } from '../api/types';

const UNVERSIONED = '__unversioned__';

function toSelectValue(v: string | null) {
  return v ?? UNVERSIONED;
}

function fromSelectValue(v: string) {
  return v === UNVERSIONED ? null : v;
}

export function IssueClustersPage() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [repo, setRepo] = useState('microsoft/PowerToys');
  const [versions, setVersions] = useState<ApiIssueVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [products, setProducts] = useState<ApiIssueProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ApiIssueCluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [clusterIssues, setClusterIssues] = useState<Array<{
    issueNumber: number;
    title: string;
    state: 'open' | 'closed';
    updatedAt: string;
    similarity: number;
  }>>([]);
  const [syncStatus, setSyncStatus] = useState<ApiIssueSyncStatus | null>(null);
  const [stats, setStats] = useState<ApiIssueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [threshold, setThreshold] = useState('0.86');
  const [topK, setTopK] = useState('10');
  const [error, setError] = useState<string | null>(null);

  const loadVersions = async () => {
    if (!api) return;
    const res = await api.listIssueVersions(repo);
    setVersions(res.versions ?? []);
    setSelectedVersion(res.defaultTargetVersion ?? res.versions?.[0]?.targetVersion ?? null);
  };

  const loadProducts = async (version: string | null) => {
    if (!api) return;
    const res = await api.listIssueProducts(repo, version);
    setProducts(res.products ?? []);
    setSelectedProduct(res.products?.[0]?.productLabel ?? null);
  };

  const loadClusters = async (_version: string | null, productLabel: string | null) => {
    if (!api || !productLabel) {
      setClusters([]);
      return;
    }
    const res = await api.listIssueClusters(repo, productLabel, null);
    setClusters(res.clusters ?? []);
    setSelectedClusterId(res.clusters?.[0]?.clusterId ?? null);
  };

  const loadClusterDetails = async (clusterId: string | null) => {
    if (!api || !clusterId) {
      setClusterIssues([]);
      return;
    }
    const res = await api.getIssueCluster(repo, clusterId);
    setClusterIssues(res.issues ?? []);
  };

  const loadSyncStatus = async () => {
    if (!api) return;
    const res = await api.getIssueSyncStatus(repo);
    setSyncStatus(res);
  };

  const loadStats = async () => {
    if (!api) return;
    const res = await api.getIssueStats(repo);
    setStats(res);
  };

  useEffect(() => {
    if (!api) return;
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        await loadVersions();
        await loadSyncStatus();
        await loadStats();
      } catch (e: unknown) {
        const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    })();
    const interval = setInterval(() => {
      void loadSyncStatus();
      void loadStats();
    }, 5_000);
    return () => clearInterval(interval);
  }, [api, repo]);

  useEffect(() => {
    if (!api) return;
    void (async () => {
      await loadProducts(selectedVersion);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selectedVersion]);

  useEffect(() => {
    if (!api) return;
    void (async () => {
      await loadClusters(selectedVersion, selectedProduct);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selectedVersion, selectedProduct]);

  useEffect(() => {
    if (!api) return;
    void (async () => {
      await loadClusterDetails(selectedClusterId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selectedClusterId]);

  const handleSync = async () => {
    if (!api) return;
    setError(null);
    try {
      await api.enqueueIssueSync(repo, false);
      await loadSyncStatus();
      await loadStats();
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Sync failed';
      setError(message);
    }
  };

  const handleRecluster = async () => {
    if (!api || !selectedProduct) return;
    setError(null);
    try {
      await api.enqueueIssueRecluster({
        repoFullName: repo,
        targetVersion: selectedVersion ?? null,
        productLabel: selectedProduct,
        threshold: Number.parseFloat(threshold),
        topK: Number.parseInt(topK, 10),
      });
      await loadSyncStatus();
      await loadStats();
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Recluster failed';
      setError(message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Issue Clusters</h1>
          <p className="text-gray-600">Browse PowerToys issues by product, version, and cluster popularity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync}>Sync Issues</Button>
          <Button className="bg-gray-900 text-white hover:bg-gray-800" onClick={handleRecluster} disabled={!selectedProduct}>
            Recluster
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-[260px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Repo</div>
          <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" />
        </div>

        <div className="min-w-[200px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Version</div>
          <Select value={toSelectValue(selectedVersion)} onValueChange={(v) => setSelectedVersion(fromSelectValue(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Latest Version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={toSelectValue(v.targetVersion)} value={toSelectValue(v.targetVersion)}>
                  {v.targetVersion ?? 'Unversioned'} ({v.issueCount})
                </SelectItem>
              ))}
              {versions.length === 0 && (
                <SelectItem value={UNVERSIONED}>Unversioned</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[240px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Product</div>
          <Select value={selectedProduct ?? ''} onValueChange={(v) => setSelectedProduct(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.productLabel} value={p.productLabel}>
                  {p.productLabel} ({p.issueCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[120px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Threshold</div>
          <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>

        <div className="min-w-[120px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top K</div>
          <Input value={topK} onChange={(e) => setTopK(e.target.value)} />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-gray-900">Clusters</h2>
              <p className="text-gray-500 text-sm">Ordered by popularity</p>
            </div>
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              {clusters.length} clusters
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Representative</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-28">Popularity</TableHead>
                <TableHead className="w-40">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.map((cluster) => (
                <TableRow
                  key={cluster.clusterId}
                  className={cluster.clusterId === selectedClusterId ? 'bg-gray-50' : 'cursor-pointer hover:bg-gray-50'}
                  onClick={() => setSelectedClusterId(cluster.clusterId)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm text-gray-900">
                        {cluster.representativeTitle ?? 'Untitled cluster'}
                      </div>
                      {cluster.representativeIssueNumber && (
                        <div className="text-xs text-gray-500">#{cluster.representativeIssueNumber}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{cluster.size}</TableCell>
                  <TableCell>{cluster.popularity.toFixed(2)}</TableCell>
                  <TableCell>{new Date(cluster.updatedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {clusters.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-10">
                    No clusters available for this product/version.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-gray-900">Sync Status</h2>
            <p className="text-gray-500 text-sm">Issue synchronization progress</p>
          </div>
          <div className="p-4 space-y-3">
            {syncStatus && (
              <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-900">
                    {syncStatus.isSyncing ? 'Syncing...' : 'Idle'}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {syncStatus.isSyncing ? 'running' : 'completed'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {syncStatus.currentCount.toLocaleString()} issues
                  {syncStatus.estimatedTotal && ` / ~${syncStatus.estimatedTotal.toLocaleString()} estimated`}
                </div>
                {syncStatus.isSyncing && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{syncStatus.progress}%</span>
                    </div>
                    <Progress value={syncStatus.progress} className="h-2" />
                  </div>
                )}
                {syncStatus.lastSyncedAt && (
                  <div className="text-xs text-gray-400 mt-2">
                    Last synced: {new Date(syncStatus.lastSyncedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}
            {stats && (
              <div className="p-3 rounded-lg border border-gray-200 bg-white">
                <div className="text-xs text-gray-500">Indexed issues</div>
                <div className="text-lg text-gray-900 font-semibold">{stats.totalIssues}</div>
                <div className="mt-2 text-xs text-gray-500">Embedded open issues</div>
                <div className="text-lg text-gray-900 font-semibold">
                  {stats.embeddedOpenIssues} / {stats.openIssues}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900">Cluster Issues</h2>
            <p className="text-gray-500 text-sm">Ranked by similarity</p>
          </div>
          {selectedClusterId && (
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              {clusterIssues.length} issues
            </Badge>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue</TableHead>
              <TableHead className="w-24">State</TableHead>
              <TableHead className="w-28">Similarity</TableHead>
              <TableHead className="w-40">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clusterIssues.map((issue) => (
              <TableRow key={issue.issueNumber}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-900">{issue.title}</div>
                    <a
                      className="text-xs text-blue-600 hover:underline"
                      href={`https://github.com/${repo}/issues/${issue.issueNumber}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{issue.issueNumber}
                    </a>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{issue.state}</TableCell>
                <TableCell>{issue.similarity.toFixed(3)}</TableCell>
                <TableCell>{new Date(issue.updatedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {clusterIssues.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  Select a cluster to view its issues.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
