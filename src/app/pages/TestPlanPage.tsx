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
import type { ApiPatchTestPlanOp, ApiTestPlanArtifact } from '../api/types';

const priorityOrder = ['Must', 'Recommended', 'Exploratory'] as const;
type Priority = (typeof priorityOrder)[number];

function nextPriority(current: Priority): Priority {
  const idx = priorityOrder.indexOf(current);
  return priorityOrder[(idx + 1) % priorityOrder.length];
}

export function TestPlanPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [sections, setSections] = useState<ApiTestPlanArtifact['sections'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveSections = sections ?? [];

  const totals = useMemo(() => {
    const totalCases = effectiveSections.reduce((sum, area) => sum + area.cases.length, 0);
    const mustTestCount = effectiveSections.reduce(
      (sum, area) => sum + area.cases.filter((c) => c.priority === 'Must').length,
      0
    );
    const checkedCount = effectiveSections.reduce(
      (sum, area) => sum + area.cases.filter((c) => c.checked).length,
      0
    );

    return { totalCases, mustTestCount, checkedCount };
  }, [effectiveSections]);

  const markdown = useMemo(() => {
    return effectiveSections
      .map((section) => {
        const lines = section.cases.map((c) => {
          const checkbox = c.checked ? '[x]' : '[ ]';
          return `- ${checkbox} (${c.priority}) ${c.text}`;
        });
        return `## ${section.area}\n\n${lines.join('\n')}`;
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

  // Show skeleton while loading
  if (isLoading) {
    return <TestPlanPageSkeleton />;
  }

  const patch = async (operations: ApiPatchTestPlanOp[]) => {
    if (!api || !sessionId) return;
    setError(null);
    try {
      const next = await api.patchTestPlanArtifact(sessionId, { operations });
      setSections(next.sections);
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to save';
      setError(message);
    }
  };

  const updateLocalText = (caseId: string, text: string) => {
    setSections((prev) => {
      if (!prev) return prev;
      return prev.map((section) => ({
        ...section,
        cases: section.cases.map((c) => (c.id === caseId ? { ...c, text } : c)),
      }));
    });
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      Must: 'bg-red-100 text-red-700 border-red-200',
      Recommended: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      Exploratory: 'bg-blue-100 text-blue-700 border-blue-200',
    };
    return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900 mb-2">Manual Test Plan</h1>
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
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!api || !sessionId}>
                Post to Tracking Issue
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-8">
            {effectiveSections.map((section) => (
              <div key={section.area}>
                <h2 className="text-gray-900 mb-4">## {section.area}</h2>
                <div className="space-y-3">
                  {section.cases.map((testCase) => (
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
                        <div className="flex-1 space-y-2">
                          <Textarea
                            value={testCase.text}
                            className="min-h-[40px]"
                            onChange={(e) => updateLocalText(testCase.id, e.target.value)}
                            onBlur={(e) => patch([{ op: 'updateText', caseId: testCase.id, text: e.target.value }])}
                            disabled={!api || !sessionId}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                            disabled={!api || !sessionId}
                              onClick={() =>
                                patch([
                                  {
                                    op: 'changePriority',
                                    caseId: testCase.id,
                                    priority: nextPriority(testCase.priority as Priority),
                                  },
                                ])
                              }
                            >
                              <Badge variant="outline" className={getPriorityColor(testCase.priority)}>
                                {testCase.priority}
                              </Badge>
                            </button>
                            <span className="text-xs text-gray-500">from {testCase.source}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
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
