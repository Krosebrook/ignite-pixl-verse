import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { TipsCard } from "@/components/ui/tips-card";
import { MetricTile } from "@/components/ui/metric-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandKitPrompt } from "@/components/dashboard/BrandKitPrompt";
import { TrendingUp, FileText, Calendar, Users, Sparkles, Image, Video, Music, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [assetsRes, campaignsRes, schedulesRes] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact" }),
        supabase.from("campaigns").select("id", { count: "exact" }),
        supabase.from("schedules").select("id", { count: "exact" }),
      ]);

      return {
        totalAssets: assetsRes.count || 0,
        totalCampaigns: campaignsRes.count || 0,
        scheduledPosts: schedulesRes.count || 0,
        engagement: 4.2,
      };
    },
  });

  const dashboardTips = [
    "Generate your first asset in Content Studio to get started",
    "Group related content into campaigns for better organization",
    "Schedule posts in advance to maintain consistent engagement",
    "Check Analytics regularly to optimize your content strategy",
  ];

  const metrics = [
    { title: "Total Assets", value: stats?.totalAssets || 0, change: 12, icon: FileText, color: "primary" as const, trend: "up" as const },
    { title: "Active Campaigns", value: stats?.totalCampaigns || 0, change: 8, icon: TrendingUp, color: "secondary" as const, trend: "up" as const },
    { title: "Scheduled Posts", value: stats?.scheduledPosts || 0, change: 15, icon: Calendar, color: "accent" as const, trend: "up" as const },
    { title: "Engagement Rate", value: `${stats?.engagement || 0}%`, change: -2, icon: Users, color: "primary" as const, trend: "down" as const },
  ];

  const recentActivity = [
    { id: 1, type: "asset", title: "Product Hero Banner", description: "Generated high-res image for Spring Sale campaign", timestamp: "2 hours ago", icon: Image, status: "completed" },
    { id: 2, type: "campaign", title: "Q2 Product Launch", description: "Drafted multi-channel campaign with 8 assets", timestamp: "5 hours ago", icon: Sparkles, status: "draft" },
    { id: 3, type: "schedule", title: "Instagram Carousel Post", description: "Scheduled for Tomorrow at 3:00 PM EST", timestamp: "1 day ago", icon: Calendar, status: "scheduled" },
    { id: 4, type: "asset", title: "Tutorial Video - Part 3", description: "AI-generated 60s explainer video", timestamp: "2 days ago", icon: Video, status: "completed" },
    { id: 5, type: "asset", title: "Background Music Loop", description: "Upbeat 30s audio track for social media", timestamp: "3 days ago", icon: Music, status: "completed" },
  ];

  const statusColors = {
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    draft: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    scheduled: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  return (
    <Layout>
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Welcome back! Here's what's happening with your creative studio."
          icon={BarChart3}
          showBackButton={false}
          actions={<Button variant="premium" size="lg"><Sparkles className="h-4 w-4" />Generate Content</Button>}
        />

        <BrandKitPrompt />

        <TipsCard tips={dashboardTips} />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          {metrics.map((metric) => (
            <MetricTile key={metric.title} {...metric} />
          ))}
        </div>

        <Card className="animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-display">Recent Activity</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Latest content generation, campaigns, and scheduled posts</p>
            </div>
            <Button variant="outline" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-all group" role="article" aria-label={`${activity.type}: ${activity.title}`}>
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{activity.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                        </div>
                        <span className={`text-xs font-medium px-3 py-1 rounded-full border capitalize ${statusColors[activity.status as keyof typeof statusColors]}`}>{activity.status}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-2 inline-block">{activity.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
