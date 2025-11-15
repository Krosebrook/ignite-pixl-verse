import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type BrandKitRow = Tables<"brand_kits">;

interface BrandKit {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
  };
  brand_voice: string;
}

interface BrandKitSelectorProps {
  orgId: string;
  selectedKitId?: string;
  onSelectKit: (kit: BrandKit | null) => void;
}

export function BrandKitSelector({ orgId, selectedKitId, onSelectKit }: BrandKitSelectorProps) {
  const { data: brandKits, isLoading } = useQuery({
    queryKey: ['brand-kits', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_kits')
        .select('*')
        .eq('org_id', orgId);
      
      if (error) throw error;
      
      // Transform DB rows to expected format
      return (data as BrandKitRow[]).map(row => ({
        id: row.id,
        name: row.name,
        colors: (row.colors as any) || { primary: '#2563eb', secondary: '#0f172a' },
        brand_voice: row.brand_voice,
      })) as BrandKit[];
    },
    enabled: !!orgId,
  });

  const handleValueChange = (value: string) => {
    const kit = brandKits?.find(k => k.id === value) || null;
    onSelectKit(kit);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Brand Kit</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!brandKits || brandKits.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="brand-kit">Brand Kit</Label>
      <Select value={selectedKitId} onValueChange={handleValueChange}>
        <SelectTrigger id="brand-kit">
          <SelectValue placeholder="Select a brand kit" />
        </SelectTrigger>
        <SelectContent>
          {brandKits.map((kit) => (
            <SelectItem key={kit.id} value={kit.id}>
              {kit.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
