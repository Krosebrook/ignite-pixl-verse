import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, LayoutGrid, TrendingUp, Users, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Campaigns() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: campaigns, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase.from("members").select("org_id").eq("user_id", user.id).single();
      if (!membership) { toast.error("No organization found"); return; }
      await supabase.from("campaigns").insert({ org_id: membership.org_id, user_id: user.id, name, description, status: "draft" });
      toast.success("Campaign created!");
      setOpen(false); setName(""); setDescription(""); refetch();
    } catch (error: any) { toast.error(error.message); }
  };

  const statusColors = { active: "bg-green-500/10 text-green-500 border-green-500/20", draft: "bg-amber-500/10 text-amber-500 border-amber-500/20", completed: "bg-blue-500/10 text-blue-500 border-blue-500/20" };

  return (
    <Layout>
      <div className="space-y-8">
        <PageHeader title="Campaigns" description="Plan, execute, and track multi-channel marketing campaigns" icon={LayoutGrid} actions={
          <Button onClick={() => window.location.href = '/campaigns/new'} size="lg"><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
        } />
        <div className="grid gap-6 animate-fade-in">
          {campaigns?.map((campaign: any) => (
            <Card key={campaign.id} className="hover:shadow-glow transition-all group">
              <CardHeader><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-2xl font-display group-hover:text-primary transition-colors">{campaign.name}</CardTitle>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border capitalize ${statusColors[campaign.status as keyof typeof statusColors]}`}>{campaign.status}</span></div></div>
                <Button variant="ghost" size="sm">View Details</Button></div></CardHeader>
              <CardContent><div className="grid grid-cols-3 gap-6">
                <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Target className="h-4 w-4 text-primary" /></div><div><p className="text-2xl font-bold font-display">0</p><p className="text-xs text-muted-foreground">Total Assets</p></div></div>
                <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-secondary/10"><Users className="h-4 w-4 text-secondary" /></div><div><p className="text-2xl font-bold font-display">0</p><p className="text-xs text-muted-foreground">Scheduled Posts</p></div></div>
                <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-accent/10"><TrendingUp className="h-4 w-4 text-accent" /></div><div><p className="text-2xl font-bold font-display">—</p><p className="text-xs text-muted-foreground">Engagement Rate</p></div></div>
              </div></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
