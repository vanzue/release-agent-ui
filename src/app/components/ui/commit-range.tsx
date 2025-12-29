import { GitCommit, Tag, GitBranch, ArrowRight } from 'lucide-react';
import { cn } from '../ui/utils';

interface CommitRangeProps {
  baseRef: string;
  headRef: string;
  className?: string;
  size?: 'sm' | 'md';
}

function getRefIcon(refName: string) {
  // Check if it looks like a tag (starts with v, contains numbers)
  if (/^v?\d/.test(refName) || refName.includes('.')) {
    return Tag;
  }
  // Check if it looks like a commit hash (40 chars or 7 chars hex)
  if (/^[a-f0-9]{7,40}$/i.test(refName)) {
    return GitCommit;
  }
  // Default to branch
  return GitBranch;
}

function RefBadge({ refName, size = 'md' }: { refName: string; size?: 'sm' | 'md' }) {
  const Icon = getRefIcon(refName);
  const isSmall = size === 'sm';
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono rounded border bg-white',
        isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        'text-gray-700 border-gray-200 hover:border-gray-300 transition-colors'
      )}
    >
      <Icon className={cn('text-gray-400', isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      <span className="truncate max-w-[120px]">{refName}</span>
    </span>
  );
}

export function CommitRange({ baseRef, headRef, className, size = 'md' }: CommitRangeProps) {
  const isSmall = size === 'sm';
  
  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <RefBadge refName={baseRef} size={size} />
      <ArrowRight className={cn('text-gray-400 flex-shrink-0', isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      <RefBadge refName={headRef} size={size} />
    </div>
  );
}
