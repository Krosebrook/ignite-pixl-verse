import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Target, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Campaigns() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: campaigns, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        toast.error("No organization found");
        return;
      }

      await supabase.from("campaigns").insert({
        org_id: membership.org_id,
        user_id: user.id,
        name,
        description,
        status: "draft",
      });

      toast.success("Campaign created!");
      setOpen(false);
      setName("");
      setDescription("");
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Campaigns</h1>
            <p className="text-muted-foreground">
              Plan and execute multi-channel marketing campaigns
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-hero hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Summer Product Launch"
                    className="bg-background border-border mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your campaign goals..."
                    rows={4}
                    className="bg-background border-border mt-2"
                  />
                </div>
                <Button onClick={handleCreate} className="w-full bg-gradient-hero">
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns?.map((campaign) => (
            <Card key={campaign.id} className="p-6 bg-card border-border hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-gradient-card rounded-lg">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  campaign.status === "active"
                    ? "bg-green-500/10 text-green-500"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {campaign.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{campaign.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {campaign.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>0 posts</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {campaigns?.length === 0 && (
          <Card className="p-12 bg-card border-border text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first campaign to start organizing your content
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
