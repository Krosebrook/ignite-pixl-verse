import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Package, Search, Download, CheckCircle } from "lucide-react";

interface LibraryItem {
  id: string;
  slug: string;
  name: string;
  version: string;
  kind: string;
  summary: string;
  license: string;
  thumbnail_url: string | null;
  author: string | null;
  tags: string[];
}

interface Install {
  item_id: string;
  version: string;
  installed_at: string;
}

export default function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [installs, setInstalls] = useState<Install[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "template" | "assistant">("all");
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('library_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from('members')
          .select('org_id')
          .eq('user_id', user.id)
          .single();

        if (membership) {
          const { data: installsData } = await supabase
            .from('library_installs')
            .select('item_id, version, installed_at')
            .eq('org_id', membership.org_id);

          setInstalls(installsData || []);
        }
      }

      setItems(itemsData || []);
    } catch (error) {
      console.error('Load library error:', error);
      toast({
        title: "Error",
        description: "Failed to load library",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (slug: string, version: string) => {
    setInstalling(slug);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to install",
          variant: "destructive",
        });
        return;
      }

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        toast({
          title: "Error",
          description: "No organization found",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('library-install', {
        body: {
          org_id: membership.org_id,
          slug,
          version,
        },
      });

      if (error) throw error;

      toast({
        title: "Installed!",
        description: data.message || `Successfully installed ${slug}`,
      });

      loadLibrary();
    } catch (error) {
      console.error('Install error:', error);
      toast({
        title: "Error",
        description: "Failed to install item",
        variant: "destructive",
      });
    } finally {
      setInstalling(null);
    }
  };

  const isInstalled = (itemId: string) => {
    return installs.some(i => i.item_id === itemId);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                         item.summary?.toLowerCase().includes(search.toLowerCase()) ||
                         item.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === "all" || item.kind === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Template Library"
        description="Discover and install pre-built templates and assistants"
      />

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="template">Templates</TabsTrigger>
            <TabsTrigger value="assistant">Assistants</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map(item => (
          <Card key={item.id} className="flex flex-col">
            {item.thumbnail_url && (
              <div className="h-40 bg-muted rounded-t-lg overflow-hidden">
                <img
                  src={item.thumbnail_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    v{item.version}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {item.kind === 'template' ? <Package className="h-3 w-3 mr-1" /> : null}
                  {item.kind}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground mb-4 flex-1">
                {item.summary}
              </p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {item.tags?.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                <span>{item.license}</span>
                {item.author && <span>by {item.author}</span>}
              </div>

              {isInstalled(item.id) ? (
                <Button variant="outline" disabled className="w-full">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Installed
                </Button>
              ) : (
                <Button
                  onClick={() => handleInstall(item.slug, item.version)}
                  disabled={installing === item.slug}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {installing === item.slug ? "Installing..." : "Install"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No items found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      )}
    </div>
  );
}
