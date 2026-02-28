import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiIssueProduct, ApiIssueVersion } from '../api/types';
import { useRepo } from '../context/RepoContext';

const VERSION_ALL = '__all__';
const VERSION_UNVERSIONED = '__unversioned__';
const PRODUCT_ALL = '__all_products__';
const PAGE_SIZE = 30;

function toVersionSelectValue(v: string | null | undefined): string {
  if (v === undefined) return VERSION_ALL;
  if (v === null) return VERSION_UNVERSIONED;
  return v;
}

function fromVersionSelectValue(v: string): string | null | undefined {
  if (v === VERSION_ALL) return undefined;
  if (v === VERSION_UNVERSIONED) return null;
  return v;
}

type IssueStateFilter = 'all' | 'open' | 'closed';

export function IssueRecentPage() {
  const navigate = useNavigate();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);
  const { repo } = useRepo();

  const [versions, setVersions] = useState<ApiIssueVersion[]>([]);
  const [products, setProducts] = useState<ApiIssueProduct[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null | undefined>(undefined);
  const [selectedProduct, setSelectedProduct] = useState<string>(PRODUCT_ALL);
  const [stateFilter, setStateFilter] = useState<IssueStateFilter>('all');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [issues, setIssues] = useState<
    Array<{
      issueNumber: number;
      title: string;
      state: 'open' | 'closed';
      targetVersion: string | null;
      labelsJson: any;
      productLabels: string[];
      updatedAt: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = async () => {
    if (!api) return;
    const res = await api.listIssueVersions(repo);
    setVersions(res.versions ?? []);
  };

  const loadProducts = async (version: string | null | undefined) => {
    if (!api) return;
    const res = await api.listIssueProducts(repo, version);
    const next = res.products ?? [];
    setProducts(next);
    if (selectedProduct !== PRODUCT_ALL && !next.some((p) => p.productLabel === selectedProduct)) {
      setSelectedProduct(PRODUCT_ALL);
    }
  };

  const loadIssues = async (requestedPage?: number) => {
    if (!api) return;
    const currentPage = requestedPage ?? page;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.searchIssues(repo, {
        targetVersion: selectedVersion,
        productLabels: selectedProduct === PRODUCT_ALL ? undefined : [selectedProduct],
        state: stateFilter === 'all' ? undefined : stateFilter,
        q: appliedQuery || undefined,
        limit: PAGE_SIZE + 1,
        offset: currentPage * PAGE_SIZE,
      });
      const rows = res.issues ?? [];
      setHasMore(rows.length > PAGE_SIZE);
      setIssues(rows.slice(0, PAGE_SIZE));
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load recent issues';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!api) return;
    setAppliedQuery('');
    setQuery('');
    setPage(0);
    setSelectedVersion(undefined);
    setSelectedProduct(PRODUCT_ALL);
    void (async () => {
      try {
        await loadVersions();
        await loadProducts(undefined);
      } catch (e: unknown) {
        const message =
          e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to initialize issue view';
        setError(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, repo]);

  useEffect(() => {
    if (!api) return;
    void loadProducts(selectedVersion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selectedVersion]);

  useEffect(() => {
    if (!api) return;
    void loadIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, selectedVersion, selectedProduct, stateFilter, appliedQuery, page]);

  const applySearch = () => {
    const trimmed = query.trim();
    if (trimmed === appliedQuery && page === 0) {
      void loadIssues(0);
      return;
    }
    setPage(0);
    setAppliedQuery(trimmed);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Recent Issues</h1>
          <p className="text-gray-600">Review latest updated issues and open detailed semantic metadata.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-gray-50 border-gray-200">
            Repo: {repo}
          </Badge>
          <Button variant="outline" onClick={loadIssues} disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Version</div>
            <Select
              value={toVersionSelectValue(selectedVersion)}
              onValueChange={(v) => {
                setPage(0);
                setSelectedVersion(fromVersionSelectValue(v));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VERSION_ALL}>All versions</SelectItem>
                <SelectItem value={VERSION_UNVERSIONED}>Unversioned only</SelectItem>
                {versions
                  .filter((v) => v.targetVersion !== null)
                  .map((v) => (
                    <SelectItem key={v.targetVersion as string} value={v.targetVersion as string}>
                      {v.targetVersion} ({v.issueCount})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[240px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Product</div>
            <Select
              value={selectedProduct}
              onValueChange={(v) => {
                setPage(0);
                setSelectedProduct(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRODUCT_ALL}>All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.productLabel} value={p.productLabel}>
                    {p.productLabel} ({p.issueCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">State</div>
            <Select
              value={stateFilter}
              onValueChange={(v) => {
                setPage(0);
                setStateFilter(v as IssueStateFilter);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[260px] flex-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Search</div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search title/body..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
              />
              <Button variant="outline" onClick={applySearch} disabled={isLoading}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900">Issues</h2>
            <p className="text-gray-500 text-sm">Sorted by latest updates | page {page + 1}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-gray-50 border-gray-200">
              {issues.length} on this page
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={isLoading || page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading || !hasMore}
            >
              Next
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Issue</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-24">State</TableHead>
              <TableHead className="w-40">Version</TableHead>
              <TableHead className="w-56">Products</TableHead>
              <TableHead className="w-44">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && issues.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                  Loading issues...
                </TableCell>
              </TableRow>
            )}
            {issues.map((issue) => (
              <TableRow
                key={issue.issueNumber}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/issues/${issue.issueNumber}`)}
              >
                <TableCell className="text-blue-700">#{issue.issueNumber}</TableCell>
                <TableCell>
                  <div className="line-clamp-2">{issue.title}</div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      issue.state === 'open'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }
                  >
                    {issue.state}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600">{issue.targetVersion ?? 'Unversioned'}</TableCell>
                <TableCell className="text-gray-600 truncate">
                  {issue.productLabels.length > 0 ? issue.productLabels.join(', ') : '-'}
                </TableCell>
                <TableCell className="text-gray-600">{new Date(issue.updatedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {!isLoading && issues.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                  No issues found with current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
