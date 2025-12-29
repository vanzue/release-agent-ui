import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RefSearchCombobox } from '../components/ui/ref-search-combobox';
import { JobPipeline } from '../components/ui/job-pipeline';
import { CommitRange } from '../components/ui/commit-range';
import { useSessions } from '../context/SessionContext';
import { Plus, ChevronRight, RefreshCw, Layers, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function SessionsPage() {
  const navigate = useNavigate();
  const { sessions, createSession, deleteSession, isLoading, error, refresh } = useSessions();
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    repoFullName: 'microsoft/PowerToys',
    baseRef: '',
    headRef: 'main',
  });

  // Auto-refresh when there are generating sessions
  const hasGeneratingSessions = sessions.some((s) => s.status === 'generating');
  useEffect(() => {
    if (!hasGeneratingSessions) return;
    const interval = setInterval(() => {
      refresh();
    }, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [hasGeneratingSessions, refresh]);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createSession({
        name: formData.name || `Draft ${new Date().toLocaleString()}`,
        repoFullName: formData.repoFullName,
        baseRef: formData.baseRef,
        headRef: formData.headRef,
      });
      setShowCreate(false);
      setFormData({ name: '', repoFullName: 'microsoft/PowerToys', baseRef: '', headRef: 'main' });
      // Stay on sessions page to see overall status instead of jumping to specific session
      await refresh();
    } finally {
      setIsCreating(false);
    }
  };

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 border-gray-300',
      generating: 'bg-blue-100 text-blue-700 border-blue-300',
      ready: 'bg-green-100 text-green-700 border-green-300',
      exported: 'bg-purple-100 text-purple-700 border-purple-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const sorted = useMemo(() => [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()), [sessions]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-gray-900 mb-2">Release Drafts</h1>
          <p className="text-gray-600">Generate artifacts for a repo commit range</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2 shadow-sm hover:shadow transition-shadow">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {sorted.length > 0 && (
            <Button 
              variant="dark"
              onClick={() => setShowCreate(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Draft
            </Button>
          )}
        </div>
      </div>

      {error && <Card className="p-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>}

      <div className="grid gap-4">
        {sorted.map((session) => {
          const completedJobs = session.jobs.filter((j) => j.status === 'completed').length;
          const totalJobs = session.jobs.length || 4;
          return (
            <Card key={session.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link to={`/sessions/${session.id}/changes`} className="text-xl text-gray-900 hover:text-blue-600">
                      {session.name}
                    </Link>
                    <Badge variant="outline" className={statusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="font-medium">{session.repoFullName}</span>
                    <CommitRange baseRef={session.baseRef} headRef={session.headRef} size="sm" />
                  </div>
                  {session.status === 'generating' && session.jobs.length > 0 && (
                    <JobPipeline jobs={session.jobs} />
                  )}
                  <div className="text-sm text-gray-500">
                    Created {formatDistanceToNow(session.createdAt, { addSuffix: true })} • {completedJobs}/{totalJobs} jobs complete
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget({ id: session.id, name: session.name })}
                    disabled={session.status === 'generating'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {session.status === 'generating' ? (
                    <Button variant="outline" className="gap-2" disabled>
                      Generating...
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : (
                    <Link to={`/sessions/${session.id}/changes`}>
                      <Button variant="outline" className="gap-2">
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <Card className="p-16 text-center border-dashed border-2 bg-gray-50/50">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-gray-100">
              <Layers className="h-8 w-8 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">No release drafts yet</h3>
              <p className="text-gray-500 max-w-sm">Create your first draft to start generating release notes.</p>
            </div>
            <Button 
              variant="dark"
              onClick={() => setShowCreate(true)} 
              className="gap-2 mt-2"
            >
              <Plus className="h-4 w-4" />
              Create First Draft
            </Button>
          </div>
        </Card>
      )}

      {/* Create Release Draft Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create Release Draft</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="e.g., Mid-way testing"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo">Repository</Label>
              <Select
                value={formData.repoFullName}
                onValueChange={(value) => setFormData({ ...formData, repoFullName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="microsoft/PowerToys">microsoft/PowerToys</SelectItem>
                  <SelectItem value="microsoft/terminal">microsoft/terminal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseRef">Base ref</Label>
                <RefSearchCombobox
                  repo={formData.repoFullName}
                  value={formData.baseRef}
                  onChange={(value) => setFormData({ ...formData, baseRef: value })}
                  placeholder="Search tag, branch, or commit..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headRef">Head ref</Label>
                <RefSearchCombobox
                  repo={formData.repoFullName}
                  value={formData.headRef}
                  onChange={(value) => setFormData({ ...formData, headRef: value })}
                  placeholder="Search tag, branch, or commit..."
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="dark"
                onClick={handleCreate}
                className="flex-1 gap-2"
                disabled={isCreating || !formData.repoFullName.trim() || !formData.baseRef.trim() || !formData.headRef.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Start'
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1" disabled={isCreating}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Release Draft</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This will permanently remove the draft and all its data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteTarget) {
                  await deleteSession(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              className="flex-1"
            >
              Delete
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

