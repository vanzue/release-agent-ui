import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiIssueProduct, ApiIssueReclusterScopeResponse, ApiIssueVersion } from '../api/types';
import { useRepo } from '../context/RepoContext';

const UNVERSIONED = '__unversioned__';
const ALL_VERSIONS = '__all__';
const API_UNVERSIONED = '__null__';
const VERSION_STORAGE_KEY = 'release-agent:selectedVersion';
const PRODUCT_STORAGE_KEY = 'release-agent:selectedProduct';

function toSelectValue(v: string | null | undefined) {
  if (v === undefined) return ALL_VERSIONS;
  return v ?? UNVERSIONED;
}

function fromSelectValue(v: string): string | null | undefined {
  if (v === ALL_VERSIONS) return undefined;
  if (v === UNVERSIONED || v === API_UNVERSIONED) return null;
  return v;
}

function toReclusterTargetVersionToken(v: string | null | undefined): string {
  if (v === undefined) return ALL_VERSIONS;
  if (v === null) return API_UNVERSIONED;
  return v;
}

function formatVersionLabel(v: string | null | undefined) {
  if (v === undefined) return 'All Versions';
  if (v === null) return 'Unversioned';
  return v;
}

export function IssueReclusterFlowPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);
  const { repo } = useRepo();

  const [versions, setVersions] = useState<ApiIssueVersion[]>([]);
  const [products, setProducts] = useState<ApiIssueProduct[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null | undefined>(() =>
    fromSelectValue(searchParams.get('version') ?? ALL_VERSIONS)
  );
  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => searchParams.get('product')?.trim() || null);
  const [threshold, setThreshold] = useState('0.86');
  const [topK, setTopK] = useState('10');
  const [scope, setScope] = useState<ApiIssueReclusterScopeResponse | null>(null);
  const [isLoadingScope, setIsLoadingScope] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const unversionedIssueCount = versions.find((v) => v.targetVersion === null)?.issueCount ?? 0;

  const loadVersions = async () => {
    if (!api) return;
    const res = await api.listIssueVersions(repo);
    setVersions(res.versions ?? []);
    if (selectedVersion === undefined && res.defaultTargetVersion) {
      setSelectedVersion(res.defaultTargetVersion);
    }
  };

  const loadProducts = async (version: string | null | undefined) => {
    if (!api) return;
    const res = await api.listIssueProducts(repo, version);
    const list = res.products ?? [];
    setProducts(list);
    if (selectedProduct && list.some((p) => p.productLabel === selectedProduct)) return;
    setSelectedProduct(list[0]?.productLabel ?? null);
  };

  const loadScope = async (productLabel: string | null, version: string | null | undefined) => {
    if (!api || !productLabel) {
      setScope(null);
      return;
    }
    setIsLoadingScope(true);
    try {
      const res = await api.getIssueReclusterScope(repo, productLabel, version);
      setScope(res);
    } finally {
      setIsLoadingScope(false);
    }
  };

  useEffect(() => {
    if (!api) return;
    void loadVersions().catch((e: unknown) => {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load versions';
      setError(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, repo]);

  useEffect(() => {
    if (!api) return;
    void loadProducts(selectedVersion).catch((e: unknown) => {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load products';
      setError(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, repo, selectedVersion]);

  useEffect(() => {
    if (!api) return;
    void loadScope(selectedProduct, selectedVersion).catch((e: unknown) => {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load clustering scope';
      setError(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, repo, selectedProduct, selectedVersion]);

  const handleQueueRecluster = async () => {
    if (!api || !selectedProduct) return;
    setError(null);
    setQueuedMessage(null);
    setIsSubmitting(true);
    try {
      await api.enqueueIssueRecluster({
        repoFullName: repo,
        targetVersion: toReclusterTargetVersionToken(selectedVersion),
        productLabel: selectedProduct,
        threshold: Number.parseFloat(threshold),
        topK: Number.parseInt(topK, 10),
      });
      setQueuedMessage(
        `Queued recluster for ${selectedProduct} (${formatVersionLabel(selectedVersion)}). Refresh clusters in a few seconds.`
      );
      await loadScope(selectedProduct, selectedVersion);
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to queue recluster';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBackToClusters = () => {
    localStorage.setItem(VERSION_STORAGE_KEY, toSelectValue(selectedVersion));
    if (selectedProduct) {
      localStorage.setItem(PRODUCT_STORAGE_KEY, selectedProduct);
    } else {
      localStorage.removeItem(PRODUCT_STORAGE_KEY);
    }
    navigate('/issues');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Run Clustering Flow</h1>
          <p className="text-gray-600">Queue reclustering using the current Issues page context.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/issues">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            className="bg-gray-900 text-white hover:bg-gray-800"
            onClick={handleQueueRecluster}
            disabled={!selectedProduct || isSubmitting || (scope?.openEmbeddedIssueCount ?? 0) === 0}
          >
            {isSubmitting ? 'Queueing...' : 'Queue Reclustering'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {queuedMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {queuedMessage}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-[220px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Version Context</div>
            <Select value={toSelectValue(selectedVersion)} onValueChange={(v) => setSelectedVersion(fromSelectValue(v))}>
              <SelectTrigger>
                <SelectValue placeholder="All Versions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VERSIONS}>All Versions</SelectItem>
                <SelectItem value={UNVERSIONED}>Unversioned ({unversionedIssueCount})</SelectItem>
                {versions.filter((v) => v.targetVersion !== null).map((v) => (
                  <SelectItem key={v.targetVersion ?? ''} value={v.targetVersion ?? ''}>
                    {v.targetVersion} ({v.issueCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[260px]">
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

          <div className="min-w-[140px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Threshold</div>
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>

          <div className="min-w-[120px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top K</div>
            <Input value={topK} onChange={(e) => setTopK(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900">Scope Preview</h2>
          <Badge variant="outline" className="bg-gray-50 border-gray-200">
            {isLoadingScope ? 'Loading...' : `${formatVersionLabel(selectedVersion)} / ${selectedProduct ?? 'No Product'}`}
          </Badge>
        </div>
        {scope ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-gray-500">Open issues in scope</div>
              <div className="text-gray-900 mt-1">{scope.openIssueCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-gray-500">Embeddable open issues (current model)</div>
              <div className="text-gray-900 mt-1">{scope.openEmbeddedIssueCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-gray-500">Existing clusters in this scope</div>
              <div className="text-gray-900 mt-1">{scope.existingClusterCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-gray-500">Currently mapped issues</div>
              <div className="text-gray-900 mt-1">{scope.existingMappedIssueCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:col-span-2">
              <div className="text-gray-500">Embedding model used for recluster eligibility</div>
              <div className="text-gray-900 mt-1">{scope.embeddingModel ?? 'N/A'}</div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Select a product to preview clustering scope.</div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={goBackToClusters}>
          Back to Clusters
        </Button>
      </div>
    </div>
  );
}
