import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { useRepo } from '../context/RepoContext';

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, index) => (
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
                </TableRow>
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
