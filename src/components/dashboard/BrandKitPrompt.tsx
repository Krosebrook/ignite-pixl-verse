import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export function BrandKitPrompt() {
  const { orgId } = useCurrentOrg();
  const [dismissed, setDismissed] = useState(false);

  const { data: hasBrandKit, isLoading } = useQuery({
    queryKey: ["has-brand-kit", orgId],
    queryFn: async () => {
      if (!orgId) return true; // Don't show if no org

      const { data, error } = await supabase
        .from("brand_kits")
        .select("id")
        .eq("org_id", orgId)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Don't render if loading, has brand kit, or dismissed
  if (isLoading || hasBrandKit || dismissed) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 animate-fade-in">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardContent className="py-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Palette className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1">Complete Your Brand Kit</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up your brand colors, fonts, and voice to ensure all AI-generated content matches
              your brand identity perfectly.
            </p>
            <div className="flex items-center gap-3">
              <Link to="/brand-kit">
                <Button variant="premium" size="sm">
                  Set Up Brand Kit
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
