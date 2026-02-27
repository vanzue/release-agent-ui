import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiError } from '../api/client';
import type { ApiIssueDetailResponse } from '../api/types';
import { useRepo } from '../context/RepoContext';

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Failed to load issue details';
  if ('message' in error && typeof (error as any).message === 'string') return (error as any).message;
  return 'Failed to load issue details';
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  if ('status' in error && typeof (error as any).status === 'number') return (error as ApiError).status;
  return null;
}

export function IssueDetailPage() {
  const { issueNumber } = useParams<{ issueNumber: string }>();
  const [searchParams] = useSearchParams();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);
  const { repo: currentRepo } = useRepo();
  const repo = searchParams.get('repo')?.trim() || currentRepo;

  const [detail, setDetail] = useState<ApiIssueDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const parsedIssueNumber = issueNumber ? Number.parseInt(issueNumber, 10) : Number.NaN;

  const load = async () => {
    if (!api || Number.isNaN(parsedIssueNumber)) return;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await api.getIssueDetail(repo, parsedIssueNumber, { minSimilarity: 0.84, limit: 20 });
      setDetail(res);
    } catch (e: unknown) {
      const status = getErrorStatus(e);
      if (status === 404) {
        setNotFound(true);
        setDetail(null);
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (Number.isNaN(parsedIssueNumber)) {
      setError('Invalid issue number');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, repo, parsedIssueNumber]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">
            {detail ? `Issue #${detail.issue.issueNumber}` : `Issue #${Number.isNaN(parsedIssueNumber) ? '?' : parsedIssueNumber}`}
          </h1>
          <p className="text-gray-600">{detail?.issue.title ?? 'Issue detail and semantic metadata'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/issues/recent">
            <Button variant="outline">Back to Recent</Button>
          </Link>
          {detail && (
            <a
              href={`https://github.com/${repo}/issues/${detail.issue.issueNumber}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button className="bg-gray-900 text-white hover:bg-gray-800">Open on GitHub</Button>
            </a>
          )}
        </div>
      </div>

      {(error || notFound) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {notFound ? 'Issue not found in indexed database. Run sync to ingest this issue.' : error}
        </div>
      )}

      {isLoading && !detail && (
        <Card className="p-6 text-gray-500">Loading issue details...</Card>
      )}

      {detail && (
        <>
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  detail.issue.state === 'open'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }
              >
                {detail.issue.state}
              </Badge>
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                Version: {detail.issue.targetVersion ?? 'Unversioned'}
              </Badge>
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                Comments: {detail.issue.commentsCount}
              </Badge>
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                Reactions: {detail.issue.reactionsCount}
              </Badge>
              {detail.issue.embeddingModel && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Model: {detail.issue.embeddingModel}
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Created {new Date(detail.issue.createdAt).toLocaleString()} | Updated {new Date(detail.issue.updatedAt).toLocaleString()}
              {detail.issue.closedAt ? ` | Closed ${new Date(detail.issue.closedAt).toLocaleString()}` : ''}
            </div>
            <div className="text-sm text-gray-700">
              Product labels: {detail.issue.productLabels.length > 0 ? detail.issue.productLabels.join(', ') : 'none'}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-gray-900">Issue Content</h2>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words bg-gray-50 border border-gray-200 rounded-lg p-4">
              {detail.issue.body?.trim() || detail.issue.bodySnip?.trim() || 'No issue body content available.'}
            </pre>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-gray-900">Cluster Memberships</h2>
                <p className="text-gray-500 text-sm">How this issue is grouped today</p>
              </div>
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                {detail.clusterMemberships.length} memberships
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Similarity</TableHead>
                  <TableHead className="w-56">Product</TableHead>
                  <TableHead className="w-32">Version</TableHead>
                  <TableHead className="w-24">Size</TableHead>
                  <TableHead className="w-28">Popularity</TableHead>
                  <TableHead>Cluster</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.clusterMemberships.map((m) => (
                  <TableRow key={`${m.clusterId}-${m.productLabel}`}>
                    <TableCell>{(m.similarity * 100).toFixed(1)}%</TableCell>
                    <TableCell>{m.productLabel}</TableCell>
                    <TableCell>{m.targetVersion ?? 'Unversioned'}</TableCell>
                    <TableCell>{m.clusterSize}</TableCell>
                    <TableCell>{m.clusterPopularity.toFixed(2)}</TableCell>
                    <TableCell>
                      <Link
                        to={`/issues/clusters/${m.clusterId}?product=${encodeURIComponent(m.productLabel)}`}
                        className="text-blue-700 hover:underline"
                      >
                        {m.clusterId}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {detail.clusterMemberships.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No cluster memberships yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-gray-900">Similar Issues</h2>
                <p className="text-gray-500 text-sm">Nearest issues by embedding similarity</p>
              </div>
              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                {detail.similarIssues.length} matches
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Issue</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-24">State</TableHead>
                  <TableHead className="w-24">Sim</TableHead>
                  <TableHead className="w-56">Products</TableHead>
                  <TableHead className="w-44">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.similarIssues.map((issue) => (
                  <TableRow key={issue.issueNumber}>
                    <TableCell>
                      <Link to={`/issues/${issue.issueNumber}`} className="text-blue-700 hover:underline">
                        #{issue.issueNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="line-clamp-2">{issue.title}</TableCell>
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
                    <TableCell>{(issue.similarity * 100).toFixed(1)}%</TableCell>
                    <TableCell className="truncate">{issue.productLabels.join(', ') || '-'}</TableCell>
                    <TableCell>{new Date(issue.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {detail.similarIssues.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No similar issues found for this issue.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
