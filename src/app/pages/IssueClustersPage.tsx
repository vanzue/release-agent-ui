import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { IssueClustersPageSkeleton } from '../components/skeletons/ArtifactSkeletons';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiIssueCluster, ApiIssueProduct, ApiIssueStats, ApiIssueSyncStatus, ApiIssueVersion, ApiTopIssue } from '../api/types';
import { useRepo } from '../context/RepoContext';

const UNVERSIONED = '__unversioned__';
const ALL_VERSIONS = '__all__';
const VERSION_STORAGE_KEY = 'release-agent:selectedVersion';
const PRODUCT_STORAGE_KEY = 'release-agent:selectedProduct';
const CLUSTER_PAGE_LIMIT = 120;

function toSelectValue(v: string | null | undefined) {
  if (v === undefined) return ALL_VERSIONS;
  return v ?? UNVERSIONED;
}

function fromSelectValue(v: string): string | null | undefined {
  if (v === ALL_VERSIONS) return undefined;
  if (v === UNVERSIONED) return null;
  return v;
}

export function IssueClustersPage() {
  const navigate = useNavigate();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const { repo } = useRepo();
  const [versions, setVersions] = useState<ApiIssueVersion[]>([]);
  // undefined = all versions, null = unversioned, string = specific version
  const [selectedVersion, setSelectedVersionState] = useState<string | null | undefined>(() => {
    const stored = localStorage.getItem(VERSION_STORAGE_KEY);
    if (stored === ALL_VERSIONS) return undefined;
    if (stored === UNVERSIONED) return null;
    return stored;
  });
  
  const setSelectedVersion = (v: string | null | undefined) => {
    setSelectedVersionState(v);
    localStorage.setItem(VERSION_STORAGE_KEY, toSelectValue(v));
  };
  const [products, setProducts] = useState<ApiIssueProduct[]>([]);
  const [selectedProduct, setSelectedProductState] = useState<string | null>(() => {
    return localStorage.getItem(PRODUCT_STORAGE_KEY);
  });
  
  const setSelectedProduct = (v: string | null) => {
    setSelectedProductState(v);
    if (v) {
      localStorage.setItem(PRODUCT_STORAGE_KEY, v);
    } else {
      localStorage.removeItem(PRODUCT_STORAGE_KEY);
    }
  };
  const [clusters, setClusters] = useState<ApiIssueCluster[]>([]);
  const [syncStatus, setSyncStatus] = useState<ApiIssueSyncStatus | null>(null);
  const [stats, setStats] = useState<ApiIssueStats | null>(null);
  const [topIssues, setTopIssues] = useState<ApiTopIssue[]>([]);
  const [isTopIssuesLoading, setIsTopIssuesLoading] = useState(false);
  const [isClustersLoading, setIsClustersLoading] = useState(false);
  const [clustersTruncated, setClustersTruncated] = useState(false);
  const [clusterFetchLimit, setClusterFetchLimit] = useState(CLUSTER_PAGE_LIMIT);
  const [versionSearch, setVersionSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threshold, setThreshold] = useState('0.86');
  const [topK, setTopK] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const topIssuesCacheRef = useRef(new Map<string, ApiTopIssue[]>());
  const clustersCacheRef = useRef(
    new Map<string, { clusters: ApiIssueCluster[]; isTruncated: boolean; limit: number }>()
  );
  const topIssuesRequestIdRef = useRef(0);
  const clustersRequestIdRef = useRef(0);

  const loadVersions = async () => {
    if (!api) return;
    const res = await api.listIssueVersions(repo);
    setVersions(res.versions ?? []);
    // Only set default if no stored value
    const stored = localStorage.getItem(VERSION_STORAGE_KEY);
    if (!stored) {
      setSelectedVersion(res.defaultTargetVersion ?? res.versions?.[0]?.targetVersion ?? null);
    }
  };

  const loadProducts = async (version: string | null | undefined) => {
    if (!api) return;
    const res = await api.listIssueProducts(repo, version);
    setProducts(res.products ?? []);
    // Use stored product if it exists in the list, otherwise use first product
    const storedProduct = localStorage.getItem(PRODUCT_STORAGE_KEY);
    const productExists = res.products?.some(p => p.productLabel === storedProduct);
    if (storedProduct && productExists) {
      setSelectedProduct(storedProduct);
    } else {
      setSelectedProduct(res.products?.[0]?.productLabel ?? null);
    }
  };

  const loadClusters = async (_version: string | null | undefined, productLabel: string | null) => {
    if (!api || !productLabel) {
      setClusters([]);
      setClustersTruncated(false);
      return;
    }

    const key = `${repo}|${_version ?? '__all__'}|${productLabel}`;
    const cached = clustersCacheRef.current.get(key);
    if (cached) {
      setClusters(cached.clusters);
      setClustersTruncated(cached.isTruncated);
      setClusterFetchLimit(cached.limit);
    }

    const requestId = ++clustersRequestIdRef.current;
    if (!cached) setIsClustersLoading(true);

    try {
      const res = await api.listIssueClusters(repo, productLabel, null, CLUSTER_PAGE_LIMIT);
      if (requestId !== clustersRequestIdRef.current) return;

      const nextClusters = res.clusters ?? [];
      const nextIsTruncated = Boolean(res.isTruncated);
      const nextLimit = res.limit ?? CLUSTER_PAGE_LIMIT;

      setClusters(nextClusters);
      setClustersTruncated(nextIsTruncated);
      setClusterFetchLimit(nextLimit);
      clustersCacheRef.current.set(key, {
        clusters: nextClusters,
        isTruncated: nextIsTruncated,
        limit: nextLimit,
      });
    } catch (e: unknown) {
      if (requestId !== clustersRequestIdRef.current) return;
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load clusters';
      setError(message);
    } finally {
      if (requestId === clustersRequestIdRef.current) {
        setIsClustersLoading(false);
      }
    }
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

  const loadTopIssues = async (version: string | null | undefined, productLabel: string | null) => {
    if (!api) return;

    const key = `${repo}|${version ?? '__all__'}|${productLabel ?? '__all__'}`;
    const cached = topIssuesCacheRef.current.get(key);
    if (cached) {
      setTopIssues(cached);
    }

    const requestId = ++topIssuesRequestIdRef.current;
    if (!cached) setIsTopIssuesLoading(true);

    try {
      const res = await api.getTopIssuesByReactions(repo, version, productLabel ?? undefined, 20);
      if (requestId !== topIssuesRequestIdRef.current) return;
      const nextIssues = res.issues ?? [];
      setTopIssues(nextIssues);
      topIssuesCacheRef.current.set(key, nextIssues);
    } catch (e: unknown) {
      if (requestId !== topIssuesRequestIdRef.current) return;
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load top issues';
      setError(message);
    } finally {
      if (requestId === topIssuesRequestIdRef.current) {
        setIsTopIssuesLoading(false);
      }
    }
  };

  const filteredVersions = useMemo(() => {
    if (!versionSearch.trim()) return versions;
    const search = versionSearch.toLowerCase();
    return versions.filter(v => 
      (v.targetVersion ?? 'unversioned').toLowerCase().includes(search)
    );
  }, [versions, versionSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p => 
      p.productLabel.toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  useEffect(() => {
    if (!api) return;
    topIssuesCacheRef.current.clear();
    clustersCacheRef.current.clear();
    setTopIssues([]);
    setClusters([]);
    setClustersTruncated(false);
    setClusterFetchLimit(CLUSTER_PAGE_LIMIT);
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        await Promise.all([loadVersions(), loadSyncStatus(), loadStats()]);
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
    void loadTopIssues(selectedVersion, selectedProduct);
    void loadClusters(selectedVersion, selectedProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selectedVersion, selectedProduct]);

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

  // Show skeleton on initial load
  if (isLoading && versions.length === 0 && products.length === 0) {
    return <IssueClustersPageSkeleton />;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Issue Clusters</h1>
          <p className="text-gray-600">Browse PowerToys issues by product, version, and cluster popularity.</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Compact sync status */}
          <div className="text-xs text-gray-500 text-right">
            {stats && (
              <div className="flex items-center gap-3">
                <span>{stats.totalIssues.toLocaleString()} issues</span>
                <span className="text-gray-300">|</span>
                <span>{stats.embeddedOpenIssues.toLocaleString()} / {stats.openIssues.toLocaleString()} embedded</span>
                {syncStatus?.lastSyncedAt && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>Synced {new Date(syncStatus.lastSyncedAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleSync}>Sync</Button>
          <Button size="sm" className="bg-gray-900 text-white hover:bg-gray-800" onClick={handleRecluster} disabled={!selectedProduct}>
            Recluster
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
        <div className="min-w-[200px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Version</div>
          <Select value={toSelectValue(selectedVersion)} onValueChange={(v) => setSelectedVersion(fromSelectValue(v))}>
            <SelectTrigger>
              <SelectValue placeholder="All Versions" />
            </SelectTrigger>
            <SelectContent className="overflow-hidden">
              <div className="px-2 py-2 border-b border-gray-100 bg-white">
                <Input
                  placeholder="Search versions..."
                  value={versionSearch}
                  onChange={(e) => setVersionSearch(e.target.value)}
                  className="h-8"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                <SelectItem value={ALL_VERSIONS}>-- All Versions --</SelectItem>
                {filteredVersions.map((v) => (
                  <SelectItem key={toSelectValue(v.targetVersion)} value={toSelectValue(v.targetVersion)}>
                    {v.targetVersion ?? 'Unversioned'} ({v.issueCount})
                  </SelectItem>
                ))}
                {filteredVersions.length === 0 && (
                  <div className="px-2 py-2 text-sm text-gray-500">No matching versions</div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[240px]">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Product</div>
          <Select value={selectedProduct ?? ''} onValueChange={(v) => setSelectedProduct(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Product" />
            </SelectTrigger>
            <SelectContent className="overflow-hidden max-w-[300px]">
              <div className="px-2 py-2 border-b border-gray-100 bg-white">
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="h-8"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {filteredProducts.map((p) => (
                  <SelectItem key={p.productLabel} value={p.productLabel} className="max-w-[280px]">
                    <span className="truncate block">{p.productLabel} ({p.issueCount})</span>
                  </SelectItem>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="px-2 py-2 text-sm text-gray-500">No matching products</div>
                )}
              </div>
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
        </div>
      </Card>

      {/* Top Issues - horizontal scrollable cards */}
      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900">Top Issues</h2>
            <p className="text-gray-500 text-sm">By reactions ({selectedVersion ?? 'Latest'})</p>
          </div>
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {isTopIssuesLoading ? 'Loading...' : `${topIssues.length} issues`}
          </Badge>
        </div>
        <div className="p-4 overflow-x-auto">
          {isTopIssuesLoading && topIssues.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-4">
              Loading top issues...
            </div>
          ) : null}
          {topIssues.length > 0 ? (
            <div className="flex gap-3">
              {topIssues.map((issue) => (
                <a
                  key={issue.issueNumber}
                  className="flex-shrink-0 w-64 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  href={`https://github.com/${repo}/issues/${issue.issueNumber}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="text-sm text-gray-900 line-clamp-2 mb-2 h-10">{issue.title}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="text-blue-600">#{issue.issueNumber}</span>
                    <span>👍 {issue.reactionsCount}</span>
                    <span>💬 {issue.commentsCount}</span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 text-sm py-4">
              No issues found for this version.
            </div>
          )}
        </div>
      </Card>

      {/* Clusters */}
      <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-gray-900">Clusters</h2>
              <p className="text-gray-500 text-sm">
                Ordered by popularity
                {clustersTruncated ? ` (showing first ${clusterFetchLimit})` : ''}
              </p>
            </div>
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              {isClustersLoading ? 'Loading...' : `${clusters.length} clusters`}
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
              {isClustersLoading && clusters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-10">
                    Loading clusters...
                  </TableCell>
                </TableRow>
              )}
              {clusters.map((cluster) => (
                <TableRow
                  key={cluster.clusterId}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    const params = new URLSearchParams({
                      product: selectedProduct ?? '',
                      title: cluster.representativeTitle ?? '',
                      issue: String(cluster.representativeIssueNumber ?? ''),
                      size: String(cluster.size),
                      popularity: String(cluster.popularity),
                    });
                    navigate(`/issues/clusters/${cluster.clusterId}?${params.toString()}`);
                  }}
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
    </div>
  );
}
