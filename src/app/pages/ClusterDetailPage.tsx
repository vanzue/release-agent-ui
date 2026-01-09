import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { useRepo } from '../context/RepoContext';
import type { ApiSimilarIssue } from '../api/types';

interface ClusterIssue {
  issueNumber: number;
  title: string;
  state: 'open' | 'closed';
  updatedAt: string;
  similarity: number;
}

interface ClusterInfo {
  clusterId: string;
  representativeTitle: string | null;
  representativeIssueNumber: number | null;
  size: number;
  popularity: number;
  productLabel: string;
}

export function ClusterDetailPage() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { repo } = useRepo();
  
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [issues, setIssues] = useState<ClusterIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Similar issues state
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [similarIssues, setSimilarIssues] = useState<ApiSimilarIssue[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  // Get cluster metadata from URL params
  const productLabel = searchParams.get('product') ?? '';
  const representativeTitle = searchParams.get('title') ?? '';
  const representativeIssueNumber = searchParams.get('issue') ? parseInt(searchParams.get('issue')!, 10) : null;
  const size = searchParams.get('size') ? parseInt(searchParams.get('size')!, 10) : 0;
  const popularity = searchParams.get('popularity') ? parseFloat(searchParams.get('popularity')!) : 0;

  useEffect(() => {
    if (!api || !clusterId) return;

    setClusterInfo({
      clusterId,
      representativeTitle,
      representativeIssueNumber,
      size,
      popularity,
      productLabel,
    });

    const loadClusterIssues = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.getIssueCluster(repo, clusterId);
        setIssues(res.issues ?? []);
      } catch (e: unknown) {
        const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load cluster details';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadClusterIssues();
  }, [api, clusterId, repo]);

  const handleFindSimilar = async (issueNumber: number) => {
    if (!api) return;
    
    // Toggle off if clicking the same issue
    if (expandedIssue === issueNumber) {
      setExpandedIssue(null);
      setSimilarIssues([]);
      return;
    }
    
    setExpandedIssue(issueNumber);
    setSimilarLoading(true);
    setSimilarIssues([]);
    
    try {
      const res = await api.findSimilarIssues(repo, issueNumber, {
        productLabel,
        minSimilarity: 0.85,
        limit: 10,
      });
      setSimilarIssues(res.similarIssues ?? []);
    } catch (e) {
      console.error('Failed to load similar issues:', e);
      setSimilarIssues([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/issues')}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Clusters
        </Button>
      </div>

      {/* Cluster Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                {productLabel}
              </Badge>
              {representativeIssueNumber && (
                <a
                  href={`https://github.com/${repo}/issues/${representativeIssueNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  #{representativeIssueNumber}
                </a>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {representativeTitle || 'Untitled Cluster'}
            </h1>
            <p className="text-gray-500">
              This cluster groups similar issues based on semantic similarity.
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-3xl font-bold text-gray-900">{size}</div>
            <div className="text-sm text-gray-500">issues</div>
            <div className="text-sm text-gray-400 mt-2">
              Popularity: {popularity.toFixed(2)}
            </div>
          </div>
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Issues Table */}
      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 font-medium">Related Issues</h2>
            <p className="text-gray-500 text-sm">Ranked by similarity to cluster centroid</p>
          </div>
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {issues.length} issues
          </Badge>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading issues...</div>
        ) : issues.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-24">State</TableHead>
                <TableHead className="w-28">Similarity</TableHead>
                <TableHead className="w-40">Updated</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, index) => (
                <>
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
                      <Badge 
                        variant="outline" 
                        className={issue.state === 'open' 
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
                          {issue.similarity.toFixed(3)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(issue.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFindSimilar(issue.issueNumber)}
                        className={`text-xs ${expandedIssue === issue.issueNumber ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {expandedIssue === issue.issueNumber ? (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Hide
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Similar
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded row for similar issues */}
                  {expandedIssue === issue.issueNumber && (
                    <TableRow key={`${issue.issueNumber}-similar`}>
                      <TableCell colSpan={6} className="bg-blue-50/50 p-0">
                        <div className="p-4 border-l-4 border-blue-400">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium text-gray-700">
                              Similar Issues (≥85% similarity, same product: {productLabel})
                            </div>
                            {similarLoading && (
                              <div className="text-xs text-gray-500">Loading...</div>
                            )}
                          </div>
                          
                          {similarLoading ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              Searching for similar issues...
                            </div>
                          ) : similarIssues.length > 0 ? (
                            <div className="space-y-2">
                              {similarIssues.map((similar) => (
                                <div
                                  key={similar.issueNumber}
                                  className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                                >
                                  <a
                                    className="flex-1 min-w-0"
                                    href={`https://github.com/${repo}/issues/${similar.issueNumber}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <div className="text-sm text-gray-900 hover:text-blue-600 truncate">
                                      {similar.title}
                                    </div>
                                    <div className="text-xs text-blue-600 mt-0.5">
                                      #{similar.issueNumber}
                                    </div>
                                  </a>
                                  <Badge 
                                    variant="outline" 
                                    className={similar.state === 'open' 
                                      ? 'bg-green-50 text-green-700 border-green-200 flex-shrink-0' 
                                      : 'bg-purple-50 text-purple-700 border-purple-200 flex-shrink-0'
                                    }
                                  >
                                    {similar.state}
                                  </Badge>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-green-500 rounded-full" 
                                        style={{ width: `${similar.similarity * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-gray-600 font-mono w-14">
                                      {(similar.similarity * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 text-sm">
                              No similar issues found with ≥85% similarity in {productLabel}.
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-gray-500">No issues in this cluster.</div>
        )}
      </Card>
    </div>
  );
}
