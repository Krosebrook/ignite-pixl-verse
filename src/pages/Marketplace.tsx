import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Download, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Marketplace() {
  const { data: items } = useQuery({
    queryKey: ["marketplace"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_items")
        .select("*")
        .order("downloads", { ascending: false })
        .limit(12);
      return data || [];
    },
  });

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-muted-foreground">
            Discover templates, presets, and content packs
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items?.map((item) => (
            <Card key={item.id} className="overflow-hidden bg-card border-border hover:border-primary/50 transition-all group">
              {item.thumbnail_url ? (
                <img
                  src={item.thumbnail_url}
                  alt={item.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-card flex items-center justify-center">
                  <ShoppingBag className="h-12 w-12 text-primary" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold mb-1">{item.name}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {item.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    <span>{item.downloads.toLocaleString()}</span>
                  </div>
                  <Button size="sm" className="bg-gradient-hero hover:opacity-90">
                    {item.price_cents === 0 ? "Free" : `$${(item.price_cents / 100).toFixed(2)}`}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {items?.length === 0 && (
          <Card className="p-12 bg-card border-border text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Marketplace coming soon</h3>
            <p className="text-muted-foreground">
              Discover amazing templates and presets from the community
            </p>
          </Card>
        )}
      </div>
    </Layout>
  );
}
