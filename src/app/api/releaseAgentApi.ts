import { requestJson } from './client';
import type {
  ApiCreateExportRequest,
  ApiCreateSessionRequest,
  ApiExportResult,
  ApiHotspotsArtifact,
  ApiIssueClusterDetails,
  ApiIssueClustersResponse,
  ApiIssueProductsResponse,
  ApiIssueSearchResponse,
  ApiIssueStats,
  ApiIssueSyncStatus,
  ApiIssueSyncResetRequest,
  ApiIssueSyncResetResult,
  ApiIssueVersionsResponse,
  ApiTopIssuesResponse,
  ApiSimilarIssuesResponse,
  ApiIssueDetailResponse,
  ApiSemanticSearchResponse,
  ApiIssueDashboardResponse,
  ApiJob,
  ApiListResponse,
  ApiPatchReleaseNotesRequest,
  ApiQueueTestPlanChecklistsRequest,
  ApiQueueTestPlanChecklistsResponse,
  ApiPatchTestPlanRequest,
  ApiReleaseNotesArtifact,
  ApiTestPlanArtifact,
  ApiSession,
  ApiChangesArtifact,
} from './types';

export function createReleaseAgentApi(baseUrl: string) {
  return {
    listSessions: () => requestJson<ApiListResponse<ApiSession>>(baseUrl, '/sessions'),
    createSession: (body: ApiCreateSessionRequest) =>
      requestJson<ApiSession>(baseUrl, '/sessions', { method: 'POST', body }),
    getSession: (sessionId: string) => requestJson<ApiSession>(baseUrl, `/sessions/${sessionId}`),
    deleteSession: (sessionId: string) =>
      requestJson<void>(baseUrl, `/sessions/${sessionId}`, { method: 'DELETE' }),

    listJobs: (sessionId: string) => requestJson<ApiListResponse<ApiJob>>(baseUrl, `/sessions/${sessionId}/jobs`),

    getChangesArtifact: (sessionId: string) =>
      requestJson<ApiChangesArtifact>(baseUrl, `/sessions/${sessionId}/artifacts/changes`),
    getReleaseNotesArtifact: (sessionId: string) =>
      requestJson<ApiReleaseNotesArtifact>(baseUrl, `/sessions/${sessionId}/artifacts/release-notes`),
    patchReleaseNotesArtifact: (sessionId: string, body: ApiPatchReleaseNotesRequest) =>
      requestJson<ApiReleaseNotesArtifact>(baseUrl, `/sessions/${sessionId}/artifacts/release-notes`, {
        method: 'PATCH',
        body,
      }),
    regenerateReleaseNoteItem: (sessionId: string, itemId: string) =>
      requestJson<{ message: string; itemId: string; commitSha: string }>(
        baseUrl,
        `/sessions/${sessionId}/artifacts/release-notes/items/${itemId}/regenerate`,
        { method: 'POST' }
      ),
    getHotspotsArtifact: (sessionId: string) =>
      requestJson<ApiHotspotsArtifact>(baseUrl, `/sessions/${sessionId}/artifacts/hotspots`),
    getTestPlanArtifact: (sessionId: string) =>
      requestJson<ApiTestPlanArtifact>(baseUrl, `/sessions/${sessionId}/artifacts/test-plan`),
    patchTestPlanArtifact: (sessionId: string, body: ApiPatchTestPlanRequest) =>
      requestJson<ApiTestPlanArtifact>(baseUrl, `/sessions/${sessionId}/artifacts/test-plan`, {
        method: 'PATCH',
        body,
      }),
    queueTestPlanChecklists: (sessionId: string, body: ApiQueueTestPlanChecklistsRequest = {}) =>
      requestJson<ApiQueueTestPlanChecklistsResponse>(baseUrl, `/sessions/${sessionId}/artifacts/test-plan/checklists/queue`, {
        method: 'POST',
        body,
      }),

    createExport: (sessionId: string, body: ApiCreateExportRequest) =>
      requestJson<ApiExportResult>(baseUrl, `/sessions/${sessionId}/exports`, { method: 'POST', body }),

    // Issue clustering
    listIssueVersions: (repo: string) =>
      requestJson<ApiIssueVersionsResponse>(baseUrl, `/issues/versions?repo=${encodeURIComponent(repo)}`),
    listIssueProducts: (repo: string, targetVersion?: string | null) => {
      const params = new URLSearchParams({ repo });
      if (targetVersion !== undefined) {
        params.set('targetVersion', targetVersion ?? '__null__');
      }
      return requestJson<ApiIssueProductsResponse>(baseUrl, `/issues/products?${params.toString()}`);
    },
    listIssueClusters: (repo: string, productLabel: string, _targetVersion?: string | null, limit?: number) => {
      const params = new URLSearchParams({ repo, productLabel });
      if (limit !== undefined) params.set('limit', String(limit));
      return requestJson<ApiIssueClustersResponse>(baseUrl, `/issues/clusters?${params.toString()}`);
    },
    getIssueCluster: (repo: string, clusterId: string) =>
      requestJson<ApiIssueClusterDetails>(
        baseUrl,
        `/issues/clusters/${encodeURIComponent(clusterId)}?repo=${encodeURIComponent(repo)}`
      ),
    searchIssues: (repo: string, options: {
      targetVersion?: string | null;
      productLabels?: string[];
      state?: 'open' | 'closed';
      clusterId?: string;
      q?: string;
      limit?: number;
      offset?: number;
    }) => {
      const params = new URLSearchParams({ repo });
      if (options.targetVersion === undefined) {
        params.set('targetVersion', '__all__');
      } else if (options.targetVersion === null) {
        params.set('targetVersion', '__null__');
      } else {
        params.set('targetVersion', options.targetVersion);
      }
      if (options.productLabels && options.productLabels.length > 0) params.set('productLabels', options.productLabels.join(','));
      if (options.state) params.set('state', options.state);
      if (options.clusterId) params.set('clusterId', options.clusterId);
      if (options.q) params.set('q', options.q);
      if (options.limit !== undefined) params.set('limit', String(options.limit));
      if (options.offset !== undefined) params.set('offset', String(options.offset));
      return requestJson<ApiIssueSearchResponse>(baseUrl, `/issues/search?${params.toString()}`);
    },
    getIssueSyncStatus: (repo: string) =>
      requestJson<ApiIssueSyncStatus>(baseUrl, `/issues/sync-status?repo=${encodeURIComponent(repo)}`),
    getIssueStats: (repo: string) =>
      requestJson<ApiIssueStats>(baseUrl, `/issues/stats?repo=${encodeURIComponent(repo)}`),
    getIssueDashboard: (repo: string, options?: {
      semanticLimit?: number;
      issuesPerSemantic?: number;
      minSimilarity?: number;
    }) => {
      const params = new URLSearchParams({ repo });
      if (options?.semanticLimit !== undefined) params.set('semanticLimit', String(options.semanticLimit));
      if (options?.issuesPerSemantic !== undefined) params.set('issuesPerSemantic', String(options.issuesPerSemantic));
      if (options?.minSimilarity !== undefined) params.set('minSimilarity', String(options.minSimilarity));
      return requestJson<ApiIssueDashboardResponse>(baseUrl, `/issues/dashboard?${params.toString()}`);
    },
    getTopIssuesByReactions: (repo: string, targetVersion?: string | null, productLabel?: string, limit?: number) => {
      const params = new URLSearchParams({ repo });
      if (targetVersion !== undefined) {
        params.set('targetVersion', targetVersion ?? '__null__');
      }
      if (productLabel) params.set('productLabel', productLabel);
      if (limit !== undefined) params.set('limit', String(limit));
      return requestJson<ApiTopIssuesResponse>(baseUrl, `/issues/top-by-reactions?${params.toString()}`);
    },
    enqueueIssueSync: (repoFullName: string, fullSync?: boolean) =>
      requestJson<{ status: string }>(baseUrl, `/issues/sync`, { method: 'POST', body: { repoFullName, fullSync } }),
    resetAndQueueIssueSync: (body: ApiIssueSyncResetRequest) =>
      requestJson<ApiIssueSyncResetResult>(baseUrl, `/issues/sync-reset`, { method: 'POST', body }),
    enqueueIssueRecluster: (body: {
      repoFullName: string;
      targetVersion: string | null;
      productLabel: string;
      threshold: number;
      topK: number;
    }) =>
      requestJson<{ status: string }>(baseUrl, `/issues/recluster`, { method: 'POST', body }),

    findSimilarIssues: (repo: string, issueNumber: number, options?: {
      productLabel?: string;
      minSimilarity?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams({ repo });
      if (options?.productLabel) params.set('productLabel', options.productLabel);
      if (options?.minSimilarity !== undefined) params.set('minSimilarity', String(options.minSimilarity));
      if (options?.limit !== undefined) params.set('limit', String(options.limit));
      return requestJson<ApiSimilarIssuesResponse>(baseUrl, `/issues/${issueNumber}/similar?${params.toString()}`);
    },
    getIssueDetail: (repo: string, issueNumber: number, options?: {
      minSimilarity?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams({ repo });
      if (options?.minSimilarity !== undefined) params.set('minSimilarity', String(options.minSimilarity));
      if (options?.limit !== undefined) params.set('limit', String(options.limit));
      return requestJson<ApiIssueDetailResponse>(baseUrl, `/issues/${issueNumber}/detail?${params.toString()}`);
    },

    semanticSearch: (repo: string, options: {
      issueNumber?: number;
      query?: string;
      productLabel?: string;
      minSimilarity?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams({ repo });
      if (options.issueNumber !== undefined) params.set('issueNumber', String(options.issueNumber));
      if (options.query) params.set('q', options.query);
      if (options.productLabel) params.set('productLabel', options.productLabel);
      if (options.minSimilarity !== undefined) params.set('minSimilarity', String(options.minSimilarity));
      if (options.limit !== undefined) params.set('limit', String(options.limit));
      return requestJson<ApiSemanticSearchResponse>(baseUrl, `/issues/semantic-search?${params.toString()}`);
    },
  };
}
