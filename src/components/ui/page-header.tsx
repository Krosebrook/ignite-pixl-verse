import * as React from "react";
import { LucideIcon, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  showBackButton?: boolean;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, showBackButton = true, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={cn("mb-8 space-y-4", className)}>
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      )}
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
