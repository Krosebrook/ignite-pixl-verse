import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Download, Star, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["marketplace", searchQuery, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_items_preview")
        .select("*")
        .order("downloads", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data } = await query.limit(24);
      return data || [];
    },
  });

  const installMutation = useMutation({
    mutationFn: async ({ packId }: { packId: string }) => {
      // Get current user's org (simplified - in production, get from context)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) throw new Error("No organization found");

      const { data, error } = await supabase.functions.invoke("marketplace-install", {
        body: { packId, orgId: membership.org_id },
      });

      if (error) throw error;
      if (data?.status === "error") throw new Error(data.message);

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Pack installed successfully!");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["brand_kits"] });
    },
    onError: (error) => {
      console.error("Install error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to install pack");
    },
  });

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-muted-foreground">
            Discover templates, presets, and content packs from the community
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search packs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="template">Templates</SelectItem>
              <SelectItem value="preset">Presets</SelectItem>
              <SelectItem value="integration">Integrations</SelectItem>
              <SelectItem value="workflow">Workflows</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="w-full h-48 bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-8 bg-muted rounded w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden bg-card border-border hover:border-primary/50 transition-all group"
              >
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-card flex items-center justify-center">
                    <ShoppingBag className="h-12 w-12 text-primary" />
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold line-clamp-1">{item.name}</h3>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {item.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Download className="h-4 w-4" />
                      <span>{item.downloads.toLocaleString()}</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-gradient-hero hover:opacity-90"
                      onClick={() => installMutation.mutate({ packId: item.id })}
                      disabled={installMutation.isPending}
                    >
                      {installMutation.isPending ? (
                        "Installing..."
                      ) : item.price_cents === 0 ? (
                        "Install Free"
                      ) : (
                        `$${(item.price_cents / 100).toFixed(2)}`
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Empty State */}
        {!isLoading && items && items.length === 0 && (
          <Card className="p-12 bg-card border-border text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No packs found</h3>
            <p className="text-muted-foreground">
              {searchQuery || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "Check back soon for new community packs"}
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
