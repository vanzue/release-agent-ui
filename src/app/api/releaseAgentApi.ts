import { requestJson } from './client';
import type {
  ApiCreateExportRequest,
  ApiCreateSessionRequest,
  ApiExportResult,
  ApiHotspotsArtifact,
  ApiJob,
  ApiListResponse,
  ApiPatchReleaseNotesRequest,
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

    createExport: (sessionId: string, body: ApiCreateExportRequest) =>
      requestJson<ApiExportResult>(baseUrl, `/sessions/${sessionId}/exports`, { method: 'POST', body }),
  };
}
