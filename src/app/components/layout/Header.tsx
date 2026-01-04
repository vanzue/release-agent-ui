import { useParams, Link } from 'react-router-dom';
import { Settings, HelpCircle, User, Sparkles, ChevronRight, GitBranch } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Input } from '../ui/input';
import { useSessions } from '../../context/SessionContext';
import { useRepo } from '../../context/RepoContext';
import { ShipwiseIcon } from '../icons/ShipwiseIcon';

export function Header() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { sessions } = useSessions();
  const { repo, setRepo } = useRepo();
  const session = sessions.find((s) => s.id === sessionId);

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-50 text-slate-600 border-slate-200';
      case 'generating': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'ready': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'exported': return 'bg-violet-50 text-violet-600 border-violet-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-gray-200/80 flex items-center px-6 gap-6 shrink-0 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2.5 group">
        <ShipwiseIcon size={28} className="text-gray-900" />
        <h1 className="text-gray-900 font-semibold tracking-tight">Shipwise</h1>
      </Link>

      {session && (
        <>
          <div className="h-6 w-px bg-gray-200" />
          
          <div className="flex items-center gap-2 flex-1">
            <Link to="/sessions" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Sessions
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-300" />
            <span className="text-sm font-medium text-gray-900">{session.name}</span>
            <Badge variant="outline" className={`${getSessionStatusColor(session.status)} text-xs font-medium`}>
              {session.status === 'generating' && <Sparkles className="h-3 w-3 mr-1 animate-pulse" />}
              {session.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/sessions/${sessionId}/exports`}>
              <Button
                variant="dark"
                disabled={session.status !== 'ready'}
              >
                Export
              </Button>
            </Link>
          </div>
        </>
      )}

      <div className="flex items-center gap-1 ml-auto">
        <div className="flex items-center gap-2 mr-4">
          <GitBranch className="h-4 w-4 text-gray-400" />
          <Input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo"
            className="w-48 h-8 text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
          <Settings className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
          <HelpCircle className="h-5 w-5" />
        </Button>
        <Avatar className="h-8 w-8 ml-2 ring-2 ring-gray-100 hover:ring-gray-200 transition-all cursor-pointer">
          <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
