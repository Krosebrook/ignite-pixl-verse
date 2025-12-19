import { AlertTriangle, CheckCircle2, XCircle, Info, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ValidationResult, ValidationIssue } from "@/lib/brandValidation";

interface BrandValidatorProps {
  result: ValidationResult;
  isValidating: boolean;
  brandKitName?: string;
  onOverride?: () => void;
  showOverride?: boolean;
}

export function BrandValidator({ 
  result, 
  isValidating, 
  brandKitName,
  onOverride,
  showOverride = false
}: BrandValidatorProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return "bg-success/20";
    if (score >= 50) return "bg-warning/20";
    return "bg-destructive/20";
  };

  const getIssueIcon = (issue: ValidationIssue) => {
    if (issue.type === "error") {
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    }
    return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
  };

  const errorCount = result.issues.filter(i => i.type === "error").length;
  const warningCount = result.issues.filter(i => i.type === "warning").length;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Brand Compliance</span>
          {brandKitName && (
            <Badge variant="outline" className="text-xs">{brandKitName}</Badge>
          )}
        </div>
        
        <div className={cn(
          "px-3 py-1 rounded-full text-sm font-bold",
          getScoreBackground(result.score),
          getScoreColor(result.score)
        )}>
          {isValidating ? "..." : `${result.score}%`}
        </div>
      </div>

      <Progress 
        value={result.score} 
        className={cn("h-2", isValidating && "animate-pulse")}
      />

      {result.issues.length === 0 ? (
        <div className="flex items-center gap-2 text-success text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>All brand guidelines met</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3 w-3" /> {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" /> {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {result.issues.map((issue, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg text-sm",
                  issue.type === "error" ? "bg-destructive/10" : "bg-warning/10"
                )}
              >
                {getIssueIcon(issue)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{issue.message}</p>
                  {issue.suggestion && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      {issue.suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOverride && !result.isValid && onOverride && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs"
          onClick={onOverride}
        >
          Override & Continue Anyway
        </Button>
      )}
    </Card>
  );
}
