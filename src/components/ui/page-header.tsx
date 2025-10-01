import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 space-y-4", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="p-3 rounded-xl bg-primary/10 shadow-glow">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-bold font-display tracking-tight bg-gradient-hero bg-clip-text text-transparent">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-lg text-muted-foreground max-w-2xl">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
