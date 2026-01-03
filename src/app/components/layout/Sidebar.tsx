import { NavLink, useParams } from 'react-router-dom';
import { Home, Activity, GitBranch, FileText, CheckSquare, Archive, Flame, Layers } from 'lucide-react';
import { cn } from '../ui/utils';
import { useSessions } from '../../context/SessionContext';
import { JobPipeline } from '../ui/job-pipeline';
import { CommitRange } from '../ui/commit-range';

export function Sidebar() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { sessions } = useSessions();
  const session = sessions.find((s) => s.id === sessionId);

  // Show session navigation only when viewing a specific session
  const showSessionNav = Boolean(sessionId);

  const mainNavItems = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/sessions', icon: Activity, label: 'Release Drafts' },
    { to: '/issues', icon: Layers, label: 'Issue Clusters' },
  ];

  const sessionNavItems = showSessionNav ? [
    { to: `/sessions/${sessionId}/changes`, icon: GitBranch, label: 'Changes' },
    { to: `/sessions/${sessionId}/release-notes`, icon: FileText, label: 'Release Notes' },
    { to: `/sessions/${sessionId}/hotspots`, icon: Flame, label: 'Hotspots' },
    { to: `/sessions/${sessionId}/test-plan`, icon: CheckSquare, label: 'Test Plan' },
    { to: `/sessions/${sessionId}/exports`, icon: Archive, label: 'Exports' },
  ] : [];

  return (
    <aside className="w-64 bg-white/50 backdrop-blur-sm border-r border-gray-200/80 shrink-0 flex flex-col">
      <div className="flex-1 overflow-auto">
        <nav className="p-3 space-y-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm',
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {showSessionNav && (
          <>
            <div className="px-4 py-3">
              <div className="border-t border-gray-200/80" />
            </div>
            
            <div className="px-4 pb-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 py-1">
                Current Draft
              </div>
            </div>

            <nav className="px-3 space-y-1">
              {sessionNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm',
                      isActive
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </>
        )}
      </div>

      {session && (
        <div className="p-3 border-t border-gray-200/80 space-y-3">
          {/* Job Pipeline */}
          {session.status === 'generating' && session.jobs.length > 0 && (
            <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
              <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-2">
                Progress
              </div>
              <JobPipeline jobs={session.jobs} />
            </div>
          )}

          {/* Session Info */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200/50">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Repo</span>
                <p className="text-xs text-gray-900 font-medium truncate mt-0.5">{session.repoFullName}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Range</span>
                <div className="mt-1">
                  <CommitRange baseRef={session.baseRef} headRef={session.headRef} size="sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
