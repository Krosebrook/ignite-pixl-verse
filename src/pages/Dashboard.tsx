import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { TrendingUp, Sparkles, Calendar, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        engagement: 2847,
      };
    },
  });

  const metrics = [
    {
      title: "Total Assets",
      value: stats?.totalAssets || 0,
      change: "+12.5%",
      icon: Sparkles,
      color: "text-primary",
    },
    {
      title: "Active Campaigns",
      value: stats?.totalCampaigns || 0,
      change: "+8.2%",
      icon: TrendingUp,
      color: "text-secondary",
    },
    {
      title: "Scheduled Posts",
      value: stats?.scheduledPosts || 0,
      change: "+23.1%",
      icon: Calendar,
      color: "text-accent",
    },
    {
      title: "Total Engagement",
      value: stats?.engagement || 0,
      change: "+15.7%",
      icon: Eye,
      color: "text-primary",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your content.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card
                key={index}
                className="p-6 bg-card border-border hover:border-primary/50 transition-all duration-300 animate-scale-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 bg-gradient-card rounded-lg ${metric.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-green-500">{metric.change}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{metric.title}</p>
                  <p className="text-2xl font-bold">{metric.value.toLocaleString()}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recent Activity */}
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="flex-1">
                <p className="font-medium">Generated new image assets</p>
                <p className="text-sm text-muted-foreground">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <div className="flex-1">
                <p className="font-medium">Campaign "Summer Launch" scheduled</p>
                <p className="text-sm text-muted-foreground">1 hour ago</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <div className="flex-1">
                <p className="font-medium">Brand kit updated</p>
                <p className="text-sm text-muted-foreground">3 hours ago</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
