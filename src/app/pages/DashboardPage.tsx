import { Link } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ShipwiseIcon } from '../components/icons/ShipwiseIcon';
import { 
  Layers,
  FileText,
  ArrowRight,
  GitBranch,
  TestTube,
  AlertTriangle
} from 'lucide-react';

export function DashboardPage() {
  const features = [
    {
      icon: <FileText className="h-6 w-6" />,
      title: 'Release Notes',
      description: 'Auto-generate comprehensive release notes from your commits',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: <AlertTriangle className="h-6 w-6" />,
      title: 'Hotspots Analysis',
      description: 'Identify high-risk areas that need extra testing attention',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      icon: <TestTube className="h-6 w-6" />,
      title: 'Test Plan Generation',
      description: 'Generate targeted test plans based on code changes',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: <GitBranch className="h-6 w-6" />,
      title: 'Commit Intelligence',
      description: 'Deep analysis of commits with AI-powered summaries',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-8">
        <div className="flex justify-center">
          <ShipwiseIcon size={80} className="text-gray-900" />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Shipwise
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            AI-powered release management that generates release notes, identifies hotspots, and creates test plans from your commits.
          </p>
        </div>
        <div className="pt-4">
          <Link to="/sessions">
            <Button variant="dark" size="lg" className="gap-2 shadow-lg hover:shadow-xl text-lg px-8 py-6">
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900 text-center">Features</h2>
        <div className="grid grid-cols-2 gap-6">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className="p-6 hover:shadow-lg transition-all duration-200 group cursor-default"
            >
              <div className="flex gap-4">
                <div className={`p-3 rounded-xl ${feature.bg} ${feature.color} group-hover:scale-110 transition-transform duration-200`}>
                  {feature.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-500 text-sm">{feature.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      <Card className="p-8 bg-gradient-to-br from-gray-50 to-white border-dashed border-2">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Ready to analyze your repository?</h3>
            </div>
            <p className="text-gray-500">Create a session to start generating release artifacts.</p>
          </div>
          <Link to="/sessions">
            <Button variant="dark" className="gap-2">
              Go to Sessions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
