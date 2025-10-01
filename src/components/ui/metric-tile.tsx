import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MetricTileProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color?: "primary" | "secondary" | "accent";
  trend?: "up" | "down";
  className?: string;
}

const colorVariants = {
  primary: {
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    glow: "shadow-glow",
  },
  secondary: {
    iconBg: "bg-secondary/10",
    iconText: "text-secondary",
    glow: "shadow-glow-secondary",
  },
  accent: {
    iconBg: "bg-accent/10",
    iconText: "text-accent",
    glow: "shadow-glow-accent",
  },
};

export function MetricTile({
  title,
  value,
  change,
  icon: Icon,
  color = "primary",
  trend,
  className,
}: MetricTileProps) {
  const colorClass = colorVariants[color];
  const changeIsPositive = change && change > 0;
  const displayChange = change ? (changeIsPositive ? `+${change}%` : `${change}%`) : null;

  return (
    <Card className={cn("group hover:scale-[1.02] transition-all", colorClass.glow, className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg transition-all", colorClass.iconBg)}>
          <Icon className={cn("h-4 w-4", colorClass.iconText)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="text-3xl font-bold font-display tracking-tight">{value}</div>
          {displayChange && (
            <div
              className={cn(
                "text-xs font-semibold px-2 py-1 rounded-full",
                changeIsPositive
                  ? "bg-green-500/10 text-green-500"
                  : "bg-red-500/10 text-red-500"
              )}
              aria-label={`${changeIsPositive ? "Increased" : "Decreased"} by ${Math.abs(change)}%`}
            >
              {displayChange}
            </div>
          )}
        </div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-2">
            Trending {trend === "up" ? "upward" : "downward"} this week
          </p>
        )}
      </CardContent>
    </Card>
  );
}
