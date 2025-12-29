import { useParams, Link } from 'react-router-dom';
import { useSessions } from '../context/SessionContext';
import { ChangesPage } from './ChangesPage';
import { ChangesPageSkeleton } from '../components/skeletons/ArtifactSkeletons';

export function SessionChangesPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, isLoading } = useSessions();

  // Show skeleton while sessions are loading
  if (isLoading) {
    return <ChangesPageSkeleton />;
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

  return <ChangesPage />;
}

