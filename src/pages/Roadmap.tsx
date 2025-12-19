import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { RoadmapPhase } from "@/components/roadmap/RoadmapPhase";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, Rocket, Zap, Shield, Globe } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "planned";
  description?: string;
}

interface Phase {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "completed" | "in-progress" | "planned";
  progress: number;
  timeline: string;
  tasks: Task[];
}

const roadmapData: Phase[] = [
  {
    id: "phase-1",
    title: "MVP Polish & Feature Completion",
    description: "Complete core features and ensure production readiness",
    icon: <Rocket className="h-5 w-5" />,
    status: "in-progress",
    progress: 65,
    timeline: "Q4 2025",
    tasks: [
      { id: "1-1", title: "Brand Kit Enforcement", status: "in-progress", description: "Real-time validation in Content Studio" },
      { id: "1-2", title: "Social Media Platform Integrations", status: "in-progress", description: "OAuth flows for Instagram, Twitter, LinkedIn" },
      { id: "1-3", title: "Translation Workflow", status: "planned", description: "Multi-language content generation" },
      { id: "1-4", title: "Marketplace Pack Installation", status: "completed", description: "Install and manage template packs" },
      { id: "1-5", title: "Monitoring Dashboard", status: "completed", description: "System health and alerting" },
      { id: "1-6", title: "Incident Management", status: "completed", description: "Track and resolve incidents" },
    ],
  },
  {
    id: "phase-2",
    title: "Platform Enhancements",
    description: "Expand capabilities and improve user experience",
    icon: <Zap className="h-5 w-5" />,
    status: "planned",
    progress: 10,
    timeline: "Q1-Q2 2026",
    tasks: [
      { id: "2-1", title: "Video & Music Generation", status: "planned", description: "AI-powered video and audio creation" },
      { id: "2-2", title: "A/B Testing Framework", status: "planned", description: "Experiment with content variations" },
      { id: "2-3", title: "Advanced Analytics", status: "in-progress", description: "Cohort analysis, funnels, predictions" },
      { id: "2-4", title: "Real-Time Collaboration", status: "planned", description: "Comments, approvals, presence" },
    ],
  },
  {
    id: "phase-3",
    title: "Scale & Optimization",
    description: "Optimize performance and expand platform reach",
    icon: <Shield className="h-5 w-5" />,
    status: "planned",
    progress: 0,
    timeline: "Q3 2026",
    tasks: [
      { id: "3-1", title: "Performance Optimization", status: "planned", description: "Lighthouse 95+, SSR, caching" },
      { id: "3-2", title: "Enhanced Security", status: "planned", description: "Advanced rate limiting, anomaly detection" },
      { id: "3-3", title: "Mobile App", status: "planned", description: "React Native iOS and Android apps" },
      { id: "3-4", title: "Third-Party Integrations", status: "planned", description: "Zapier, Slack, webhooks" },
    ],
  },
  {
    id: "phase-4",
    title: "Future Vision",
    description: "AI-powered enhancements and enterprise features",
    icon: <Globe className="h-5 w-5" />,
    status: "planned",
    progress: 0,
    timeline: "2027+",
    tasks: [
      { id: "4-1", title: "AI Campaign Auto-Generation", status: "planned", description: "Full campaigns from brand kits" },
      { id: "4-2", title: "Enterprise SSO", status: "planned", description: "SAML, OIDC, custom roles" },
      { id: "4-3", title: "Marketplace Expansion", status: "planned", description: "Third-party submissions, revenue sharing" },
      { id: "4-4", title: "White-Label Solution", status: "planned", description: "Agency-ready customization" },
    ],
  },
];

const getStatusIcon = (status: Task["status"]) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "in-progress":
      return <Clock className="h-4 w-4 text-warning" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: Phase["status"]) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-success/20 text-success border-success/30">Completed</Badge>;
    case "in-progress":
      return <Badge className="bg-warning/20 text-warning border-warning/30">In Progress</Badge>;
    default:
      return <Badge variant="outline">Planned</Badge>;
  }
};

export default function Roadmap() {
  const overallProgress = Math.round(
    roadmapData.reduce((acc, phase) => acc + phase.progress, 0) / roadmapData.length
  );

  const completedTasks = roadmapData.flatMap(p => p.tasks).filter(t => t.status === "completed").length;
  const totalTasks = roadmapData.flatMap(p => p.tasks).length;

  return (
    <Layout>
      <PageHeader
        title="Product Roadmap"
        description="Track our progress and see what's coming next for FlashFusion"
      />

      {/* Overall Progress */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Overall Progress</h2>
            <p className="text-muted-foreground">{completedTasks} of {totalTasks} tasks completed</p>
          </div>
          <div className="text-4xl font-bold text-primary">{overallProgress}%</div>
        </div>
        <Progress value={overallProgress} className="h-3" />
      </Card>

      {/* Timeline View */}
      <RoadmapTimeline phases={roadmapData} />

      {/* Detailed Phases */}
      <div className="space-y-6 mt-8">
        {roadmapData.map((phase, index) => (
          <RoadmapPhase
            key={phase.id}
            phase={phase}
            index={index}
            getStatusIcon={getStatusIcon}
            getStatusBadge={getStatusBadge}
          />
        ))}
      </div>
    </Layout>
  );
}
