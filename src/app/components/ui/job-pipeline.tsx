import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '../ui/utils';

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
type JobType = 'parse-changes' | 'generate-notes' | 'analyze-hotspots' | 'generate-testplan';

interface Job {
  type: JobType;
  status: JobStatus;
  progress: number;
}

interface JobPipelineProps {
  jobs: Job[];
  className?: string;
}

const JOB_LABELS: Record<JobType, string> = {
  'parse-changes': 'Parsing Changes',
  'generate-notes': 'Generating Notes',
  'analyze-hotspots': 'Analyzing Hotspots',
  'generate-testplan': 'Generating Test Plan',
};

const JOB_ORDER: JobType[] = ['parse-changes', 'generate-notes', 'analyze-hotspots', 'generate-testplan'];

export function JobPipeline({ jobs, className }: JobPipelineProps) {
  const jobMap = new Map(jobs.map((j) => [j.type, j]));
  
  const sortedJobs = JOB_ORDER.map((type) => jobMap.get(type)).filter(Boolean) as Job[];
  
  if (sortedJobs.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1 flex-wrap', className)}>
      {sortedJobs.map((job, index) => (
        <div key={job.type} className="flex items-center">
          <JobStep job={job} />
          {index < sortedJobs.length - 1 && (
            <div className="w-2 h-px bg-gray-300 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

function JobStep({ job }: { job: Job }) {
  const label = JOB_LABELS[job.type];
  
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
        job.status === 'completed' && 'bg-emerald-50 text-emerald-700',
        job.status === 'running' && 'bg-blue-50 text-blue-700',
        job.status === 'pending' && 'bg-gray-100 text-gray-500',
        job.status === 'failed' && 'bg-red-50 text-red-700'
      )}
    >
      <JobStatusIcon status={job.status} />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

function JobStatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />;
    case 'failed':
      return <Circle className="h-3.5 w-3.5 text-red-600 fill-red-600" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-400" />;
  }
}
