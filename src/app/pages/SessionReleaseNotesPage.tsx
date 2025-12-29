import { useParams, Link } from 'react-router-dom';
import { useSessions } from '../context/SessionContext';
import { ReleaseNotesPage } from './ReleaseNotesPage';
import { ReleaseNotesPageSkeleton } from '../components/skeletons/ArtifactSkeletons';

export function SessionReleaseNotesPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, isLoading } = useSessions();

  // Show skeleton while sessions are loading
  if (isLoading) {
    return <ReleaseNotesPageSkeleton />;
  }

  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Session not found</p>
        <Link to="/sessions">
          <button className="mt-4 text-blue-600 hover:underline">Back to Sessions</button>
        </Link>
      </div>
    );
  }

  return <ReleaseNotesPage />;
}

