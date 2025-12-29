import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { ChevronDown } from 'lucide-react';
import { createReleaseAgentApi } from '../api/releaseAgentApi';
import { HotspotsPageSkeleton } from '../components/skeletons/ArtifactSkeletons';

interface Hotspot {
  id: string;
  rank: number;
  area: string;
  score: number;
  drivers: string[];
  contributingPrs: number[];
}

export function HotspotsPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const api = useMemo(() => (apiBaseUrl ? createReleaseAgentApi(apiBaseUrl) : null), [apiBaseUrl]);

  const [hotspots, setHotspots] = useState<Hotspot[] | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!api || !sessionId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const artifact = await api.getHotspotsArtifact(sessionId);
      setHotspots(artifact.items);
      setSelectedHotspot(artifact.items[0] ?? null);
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
    return <HotspotsPageSkeleton />;
  }

  const effectiveHotspots = hotspots ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 mb-2">Manual Test Hotspots</h1>
          <p className="text-gray-600">Ranked by risk signals, touched areas, and change scope.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Adjust Scoring</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Generate Test Plan</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {effectiveHotspots.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-600">No hotspots data available yet. Run the analysis to generate hotspots.</p>
        </Card>
      ) : (
        <>
          {/* Hotspot Rankings */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Area / Feature</TableHead>
                  <TableHead className="w-48">Score</TableHead>
                  <TableHead>Drivers</TableHead>
                  <TableHead className="w-24">PRs</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {effectiveHotspots.map((hotspot) => (
                  <TableRow
                    key={hotspot.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedHotspot(hotspot)}
                  >
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        #{hotspot.rank}
                      </Badge>
                    </TableCell>
                    <TableCell>{hotspot.area}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Progress value={hotspot.score} className="h-2" />
                        </div>
                        <span className="text-sm text-gray-700 w-12">{hotspot.score}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {hotspot.drivers.slice(0, 3).map((driver) => (
                          <Badge key={driver} variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            {driver}
                          </Badge>
                        ))}
                        {hotspot.drivers.length > 3 && (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs">
                            +{hotspot.drivers.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{hotspot.contributingPrs.length}</TableCell>
                    <TableCell>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Hotspot Details */}
          {selectedHotspot && (
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="text-gray-900 mb-1">{selectedHotspot.area}</h2>
                <p className="text-gray-600">Score: {selectedHotspot.score} | {selectedHotspot.contributingPrs.length} contributing PRs</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-gray-900 mb-3">Risk Drivers</h3>
                  <div className="space-y-2">
                    {selectedHotspot.drivers.map((driver) => (
                      <div key={driver} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-700">{driver}</div>
                      </div>
                    ))}
                  </div>
                </div>

              <div>
                <h3 className="text-gray-900 mb-3">Contributing PRs</h3>
                <div className="space-y-2">
                  {selectedHotspot.contributingPrs.length > 0 ? (
                    selectedHotspot.contributingPrs.map((prNum) => (
                      <div key={prNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                        <a href="#" className="text-blue-600 hover:underline">PR #{prNum}</a>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                      No contributing PRs data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-gray-900 mb-3">Suggested Test Focus</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Review changes in this area</li>
              </ul>
            </div>
          </Card>
        )}
        </>
      )}
    </div>
  );
}
