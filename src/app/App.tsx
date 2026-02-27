import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionChangesPage } from './pages/SessionChangesPage';
import { SessionReleaseNotesPage } from './pages/SessionReleaseNotesPage';
import { SessionHotspotsPage } from './pages/SessionHotspotsPage';
import { SessionTestPlanPage } from './pages/SessionTestPlanPage';
import { SessionExportsPage } from './pages/SessionExportsPage';
import { SessionProvider } from './context/SessionContext';
import { RepoProvider } from './context/RepoContext';
import { IssueClustersPage } from './pages/IssueClustersPage';
import { ClusterDetailPage } from './pages/ClusterDetailPage';
import { IssueSemanticSearchPage } from './pages/IssueSemanticSearchPage';
import { IssueSyncAdminPage } from './pages/IssueSyncAdminPage';
import { IssueRecentPage } from './pages/IssueRecentPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './components/auth/AuthGate';

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <RepoProvider>
          <SessionProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/:sessionId/changes" element={<SessionChangesPage />} />
                <Route path="sessions/:sessionId/release-notes" element={<SessionReleaseNotesPage />} />
                <Route path="sessions/:sessionId/hotspots" element={<SessionHotspotsPage />} />
                <Route path="sessions/:sessionId/test-plan" element={<SessionTestPlanPage />} />
                <Route path="sessions/:sessionId/exports" element={<SessionExportsPage />} />
                <Route path="issues" element={<IssueClustersPage />} />
                <Route path="issues/recent" element={<IssueRecentPage />} />
                <Route path="issues/clusters/:clusterId" element={<ClusterDetailPage />} />
                <Route path="issues/:issueNumber" element={<IssueDetailPage />} />
                <Route path="issues/search" element={<IssueSemanticSearchPage />} />
                <Route path="issues/sync-admin" element={<IssueSyncAdminPage />} />
                {/* Redirect old routes */}
                <Route path="runs" element={<Navigate to="/sessions" replace />} />
                <Route path="runs/:sessionId/*" element={<Navigate to="/sessions" replace />} />
                <Route path="changes" element={<Navigate to="/" replace />} />
                <Route path="release-notes" element={<Navigate to="/" replace />} />
                <Route path="hotspots" element={<Navigate to="/" replace />} />
                <Route path="test-plan" element={<Navigate to="/" replace />} />
                <Route path="exports" element={<Navigate to="/" replace />} />
                <Route path="create-draft" element={<Navigate to="/sessions" replace />} />
                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SessionProvider>
        </RepoProvider>
      </AuthGate>
    </AuthProvider>
  );
}
