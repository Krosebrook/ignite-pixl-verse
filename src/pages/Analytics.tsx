import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { TipsCard } from "@/components/ui/tips-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AnalyticsLineChart, 
  AnalyticsBarChart, 
  AnalyticsPieChart,
  MetricCard 
} from "@/components/analytics/AnalyticsCharts";
import { BarChart3, TrendingUp, Users, Zap } from "lucide-react";
import { format, subDays } from "date-fns";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30");
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // Fetch user's organizations
  const { data: orgs } = useQuery({
    queryKey: ["user-orgs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("members")
        .select("org_id, orgs(id, name)")
        .eq("user_id", user.id);

      if (error) throw error;
      return data?.map(m => ({ id: m.orgs.id, name: m.orgs.name })) || [];
    },
  });

  // Auto-select first org
  useEffect(() => {
    if (orgs && orgs.length > 0 && !selectedOrg) {
      setSelectedOrg(orgs[0].id);
    }
  }, [orgs, selectedOrg]);

  // Fetch analytics events
  const { data: events, isLoading } = useQuery({
    queryKey: ["analytics-events", selectedOrg, timeRange],
    queryFn: async () => {
      if (!selectedOrg) return [];

      const startDate = subDays(new Date(), parseInt(timeRange));
      
      const { data, error } = await supabase
        .from("analytics_events")
        .select("*")
        .eq("org_id", selectedOrg)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrg,
  });

  // Process data for charts
  const timeSeriesData = events?.reduce((acc: any[], event) => {
    const date = format(new Date(event.created_at), "MMM dd");
    const existing = acc.find(item => item.date === date);
    
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ date, count: 1 });
    }
    
    return acc;
  }, []) || [];

  const eventTypeData = events?.reduce((acc: any[], event) => {
    const existing = acc.find(item => item.event_type === event.event_type);
    
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ event_type: event.event_type, count: 1 });
    }
    
    return acc;
  }, []) || [];

  const categoryData = events?.reduce((acc: any[], event) => {
    const existing = acc.find(item => item.name === event.event_category);
    
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: event.event_category, value: 1 });
    }
    
    return acc;
  }, []) || [];

  // Calculate metrics
  const totalEvents = events?.length || 0;
  const uniqueUsers = new Set(events?.map(e => e.user_id)).size || 0;
  const avgDuration = events?.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / (totalEvents || 1);
  const prevPeriodEvents = Math.floor(totalEvents * 0.85); // Simulated for demo
  const changePercent = totalEvents > 0 ? (((totalEvents - prevPeriodEvents) / prevPeriodEvents) * 100).toFixed(1) : "0";

  if (!selectedOrg) {
    return (
      <Layout>
        <PageHeader title="Analytics & Insights" icon={BarChart3} />
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select an organization to view analytics</p>
        </div>
      </Layout>
    );
  }

  const analyticsTips = [
    "Use time range filters to compare performance across different periods",
    "Track event categories to identify your most engaged content types",
    "Monitor user engagement metrics to optimize posting schedules",
    "Export analytics data for deeper insights and reporting",
  ];

  return (
    <Layout>
      <PageHeader
        title="Analytics & Insights"
        description="Track usage, performance, and campaign effectiveness"
        icon={BarChart3}
        actions={
          <div className="flex gap-4">
            <Select value={selectedOrg || ""} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs?.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <TipsCard tips={analyticsTips} />

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      ) : (
        <>
...
        </>
      )}
    </Layout>
  );
}
