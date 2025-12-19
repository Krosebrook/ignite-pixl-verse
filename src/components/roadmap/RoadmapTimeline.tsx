import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock } from "lucide-react";

interface Phase {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "planned";
  progress: number;
  timeline: string;
}

interface RoadmapTimelineProps {
  phases: Phase[];
}

export function RoadmapTimeline({ phases }: RoadmapTimelineProps) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute top-6 left-0 right-0 h-1 bg-border rounded-full" />
      
      {/* Progress overlay */}
      <div 
        className="absolute top-6 left-0 h-1 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
        style={{ 
          width: `${phases.reduce((acc, p, i) => {
            if (p.status === "completed") return acc + (100 / phases.length);
            if (p.status === "in-progress") return acc + ((p.progress / 100) * (100 / phases.length));
            return acc;
          }, 0)}%` 
        }}
      />

      {/* Phase markers */}
      <div className="relative flex justify-between">
        {phases.map((phase, index) => (
          <div key={phase.id} className="flex flex-col items-center w-1/4">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300",
                phase.status === "completed" && "bg-success border-success text-success-foreground",
                phase.status === "in-progress" && "bg-warning border-warning text-warning-foreground animate-pulse",
                phase.status === "planned" && "bg-card border-border text-muted-foreground"
              )}
            >
              {phase.status === "completed" && <CheckCircle2 className="h-5 w-5" />}
              {phase.status === "in-progress" && <Clock className="h-5 w-5" />}
              {phase.status === "planned" && <Circle className="h-5 w-5" />}
            </div>
            <div className="mt-4 text-center">
              <p className="font-semibold text-sm">{phase.timeline}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[120px]">
                {phase.title.split(' ').slice(0, 2).join(' ')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
