import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface RoadmapPhaseProps {
  phase: Phase;
  index: number;
  getStatusIcon: (status: Task["status"]) => React.ReactNode;
  getStatusBadge: (status: Phase["status"]) => React.ReactNode;
}

export function RoadmapPhase({ phase, index, getStatusIcon, getStatusBadge }: RoadmapPhaseProps) {
  const [isOpen, setIsOpen] = useState(phase.status === "in-progress");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(
          "overflow-hidden transition-all duration-300",
          phase.status === "in-progress" && "border-warning/50 shadow-[var(--shadow-glow)]"
        )}
      >
        <CollapsibleTrigger className="w-full">
          <div className="p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  phase.status === "completed" && "bg-success/20 text-success",
                  phase.status === "in-progress" && "bg-warning/20 text-warning",
                  phase.status === "planned" && "bg-muted text-muted-foreground"
                )}
              >
                {phase.icon}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{phase.title}</h3>
                  {getStatusBadge(phase.status)}
                </div>
                <p className="text-sm text-muted-foreground">{phase.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{phase.timeline}</p>
                <p className="text-xs text-muted-foreground">{phase.progress}% complete</p>
              </div>
              <div className="w-24">
                <Progress value={phase.progress} className="h-2" />
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-6 pb-6 border-t border-border">
            <div className="grid gap-3 mt-4">
              {phase.tasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors",
                    task.status === "completed" && "bg-success/10",
                    task.status === "in-progress" && "bg-warning/10",
                    task.status === "planned" && "bg-muted/50"
                  )}
                >
                  {getStatusIcon(task.status)}
                  <div className="flex-1">
                    <p className={cn(
                      "font-medium",
                      task.status === "completed" && "line-through text-muted-foreground"
                    )}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
