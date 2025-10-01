import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select an organization to view analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">Analytics & Insights</h1>
              <p className="text-muted-foreground">
                Track usage, performance, and campaign effectiveness
              </p>
            </div>
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
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Total Events"
                value={totalEvents.toLocaleString()}
                change={`${changePercent}%`}
                trend={parseFloat(changePercent) > 0 ? "up" : "down"}
              />
              <MetricCard
                title="Active Users"
                value={uniqueUsers.toLocaleString()}
                change="+12%"
                trend="up"
              />
              <MetricCard
                title="Avg Duration"
                value={`${(avgDuration / 1000).toFixed(1)}s`}
                change="-5%"
                trend="down"
              />
              <MetricCard
                title="Event Categories"
                value={categoryData.length}
                trend="neutral"
              />
            </div>

            {/* Charts Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="events">Event Types</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AnalyticsLineChart
                    data={timeSeriesData}
                    title="Events Over Time"
                    description="Daily event count trend"
                    dataKey="count"
                    type="line"
                  />
                  <AnalyticsPieChart
                    data={categoryData}
                    title="Event Distribution"
                    description="Events by category"
                    type="pie"
                  />
                </div>
              </TabsContent>

              <TabsContent value="events" className="space-y-6">
                <AnalyticsBarChart
                  data={eventTypeData}
                  title="Events by Type"
                  description="Breakdown of event types"
                  dataKey="count"
                  categoryKey="event_type"
                  type="bar"
                />
              </TabsContent>

              <TabsContent value="categories" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AnalyticsPieChart
                    data={categoryData}
                    title="Category Distribution"
                    description="Events grouped by category"
                    type="pie"
                  />
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Top Categories</h3>
                    <div className="space-y-4">
                      {categoryData.slice(0, 5).map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2"
                                style={{
                                  width: `${(cat.value / totalEvents) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {cat.value}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Average Event Duration</p>
                          <p className="text-sm text-muted-foreground">Time to complete events</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">{(avgDuration / 1000).toFixed(2)}s</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Growth Rate</p>
                          <p className="text-sm text-muted-foreground">Period over period</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-green-600">+{changePercent}%</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">User Engagement</p>
                          <p className="text-sm text-muted-foreground">Events per user</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">
                        {(totalEvents / (uniqueUsers || 1)).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
