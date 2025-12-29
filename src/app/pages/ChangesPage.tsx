import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, RefreshCw, ChevronRight, ExternalLink, X } from 'lucide-react';
import { cn } from '../components/ui/utils';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { ChangesPageSkeleton } from '../components/skeletons/ArtifactSkeletons';
import { useSessions } from '../context/SessionContext';
import type { ApiChangesArtifact } from '../api/types';

type ChangeItem = ApiChangesArtifact['items'][number];

export function ChangesPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { sessions } = useSessions();
  const session = sessions.find((s) => s.id === sessionId);
  const repoFullName = session?.repoFullName;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [items, setItems] = useState<ChangeItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterArea, setFilterArea] = useState<string>('__all__');
  const [filterRisk, setFilterRisk] = useState<string>('__all__');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract unique areas and risks from items for filter dropdowns
  const uniqueAreas = useMemo(() => {
    if (!items) return [];
    const areas = [...new Set(items.map((c) => c.area))].filter(Boolean).sort();
    return areas;
  }, [items]);

  const uniqueRisks = useMemo(() => {
    if (!items) return [];
    // Fixed order for risk levels
    const riskOrder = ['High', 'Medium', 'Low'];
    const risks = [...new Set(items.map((c) => c.risk))].filter(Boolean);
    return riskOrder.filter((r) => risks.includes(r as any));
  }, [items]);

  const openPr = (prNumber: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!repoFullName) return;
    window.open(`https://github.com/${repoFullName}/pull/${prNumber}`, '_blank');
  };

  const refresh = async () => {
    if (!api || !sessionId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const artifact = await api.getChangesArtifact(sessionId);
      setItems(artifact.items);
      setSelectedId((prev) => prev ?? artifact.items[0]?.id ?? null);
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
    return <ChangesPageSkeleton />;
  }

  const filtered = (items ?? []).filter((c) => {
    // Apply area filter
    if (filterArea !== '__all__' && c.area !== filterArea) return false;
    // Apply risk filter
    if (filterRisk !== '__all__' && c.risk !== filterRisk) return false;
    // Apply text search
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      c.title,
      String(c.number),
      c.author,
      c.area,
      c.type,
      c.risk,
      ...(c.signals ?? []),
      ...(c.files ?? []).map((f) => f.path),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const hasActiveFilters = filterArea !== '__all__' || filterRisk !== '__all__';
  const clearFilters = () => {
    setFilterArea('__all__');
    setFilterRisk('__all__');
  };

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  const getAreaColor = (area: string) => {
    const colors: Record<string, string> = {
      FancyZones: 'bg-purple-100 text-purple-700 border-purple-200',
      CmdPal: 'bg-blue-100 text-blue-700 border-blue-200',
      Workspaces: 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[area] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      High: 'bg-red-100 text-red-700 border-red-200',
      Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      Low: 'bg-green-100 text-green-700 border-green-200',
    };
    return colors[risk] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search PR title, files..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Area filter dropdown */}
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Areas</SelectItem>
              {uniqueAreas.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Risk filter dropdown */}
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Risks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Risks</SelectItem>
              {uniqueRisks.map((risk) => (
                <SelectItem key={risk} value={risk}>
                  {risk}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-gray-500">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}

          <Button variant="outline" size="icon" onClick={refresh} disabled={!api || !sessionId || isLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      {/* Two independent scrolling panels */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - PR list with independent scroll */}
        <div className="w-2/5 border-r border-gray-200 overflow-y-auto bg-gray-50">
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-3">{filtered.length} changes (by PR)</div>

            <div className="space-y-2">
              {filtered.map((change) => (
                <Card
                  key={change.id}
                  className={cn(
                    'p-4 cursor-pointer transition-all hover:shadow-md relative',
                    selected?.id === change.id ? 'ring-2 ring-blue-500 bg-white' : 'bg-white hover:bg-gray-50'
                  )}
                  onClick={() => setSelectedId(change.id)}
                >
                  <div className="space-y-2">
                    <h4 className="text-gray-900 line-clamp-2 pr-6">
                      {change.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                      <span>#{change.number}</span>
                      <span>•</span>
                      <span>{change.author}</span>
                      <span>•</span>
                      <span>{change.filesChanged} files</span>
                      <span>•</span>
                      <span className="text-green-600">+{change.additions}</span>
                      <span className="text-red-600">-{change.deletions}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getAreaColor(change.area)}>
                        {change.area}
                      </Badge>
                      <Badge variant="outline" className={getRiskColor(change.risk)}>
                        {change.risk}
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </Card>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-8 text-gray-500">No changes found.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel - Detail view with independent scroll */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selected ? (
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <h2
                  className="text-gray-900 hover:text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-2"
                  onClick={() => openPr(selected.number)}
                  title="Open PR in GitHub"
                >
                  {selected.title}
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={getAreaColor(selected.area)}>
                    {selected.area}
                  </Badge>
                  <Badge variant="outline" className={getRiskColor(selected.risk)}>
                    Risk: {selected.risk}
                  </Badge>
                  <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                    {selected.type}
                  </Badge>
                </div>
              </div>

              <Tabs defaultValue="files" className="w-full">
                <TabsList>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="signals">Signals</TabsTrigger>
                </TabsList>

                <TabsContent value="files" className="mt-4">
                  <div className="space-y-2">
                    {(selected.files ?? []).map((f) => (
                      <div
                        key={f.path}
                        className="font-mono text-sm p-3 rounded-lg bg-gray-50 border border-gray-200"
                      >
                        <span className="break-all">{f.path}</span>
                        <span className="text-green-600 ml-2">+{f.additions}</span>
                        <span className="text-red-600 ml-1">-{f.deletions}</span>
                      </div>
                    ))}
                    {(selected.files ?? []).length === 0 && (
                      <div className="text-sm text-gray-600">No file details available.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="signals" className="mt-4">
                  <div className="space-y-3">
                    {(selected.signals ?? []).map((signal) => (
                      <Card key={signal} className="p-4 bg-amber-50 border-amber-200">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-2" />
                          <div className="flex-1">
                            <div className="text-gray-900">{signal}</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {(selected.signals ?? []).length === 0 && (
                      <div className="text-sm text-gray-600">No signals detected.</div>
                    )}
                  </div>
                </TabsContent>

              </Tabs>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a PR to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

