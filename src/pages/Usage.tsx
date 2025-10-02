import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Activity, TrendingUp, Zap } from "lucide-react";

interface UsageData {
  plan: string;
  used_tokens: number;
  hard_limit_tokens: number;
  month_start: string;
}

export default function Usage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from('usage_credits')
        .select('*')
        .eq('org_id', membership.org_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setUsage(data);
      } else {
        // Initialize default usage
        setUsage({
          plan: 'STARTER',
          used_tokens: 0,
          hard_limit_tokens: 1000000,
          month_start: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Load usage error:', error);
      toast({
        title: "Error",
        description: "Failed to load usage data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="container mx-auto py-8">
        <p>No usage data available</p>
      </div>
    );
  }

  const usagePercent = (usage.used_tokens / usage.hard_limit_tokens) * 100;
  const remaining = usage.hard_limit_tokens - usage.used_tokens;
  const isNearLimit = usagePercent > 80;

  const planLimits = {
    STARTER: { tokens: 1000000, name: 'Starter' },
    PRO: { tokens: 10000000, name: 'Pro' },
    SCALE: { tokens: 100000000, name: 'Scale' },
  };

  const currentPlan = planLimits[usage.plan as keyof typeof planLimits];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Usage & Billing"
        description="Monitor your AI token usage and plan"
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPlan.name}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(currentPlan.tokens / 1000000).toFixed(0)}M tokens/month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(usage.used_tokens / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {(usage.hard_limit_tokens / 1000000).toFixed(0)}M limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(remaining / 1000000).toFixed(2)}M
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(100 - usagePercent).toFixed(1)}% available
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage This Month</CardTitle>
              <CardDescription>
                Billing period: {new Date(usage.month_start).toLocaleDateString()}
              </CardDescription>
            </div>
            {isNearLimit && (
              <Badge variant="destructive">Near Limit</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {(usage.used_tokens / 1000000).toFixed(2)}M of {(usage.hard_limit_tokens / 1000000).toFixed(0)}M
              </span>
              <span className="font-medium">{usagePercent.toFixed(1)}%</span>
            </div>
            <Progress 
              value={usagePercent} 
              className={isNearLimit ? "bg-red-100" : ""}
            />
          </div>

          {isNearLimit && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium">Usage Warning</p>
              <p className="text-sm text-muted-foreground mt-1">
                You're approaching your monthly token limit. Consider upgrading your plan to avoid service interruption.
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-3">Plan Options</h4>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(planLimits).map(([key, plan]) => (
                <div
                  key={key}
                  className={`p-3 border rounded-lg ${
                    usage.plan === key ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="font-medium">{plan.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {(plan.tokens / 1000000).toFixed(0)}M tokens/month
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
