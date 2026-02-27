import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import type { ApiJob, ApiSession } from '../api/types';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SessionStatus = 'draft' | 'generating' | 'ready' | 'exported';

export interface Job {
  id: string;
  type: 'parse-changes' | 'generate-notes' | 'analyze-hotspots' | 'generate-testplan' | 'generate-testchecklists';
  status: JobStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface Session {
  id: string;
  repoFullName: string;
  name: string;
  status: SessionStatus;
  baseRef: string;
  headRef: string;
  createdAt: Date;
  updatedAt: Date;
  jobs: Job[];
  stats: {
    changeCount: number;
    releaseNotesCount: number;
    hotspotsCount: number;
    testCasesCount: number;
  };
}

interface SessionContextType {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  createSession: (data: {
    name: string;
    repoFullName: string;
    baseRef: string;
    headRef: string;
  }) => Promise<Session>;
  getRunningJobs: () => { session: Session; job: Job }[];
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function parseDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapJob(job: ApiJob): Job {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    startedAt: parseDate(job.startedAt),
    completedAt: parseDate(job.completedAt),
    error: job.error ?? undefined,
  };
}

function mapSession(session: ApiSession, jobs: ApiJob[]): Session {
  return {
    id: session.id,
    repoFullName: session.repoFullName,
    name: session.name,
    status: session.status,
    baseRef: session.baseRef,
    headRef: session.headRef,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    jobs: jobs.map(mapJob),
    stats: session.stats,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const refresh = () => {
    if (!api) return;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const sessionItems = (await api.listSessions()).items;
        const hydrated = await Promise.all(
          sessionItems.map(async (s) => {
            const jobs = (await api.listJobs(s.id)).items;
            return mapSession(s, jobs);
          })
        );
        setSessions(hydrated);
      } catch (e: unknown) {
        const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  useEffect(() => {
    if (!api) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!api) return;

    const interval = setInterval(() => {
      const snapshot = sessionsRef.current;
      const sessionsToRefresh = snapshot.filter((s) => s.status === 'generating');
      if (sessionsToRefresh.length === 0) return;

      (async () => {
        try {
          const jobsBySessionId = new Map<string, ApiJob[]>();
          await Promise.all(
            sessionsToRefresh.map(async (s) => {
              const jobs = (await api.listJobs(s.id)).items;
              jobsBySessionId.set(s.id, jobs);
            })
          );

          setSessions((prev) =>
            prev.map((session) => {
              const jobs = jobsBySessionId.get(session.id);
              return jobs ? { ...session, jobs: jobs.map(mapJob) } : session;
            })
          );
        } catch {
          // best-effort polling
        }
      })();
    }, 5000);

    return () => clearInterval(interval);
  }, [api]);

  const createSession = async (data: {
    name: string;
    repoFullName: string;
    baseRef: string;
    headRef: string;
  }): Promise<Session> => {
    if (!api) {
      const now = new Date();
      const newSession: Session = {
        id: `session-${Date.now()}`,
        repoFullName: data.repoFullName,
        name: data.name,
        status: 'generating',
        baseRef: data.baseRef,
        headRef: data.headRef,
        createdAt: now,
        updatedAt: now,
        jobs: [],
        stats: { changeCount: 0, releaseNotesCount: 0, hotspotsCount: 0, testCasesCount: 0 },
      };
      setSessions((prev) => [newSession, ...prev]);
      return newSession;
    }

    const created = await api.createSession({
      name: data.name,
      repoFullName: data.repoFullName,
      baseRef: data.baseRef,
      headRef: data.headRef,
      options: { normalizeBy: 'commit' },
    });

    const jobs = (await api.listJobs(created.id)).items;
    const ui = mapSession(created, jobs);
    setSessions((prev) => [ui, ...prev]);
    return ui;
  };

  const getRunningJobs = () => {
    const running: { session: Session; job: Job }[] = [];
    sessions.forEach((session) => {
      session.jobs.forEach((job) => {
        if (job.status === 'running') running.push({ session, job });
      });
    });
    return running;
  };

  return (
    <SessionContext.Provider value={{ sessions, isLoading, error, refresh, createSession, getRunningJobs }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSessions must be used within SessionProvider');
  return context;
}
