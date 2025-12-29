import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Save, Sparkles, RefreshCw, Loader2, Check } from 'lucide-react';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { ReleaseNotesPageSkeleton } from '../components/skeletons/ArtifactSkeletons';
import type { ApiPatchReleaseNotesOp, ApiReleaseNotesArtifact } from '../api/types';

export function ReleaseNotesPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [sections, setSections] = useState<ApiReleaseNotesArtifact['sections'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addForm, setAddForm] = useState({ area: '', text: '' });
  const [regeneratingItems, setRegeneratingItems] = useState<Set<string>>(new Set());
  const [filterArea, setFilterArea] = useState<string | null>(null);
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  const [excludingItems, setExcludingItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const effectiveSections = sections ?? [];
  
  // Filter sections based on selected area
  const filteredSections = filterArea 
    ? effectiveSections.filter((s) => s.area === filterArea)
    : effectiveSections;

  const markdown = useMemo(() => {
    return filteredSections
      .map((section) => {
        const lines = section.items.filter((i) => !i.excluded).map((i) => `- ${i.text}`);
        if (lines.length === 0) return null; // Skip sections with no visible items
        return `## ${section.area}\n\n${lines.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');
  }, [filteredSections]);

  const refresh = async () => {
    if (!api || !sessionId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const artifact = await api.getReleaseNotesArtifact(sessionId);
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
    return <ReleaseNotesPageSkeleton />;
  }

  const patch = async (operations: ApiPatchReleaseNotesOp[]) => {
    if (!api || !sessionId) return;
    setError(null);
    try {
      const next = await api.patchReleaseNotesArtifact(sessionId, { operations });
      setSections(next.sections);
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to save';
      setError(message);
    }
  };

  const regenerateItem = async (itemId: string) => {
    if (!api || !sessionId) return;
    setError(null);
    setRegeneratingItems((prev) => new Set(prev).add(itemId));
    try {
      await api.regenerateReleaseNoteItem(sessionId, itemId);
      // Start polling for completion
      const pollInterval = setInterval(async () => {
        try {
          const artifact = await api.getReleaseNotesArtifact(sessionId);
          const item = artifact.sections
            .flatMap((s) => s.items)
            .find((i) => i.id === itemId);
          if (item && item.status !== 'regenerating') {
            clearInterval(pollInterval);
            setRegeneratingItems((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
            setSections(artifact.sections);
          }
        } catch {
          clearInterval(pollInterval);
          setRegeneratingItems((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      }, 2000);
      // Clear interval after 60 seconds as timeout
      setTimeout(() => {
        clearInterval(pollInterval);
        setRegeneratingItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }, 60000);
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as any).message) : 'Failed to regenerate';
      setError(message);
      setRegeneratingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const updateLocalText = (itemId: string, text: string) => {
    setSections((prev) => {
      if (!prev) return prev;
      return prev.map((section) => ({
        ...section,
        items: section.items.map((item) => (item.id === itemId ? { ...item, text } : item)),
      }));
    });
  };

  return (
    <div className="h-full flex">
      <div className="w-64 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
        <h3 className="text-gray-900 mb-3">Areas</h3>
        <div className="space-y-1">
          {/* All areas option */}
          <div
            className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
              filterArea === null
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setFilterArea(null)}
          >
            All Areas ({effectiveSections.reduce((sum, s) => sum + s.items.filter((i) => !i.excluded).length, 0)})
          </div>
          {effectiveSections.map((section) => (
            <div
              key={section.area}
              className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${
                filterArea === section.area
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setFilterArea(section.area)}
            >
              {section.area} ({section.items.filter((i) => !i.excluded).length})
            </div>
          ))}
        </div>
      </div>

      <div className="w-[45%] p-6 overflow-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-gray-900">Release Notes</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddItem(true)}>
              Add Item
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" disabled={!api || !sessionId}>
              <Sparkles className="h-4 w-4" />
              Regenerate
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {filteredSections.map((section) => (
            <div key={section.area}>
              <h2 className="text-gray-900 mb-4">{section.area}</h2>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <Card
                    key={item.id}
                    className={item.excluded ? 'p-4 space-y-3 opacity-60 bg-gray-50' : 'p-4 space-y-3'}
                  >
                    <Textarea
                      value={item.text}
                      className="min-h-[60px] text-gray-900"
                      onChange={(e) => updateLocalText(item.id, e.target.value)}
                      disabled={!api || !sessionId}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>
                          Source: {item.source.kind === 'pr' ? `#${item.source.ref}` : item.source.ref}
                        </span>
                        <Badge variant="outline">{section.area}</Badge>
                        {(item.status === 'regenerating' || regeneratingItems.has(item.id)) && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Regenerating
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {item.source.kind === 'commit' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!api || !sessionId || item.status === 'regenerating' || regeneratingItems.has(item.id)}
                            onClick={() => regenerateItem(item.id)}
                            title="Regenerate this item"
                          >
                            {regeneratingItems.has(item.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!api || !sessionId || savingItems.has(item.id)}
                          onClick={async () => {
                            setSavingItems((prev) => new Set(prev).add(item.id));
                            await patch([{ op: 'updateText', itemId: item.id, text: item.text }]);
                            setSavingItems((prev) => {
                              const next = new Set(prev);
                              next.delete(item.id);
                              return next;
                            });
                          }}
                          title="Save changes"
                        >
                          {savingItems.has(item.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-[72px]"
                          disabled={!api || !sessionId || excludingItems.has(item.id)}
                          onClick={async () => {
                            setExcludingItems((prev) => new Set(prev).add(item.id));
                            await patch([{ op: item.excluded ? 'include' : 'exclude', itemId: item.id }]);
                            setExcludingItems((prev) => {
                              const next = new Set(prev);
                              next.delete(item.id);
                              return next;
                            });
                          }}
                        >
                          {excludingItems.has(item.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            item.excluded ? 'Include' : 'Exclude'
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {api && sessionId && (
          <div className="mt-6">
            <Button variant="outline" size="sm" onClick={refresh}>
              Refresh
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 border-l border-gray-200 p-6 bg-gray-50 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-900">Preview</h3>
          <Button
            variant="outline"
            size="sm"
            className="w-[80px]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(markdown);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // ignore
              }
            }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              'Copy'
            )}
          </Button>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm space-y-4 font-mono whitespace-pre-wrap">
          {markdown}
        </div>
      </div>

      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add Release Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                placeholder="e.g., FancyZones"
                value={addForm.area}
                onChange={(e) => setAddForm((p) => ({ ...p, area: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">Text</Label>
              <Textarea
                id="text"
                placeholder="Release note text…"
                value={addForm.text}
                onChange={(e) => setAddForm((p) => ({ ...p, text: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!api || !sessionId || !addForm.area.trim() || !addForm.text.trim()}
                onClick={async () => {
                  await patch([{ op: 'addItem', itemId: '', area: addForm.area.trim(), text: addForm.text.trim() }]);
                  setShowAddItem(false);
                  setAddForm({ area: '', text: '' });
                }}
              >
                Add
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddItem(false);
                  setAddForm({ area: '', text: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
