import { useMemo, useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { useRepo } from '../context/RepoContext';
import type { ApiSimilarIssue } from '../api/types';

export function IssueSemanticSearchPage() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);
  const { repo } = useRepo();

  // Search mode
  const [searchMode, setSearchMode] = useState<'issue' | 'query'>('query');
  
  // Search inputs
  const [issueNumber, setIssueNumber] = useState('');
  const [queryText, setQueryText] = useState('');
  const [productLabel, setProductLabel] = useState('__all__');
  const [minSimilarity, setMinSimilarity] = useState('0.80');
  const [limit, setLimit] = useState('20');

  // Available products
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Results
  const [results, setResults] = useState<ApiSimilarIssue[]>([]);
  const [searchInfo, setSearchInfo] = useState<{
    mode: 'issue' | 'query';
    issueNumber: number | null;
    query: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available products when repo changes
  useEffect(() => {
    if (!api || !repo) return;
    
    setLoadingProducts(true);
    api.listIssueProducts(repo)
      .then((result) => {
        const productLabels = result.products.map(p => p.productLabel).sort();
        setAvailableProducts(productLabels);
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
        setAvailableProducts([]);
      })
      .finally(() => {
        setLoadingProducts(false);
      });
  }, [api, repo]);

  const handleSearch = async () => {
    if (!api) {
      setError('API not initialized');
      return;
    }
    
    if (!repo) {
      setError('Repository not selected');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResults([]);
    setSearchInfo(null);

    try {
      const issueNum = searchMode === 'issue' ? Number.parseInt(issueNumber, 10) : undefined;
      const queryStr = searchMode === 'query' ? queryText : undefined;
      
      if (searchMode === 'issue' && !issueNum) {
        setError('Please enter a valid issue number');
        setIsLoading(false);
        return;
      }
      
      if (searchMode === 'query' && !queryStr?.trim()) {
        setError('Please enter a search query');
        setIsLoading(false);
        return;
      }

      const res = await api.semanticSearch(repo, {
        issueNumber: issueNum,
        query: queryStr,
        productLabel: productLabel === '__all__' ? undefined : productLabel,
        minSimilarity: Number.parseFloat(minSimilarity),
        limit: Number.parseInt(limit, 10),
      });

      setResults(res.results ?? []);
      setSearchInfo({
        mode: res.mode,
        issueNumber: res.issueNumber,
        query: res.query,
      });
    } catch (e: any) {
      const message = e?.message ?? 'Search failed';
      setError(message);
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-gray-900 mb-2">Issue Semantic Search</h1>
        <p className="text-gray-600">
          Search for similar issues using embedding-based semantic similarity.
        </p>
      </div>

      {/* Search Form */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={searchMode === 'query' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('query')}
              className={searchMode === 'query' ? 'bg-gray-900 text-white' : ''}
            >
              Search by Text
            </Button>
            <Button
              variant={searchMode === 'issue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSearchMode('issue')}
              className={searchMode === 'issue' ? 'bg-gray-900 text-white' : ''}
            >
              Search by Issue #
            </Button>
          </div>

          {/* Search Input */}
          <div className="flex gap-4">
            {searchMode === 'query' ? (
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Search Query
                </label>
                <Input
                  placeholder="Describe the issue you're looking for..."
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="w-48">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                  Issue Number
                </label>
                <Input
                  placeholder="e.g., 12345"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={handleKeyDown}
                />
              </div>
            )}

            <div className="w-48">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Product Label (Optional)
              </label>
              <Select value={productLabel} onValueChange={setProductLabel} disabled={loadingProducts}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProducts ? "Loading..." : "Select a product"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Products</SelectItem>
                  {availableProducts.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-32">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Min Similarity
              </label>
              <Select value={minSimilarity} onValueChange={setMinSimilarity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.70">70%</SelectItem>
                  <SelectItem value="0.75">75%</SelectItem>
                  <SelectItem value="0.80">80%</SelectItem>
                  <SelectItem value="0.85">85%</SelectItem>
                  <SelectItem value="0.90">90%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-24">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Limit
              </label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={isLoading || (searchMode === 'query' ? !queryText.trim() : !issueNumber)}
                className="bg-gray-900 text-white hover:bg-gray-800"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {searchInfo && (
        <Card>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-gray-900 font-medium">Search Results</h2>
              <p className="text-gray-500 text-sm">
                {searchInfo.mode === 'issue' 
                  ? `Similar to issue #${searchInfo.issueNumber}`
                  : `Matching: "${searchInfo.query}"`
                }
              </p>
            </div>
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
              {results.length} results
            </Badge>
          </div>

          {results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-32">Products</TableHead>
                  <TableHead className="w-24">State</TableHead>
                  <TableHead className="w-32">Similarity</TableHead>
                  <TableHead className="w-32">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((issue, index) => (
                  <TableRow key={issue.issueNumber} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-gray-400">{index + 1}</TableCell>
                    <TableCell>
                      <a
                        className="group block"
                        href={`https://github.com/${repo}/issues/${issue.issueNumber}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div className="text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                          {issue.title}
                        </div>
                        <div className="text-xs text-blue-600 mt-0.5">
                          #{issue.issueNumber}
                        </div>
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {issue.productLabels.slice(0, 2).map((label) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className="bg-gray-50 text-gray-600 border-gray-200 text-xs"
                          >
                            {label}
                          </Badge>
                        ))}
                        {issue.productLabels.length > 2 && (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
                            +{issue.productLabels.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          issue.state === 'open'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }
                      >
                        {issue.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${issue.similarity * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 font-mono">
                          {(issue.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(issue.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No similar issues found with the specified criteria.
            </div>
          )}
        </Card>
      )}

      {/* Empty State */}
      {!searchInfo && !isLoading && (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Ready to Search</h3>
            <p className="text-sm">
              Enter a text query or issue number to find semantically similar issues.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
