import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Copy, FileText } from 'lucide-react';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { TestPlanPageSkeleton } from '../components/skeletons/ArtifactSkeletons';
import type { ApiPatchTestPlanCasePatch, ApiPatchTestPlanOp, ApiTestPlanArtifact } from '../api/types';

const priorityOrder = ['Must', 'Recommended', 'Exploratory'] as const;
const testTypeOrder = ['Functional', 'Regression', 'Negative', 'Integration', 'Security', 'Performance', 'Exploratory'] as const;
const riskOrder = ['High', 'Medium', 'Low'] as const;

type Priority = (typeof priorityOrder)[number];
type TestType = (typeof testTypeOrder)[number];
type TestRisk = (typeof riskOrder)[number];
type TestCase = ApiTestPlanArtifact['sections'][number]['cases'][number];

function nextPriority(current: Priority): Priority {
  const idx = priorityOrder.indexOf(current);
  return priorityOrder[(idx + 1) % priorityOrder.length];
}

function nextTestType(current: TestType): TestType {
  const idx = testTypeOrder.indexOf(current);
  return testTypeOrder[(idx + 1) % testTypeOrder.length];
}

function nextRisk(current: TestRisk): TestRisk {
  const idx = riskOrder.indexOf(current);
  return riskOrder[(idx + 1) % riskOrder.length];
}

function inferRisk(priority: Priority): TestRisk {
  if (priority === 'Must') return 'High';
  if (priority === 'Recommended') return 'Medium';
  return 'Low';
}

function inferType(priority: Priority): TestType {
  if (priority === 'Must') return 'Regression';
  if (priority === 'Exploratory') return 'Exploratory';
  return 'Functional';
}

function getCaseTitle(testCase: TestCase): string {
  return testCase.title?.trim() || testCase.text?.trim() || 'Validate release behavior';
}

function getCaseObjective(testCase: TestCase): string {
  return testCase.objective?.trim() || testCase.text?.trim() || getCaseTitle(testCase);
}

function getCaseExpected(testCase: TestCase): string {
  return testCase.expected?.trim() || 'Expected behavior is observed and no unexpected error is shown.';
}

function getCasePreconditions(testCase: TestCase): string[] {
  return (testCase.preconditions?.filter(Boolean) ?? []).length
    ? (testCase.preconditions?.filter(Boolean) ?? [])
    : ['Use a build containing this release change.'];
}

function getCaseSteps(testCase: TestCase): string[] {
  return (testCase.steps?.filter(Boolean) ?? []).length
    ? (testCase.steps?.filter(Boolean) ?? [])
    : [`Run scenario: ${getCaseTitle(testCase)}`];
}

function getCaseSourceRefs(testCase: TestCase, area: string): string[] {
  const refs = [...(testCase.sourceRefs ?? []), testCase.source, area].filter(Boolean);
  return Array.from(new Set(refs));
}

function toLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function TestPlanPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [sections, setSections] = useState<ApiTestPlanArtifact['sections'] | null>(null);
  const [checklists, setChecklists] = useState<ApiTestPlanArtifact['checklists'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQueueingChecklists, setIsQueueingChecklists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSections = sections ?? [];

  const totals = useMemo(() => {
    const allCases = effectiveSections.flatMap((section) => section.cases);
    const totalCases = allCases.length;
    const mustTestCount = allCases.filter((testCase) => testCase.priority === 'Must').length;
    const checkedCount = allCases.filter((testCase) => testCase.checked).length;
    const highRiskCount = allCases.filter((testCase) => (testCase.risk ?? inferRisk(testCase.priority)) === 'High').length;
    return { totalCases, mustTestCount, checkedCount, highRiskCount };
  }, [effectiveSections]);

  const markdown = useMemo(() => {
    return effectiveSections
      .map((section) => {
        const lines = section.cases.map((testCase) => {
          const checkbox = testCase.checked ? '[x]' : '[ ]';
          const title = getCaseTitle(testCase);
          const objective = getCaseObjective(testCase);
          const expected = getCaseExpected(testCase);
          const preconditions = getCasePreconditions(testCase);
          const steps = getCaseSteps(testCase);
          const type = testCase.type ?? inferType(testCase.priority);
          const risk = testCase.risk ?? inferRisk(testCase.priority);
          const refs = getCaseSourceRefs(testCase, section.area).join(', ');
          const tags = (testCase.tags ?? []).filter(Boolean).join(', ');

          return [
            `- ${checkbox} (${testCase.priority} | ${type} | ${risk}) ${title}`,
            `  - Objective: ${objective}`,
            `  - Preconditions:`,
            ...preconditions.map((line) => `    - ${line}`),
            `  - Steps:`,
            ...steps.map((line, index) => `    ${index + 1}. ${line}`),
            `  - Expected: ${expected}`,
            `  - Source: ${refs}`,
            tags ? `  - Tags: ${tags}` : '',
          ].filter(Boolean).join('\n');
        });
        return `## ${section.area}\n\n${lines.join('\n\n')}`;
      })
      .join('\n\n');
  }, [effectiveSections]);

  const refresh = async () => {
    if (!api || !sessionId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const artifact = await api.getTestPlanArtifact(sessionId);
      setSections(artifact.sections);
      setChecklists(artifact.checklists ?? null);
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to load';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, sessionId]);

  if (isLoading) {
    return <TestPlanPageSkeleton />;
  }

  const patch = async (operations: ApiPatchTestPlanOp[]) => {
    if (!api || !sessionId) return;
    setError(null);
    try {
      const next = await api.patchTestPlanArtifact(sessionId, { operations });
      setSections(next.sections);
      setChecklists(next.checklists ?? null);
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to save';
      setError(message);
    }
  };

  const updateLocalCase = (caseId: string, patchData: ApiPatchTestPlanCasePatch) => {
    setSections((prev) => {
      if (!prev) return prev;
      return prev.map((section) => ({
        ...section,
        cases: section.cases.map((testCase) => (testCase.id === caseId ? { ...testCase, ...patchData } : testCase)),
      }));
    });
  };

  const getPriorityColor = (priority: Priority) => {
    const colors: Record<Priority, string> = {
      Must: 'bg-red-100 text-red-700 border-red-200',
      Recommended: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      Exploratory: 'bg-blue-100 text-blue-700 border-blue-200',
    };
    return colors[priority];
  };

  const getRiskColor = (risk: TestRisk) => {
    const colors: Record<TestRisk, string> = {
      High: 'bg-red-50 text-red-700 border-red-200',
      Medium: 'bg-amber-50 text-amber-700 border-amber-200',
      Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return colors[risk];
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900 mb-2">Release Test Plan</h1>
              <p className="text-gray-600">
                {totals.checkedCount} of {totals.totalCases} test cases completed
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `test-plan-${sessionId ?? 'draft'}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FileText className="h-4 w-4" />
                Export Markdown
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(markdown);
                  } catch {
                    // ignore
                  }
                }}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button
                variant="outline"
                disabled={!api || !sessionId || isQueueingChecklists}
                onClick={async () => {
                  if (!api || !sessionId) return;
                  setIsQueueingChecklists(true);
                  setError(null);
                  try {
                    await api.queueTestPlanChecklists(sessionId, {});
                    await refresh();
                  } catch (e: unknown) {
                    const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to queue checklists';
                    setError(message);
                  } finally {
                    setIsQueueingChecklists(false);
                  }
                }}
              >
                Generate PR Checklists
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-900">Per-PR Release Checklists</div>
                <div className="text-xs text-gray-500">
                  Template: {checklists?.templateUrl ?? 'default'}
                </div>
              </div>
              <div className="text-xs text-gray-600">
                {checklists?.summary.completed ?? 0} completed / {checklists?.summary.total ?? 0}
              </div>
            </div>
            {checklists?.items?.length ? (
              <div className="space-y-2 max-h-72 overflow-auto">
                {checklists.items
                  .slice()
                  .sort((a, b) => b.prNumber - a.prNumber)
                  .map((item) => (
                    <div key={item.id} className="rounded border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-900 truncate">
                            PR #{item.prNumber} · {item.area}
                          </div>
                          <div className="text-xs text-gray-600 truncate">{item.title}</div>
                        </div>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      {item.error && <div className="text-xs text-red-700">{item.error}</div>}
                      {item.status === 'completed' && item.markdown && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(item.markdown ?? '');
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            Copy MD
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const blob = new Blob([item.markdown ?? ''], { type: 'text/markdown;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `test-checklist-pr-${item.prNumber}.md`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            Download MD
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                No per-PR checklist yet. Click "Generate PR Checklists" to queue async generation.
              </div>
            )}
          </Card>

          <div className="space-y-8">
            {effectiveSections.map((section) => (
              <div key={section.area}>
                <h2 className="text-gray-900 mb-4">## {section.area}</h2>
                <div className="space-y-4">
                  {section.cases.map((testCase) => {
                    const title = getCaseTitle(testCase);
                    const objective = getCaseObjective(testCase);
                    const expected = getCaseExpected(testCase);
                    const preconditions = getCasePreconditions(testCase);
                    const steps = getCaseSteps(testCase);
                    const type = testCase.type ?? inferType(testCase.priority);
                    const risk = testCase.risk ?? inferRisk(testCase.priority);

                    return (
                      <Card key={testCase.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`case-${testCase.id}`}
                            checked={testCase.checked}
                            onCheckedChange={() =>
                              patch([{ op: testCase.checked ? 'uncheck' : 'check', caseId: testCase.id }])
                            }
                            className="mt-1"
                            disabled={!api || !sessionId}
                          />
                          <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Scenario</div>
                              <Textarea
                                value={title}
                                className="min-h-[40px]"
                                onChange={(e) => updateLocalCase(testCase.id, { title: e.target.value, text: e.target.value })}
                                onBlur={(e) => patch([{ op: 'updateCase', caseId: testCase.id, patch: { title: e.target.value, text: e.target.value } }])}
                                disabled={!api || !sessionId}
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Objective</div>
                              <Textarea
                                value={objective}
                                className="min-h-[40px]"
                                onChange={(e) => updateLocalCase(testCase.id, { objective: e.target.value })}
                                onBlur={(e) => patch([{ op: 'updateCase', caseId: testCase.id, patch: { objective: e.target.value } }])}
                                disabled={!api || !sessionId}
                              />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <div className="text-xs uppercase tracking-wide text-gray-500">Preconditions (one per line)</div>
                                <Textarea
                                  value={preconditions.join('\n')}
                                  className="min-h-[90px]"
                                  onChange={(e) => updateLocalCase(testCase.id, { preconditions: toLines(e.target.value) })}
                                  onBlur={(e) => patch([{ op: 'updateCase', caseId: testCase.id, patch: { preconditions: toLines(e.target.value) } }])}
                                  disabled={!api || !sessionId}
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs uppercase tracking-wide text-gray-500">Steps (one per line)</div>
                                <Textarea
                                  value={steps.join('\n')}
                                  className="min-h-[90px]"
                                  onChange={(e) => updateLocalCase(testCase.id, { steps: toLines(e.target.value) })}
                                  onBlur={(e) => patch([{ op: 'updateCase', caseId: testCase.id, patch: { steps: toLines(e.target.value) } }])}
                                  disabled={!api || !sessionId}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs uppercase tracking-wide text-gray-500">Expected Result</div>
                              <Textarea
                                value={expected}
                                className="min-h-[40px]"
                                onChange={(e) => updateLocalCase(testCase.id, { expected: e.target.value })}
                                onBlur={(e) => patch([{ op: 'updateCase', caseId: testCase.id, patch: { expected: e.target.value } }])}
                                disabled={!api || !sessionId}
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={!api || !sessionId}
                                onClick={() => patch([{ op: 'changePriority', caseId: testCase.id, priority: nextPriority(testCase.priority) }])}
                              >
                                <Badge variant="outline" className={getPriorityColor(testCase.priority)}>
                                  {testCase.priority}
                                </Badge>
                              </button>
                              <button
                                type="button"
                                disabled={!api || !sessionId}
                                onClick={() => patch([{ op: 'updateCase', caseId: testCase.id, patch: { type: nextTestType(type) } }])}
                              >
                                <Badge variant="outline">{type}</Badge>
                              </button>
                              <button
                                type="button"
                                disabled={!api || !sessionId}
                                onClick={() => patch([{ op: 'updateCase', caseId: testCase.id, patch: { risk: nextRisk(risk) } }])}
                              >
                                <Badge variant="outline" className={getRiskColor(risk)}>
                                  {risk} Risk
                                </Badge>
                              </button>
                              <span className="text-xs text-gray-500">
                                Sources: {getCaseSourceRefs(testCase, section.area).join(', ')}
                              </span>
                            </div>

                            {(testCase.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(testCase.tags ?? []).map((tag) => (
                                  <Badge key={`${testCase.id}-${tag}`} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {api && sessionId && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={refresh}>
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="w-80 border-l border-gray-200 p-6 bg-gray-50">
        <h3 className="text-gray-900 mb-4">Summary</h3>
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total cases</span>
              <span className="text-gray-900">{totals.totalCases}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Must-test</span>
              <span className="text-gray-900">{totals.mustTestCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">High-risk cases</span>
              <span className="text-gray-900">{totals.highRiskCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Areas covered</span>
              <span className="text-gray-900">{effectiveSections.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completed</span>
              <span className="text-gray-900">
                {totals.checkedCount} / {totals.totalCases}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600 mb-2">Progress</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${totals.totalCases === 0 ? 0 : (totals.checkedCount / totals.totalCases) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
