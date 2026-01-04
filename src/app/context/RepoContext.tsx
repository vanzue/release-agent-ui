import { createContext, useContext, useState, type ReactNode } from 'react';

type RepoContextValue = {
  repo: string;
  setRepo: (repo: string) => void;
};

const RepoContext = createContext<RepoContextValue | null>(null);

export function RepoProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState('microsoft/PowerToys');

  return (
    <RepoContext.Provider value={{ repo, setRepo }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  const ctx = useContext(RepoContext);
  if (!ctx) {
    throw new Error('useRepo must be used within a RepoProvider');
  }
  return ctx;
}
