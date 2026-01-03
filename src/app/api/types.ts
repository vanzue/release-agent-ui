export type ApiSessionStatus = 'draft' | 'generating' | 'ready' | 'exported';
export type ApiJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ApiJobType = 'parse-changes' | 'generate-notes' | 'analyze-hotspots' | 'generate-testplan';

export type ApiSessionOptions = {
  normalizeBy?: 'pr' | 'commit';
  outputLanguage?: 'english' | 'chinese' | 'bilingual';
  strictMode?: boolean;
};

export type ApiSessionStats = {
  changeCount: number;
  releaseNotesCount: number;
  hotspotsCount: number;
  testCasesCount: number;
};

export type ApiSession = {
  id: string;
  repoFullName: string;
  name: string;
  status: ApiSessionStatus;
  baseRef: string;
  headRef: string;
  options: ApiSessionOptions;
  stats: ApiSessionStats;
  createdAt: string;
  updatedAt: string;
};

export type ApiJob = {
  id: string;
  sessionId: string;
  type: ApiJobType;
  status: ApiJobStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
};

export type ApiListResponse<T> = { items: T[] };

export type ApiCreateSessionRequest = {
  name: string;
  repoFullName: string;
  baseRef: string;
  headRef: string;
  options: ApiSessionOptions;
};

export type ApiChangesArtifact = {
  sessionId: string;
  items: Array<{
    id: string;
    title: string;
    number: number;
    author: string;
    filesChanged: number;
    additions: number;
    deletions: number;
    area: string;
    type: 'New' | 'Fix' | 'Change';
    risk: 'High' | 'Medium' | 'Low';
    signals?: string[];
    files?: Array<{ path: string; additions: number; deletions: number }>;
  }>;
};

export type ApiReleaseNoteStatus = 'ready' | 'regenerating';

export type ApiReleaseNoteItem = {
  id: string;
  text: string;
  source: { kind: 'pr' | 'commit' | 'manual'; ref: string };
  excluded: boolean;
  status?: ApiReleaseNoteStatus;
};

export type ApiReleaseNotesArtifact = {
  sessionId: string;
  sections: Array<{
    area: string;
    items: ApiReleaseNoteItem[];
  }>;
};

export type ApiPatchReleaseNotesOp =
  | { op: 'updateText'; itemId: string; text: string }
  | { op: 'exclude'; itemId: string }
  | { op: 'include'; itemId: string }
  | { op: 'addItem'; itemId?: string; area: string; text: string };

export type ApiPatchReleaseNotesRequest = {
  operations: ApiPatchReleaseNotesOp[];
};

export type ApiHotspotsArtifact = {
  sessionId: string;
  items: Array<{
    id: string;
    rank: number;
    area: string;
    score: number;
    drivers: string[];
    contributingPrs: number[];
  }>;
};

export type ApiTestPlanArtifact = {
  sessionId: string;
  sections: Array<{
    area: string;
    cases: Array<{
      id: string;
      text: string;
      checked: boolean;
      priority: 'Must' | 'Recommended' | 'Exploratory';
      source: string;
    }>;
  }>;
};

export type ApiPatchTestPlanOp =
  | { op: 'updateText'; caseId: string; text: string }
  | { op: 'check'; caseId: string }
  | { op: 'uncheck'; caseId: string }
  | { op: 'changePriority'; caseId: string; priority: 'Must' | 'Recommended' | 'Exploratory' }
  | { op: 'addCase'; caseId?: string; area: string; text: string; priority?: 'Must' | 'Recommended' | 'Exploratory' }
  | { op: 'deleteCase'; caseId: string };

export type ApiPatchTestPlanRequest = {
  operations: ApiPatchTestPlanOp[];
};

export type ApiCreateExportRequest = {
  targets: Array<'markdown' | 'json' | 'github'>;
  github?: {
    repoFullName?: string;
    mode?: 'comment' | 'pullRequest';
    issueOrPrNumber?: number | null;
    title?: string | null;
    bodyTemplate?: string | null;
  } | null;
};

export type ApiExportResult = {
  exportId: string;
  createdAt: string;
  results: Record<string, unknown>;
};

// Issue clustering
export type ApiIssueVersion = {
  targetVersion: string | null;
  issueCount: number;
};

export type ApiIssueVersionsResponse = {
  versions: ApiIssueVersion[];
  defaultTargetVersion: string | null;
};

export type ApiIssueProduct = {
  productLabel: string;
  issueCount: number;
  clusterCount: number;
};

export type ApiIssueProductsResponse = {
  targetVersion: string | null;
  defaultTargetVersion: string | null;
  products: ApiIssueProduct[];
};

export type ApiIssueCluster = {
  clusterId: string;
  size: number;
  updatedAt: string;
  popularity: number;
  representativeIssueNumber: number | null;
  representativeTitle: string | null;
};

export type ApiIssueClustersResponse = {
  targetVersion: string | null;
  defaultTargetVersion: string | null;
  productLabel: string;
  clusters: ApiIssueCluster[];
};

export type ApiIssueClusterDetails = {
  cluster: {
    clusterId: string;
    repoFullName: string;
    targetVersion: string | null;
    productLabel: string;
    thresholdUsed: number;
    topkUsed: number;
    size: number;
    popularity: number;
    representativeIssueNumber: number | null;
    updatedAt: string;
  };
  issues: Array<{
    issueNumber: number;
    title: string;
    state: 'open' | 'closed';
    labelsJson: any;
    updatedAt: string;
    similarity: number;
  }>;
};

export type ApiIssueSearchResponse = {
  targetVersion: string | null;
  defaultTargetVersion: string | null;
  issues: Array<{
    issueNumber: number;
    title: string;
    state: 'open' | 'closed';
    targetVersion: string | null;
    labelsJson: any;
    productLabels: string[];
    updatedAt: string;
  }>;
};

export type ApiIssueSyncStatus = {
  currentCount: number;
  estimatedTotal: number | null;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  progress: number;
};

export type ApiIssueStats = {
  totalIssues: number;
  openIssues: number;
  embeddedOpenIssues: number;
};
