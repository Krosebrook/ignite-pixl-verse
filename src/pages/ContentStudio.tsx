import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { TipsCard } from "@/components/ui/tips-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FileText, Image, Video, Music, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function ContentStudio() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("text");

  const { data: assets, refetch } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      return data || [];
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to generate content");
        return;
      }

      // Get user's org
      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        toast.error("No organization found. Please create one first.");
        return;
      }

      // Generate content via edge function
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          type: activeTab,
          prompt,
          org_id: membership.org_id,
          name: prompt.slice(0, 50),
        },
      });

      if (error) {
        console.error("Generation error:", error);
        throw error;
      }

      // Edge function returns the full asset object
      if (activeTab === "text") {
        setGeneratedContent(data.content_data?.text);
      } else if (activeTab === "image") {
        setGeneratedContent(data.content_url);
      }

      toast.success("Content generated successfully!");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate content");
    } finally {
      setLoading(false);
    }
  };

  const contentTips = [
    "Be specific in your prompts for better AI-generated results",
    "All generated content includes provenance tracking for transparency",
    "Preview your content before saving to your asset library",
    "Text generation supports multiple languages and tones",
  ];

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <PageHeader
          title="Content Studio"
          description="Generate amazing content with AI-powered tools"
          icon={Sparkles}
        />

        <TipsCard tips={contentTips} />

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Generation Panel */}
          <Card className="p-6 bg-card border-border">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="text">
                  <FileText className="h-4 w-4 mr-2" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="image">
                  <Image className="h-4 w-4 mr-2" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="video" disabled>
                  <Video className="h-4 w-4 mr-2" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="music" disabled>
                  <Music className="h-4 w-4 mr-2" />
                  Music
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Describe what you want to create</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Write a compelling product description for eco-friendly water bottles..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="mt-2 bg-background border-border"
                  />
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                <div>
                  <Label htmlFor="image-prompt">Describe the image you want</Label>
                  <Textarea
                    id="image-prompt"
                    placeholder="A stunning product shot of a sleek water bottle on a mountain peak at sunset..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="mt-2 bg-background border-border"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-gradient-hero hover:opacity-90 mt-4"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              {loading ? "Generating..." : "Generate Content"}
            </Button>
          </Card>

          {/* Preview Panel */}
          <Card className="p-6 bg-card border-border">
            <h3 className="text-lg font-semibold mb-4">Preview</h3>
            {generatedContent ? (
              <div className="space-y-4">
                {activeTab === "text" && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="whitespace-pre-wrap">{generatedContent}</p>
                  </div>
                )}
                {activeTab === "image" && (
                  <div className="relative">
                    <img
                      src={generatedContent}
                      alt="Generated"
                      className="w-full rounded-lg"
                    />
                  </div>
                )}
                <Button className="w-full" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground">Your generated content will appear here</p>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Assets */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Recent Assets</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {assets?.map((asset) => (
              <Card key={asset.id} className="overflow-hidden bg-card border-border hover:border-primary/50 transition-all">
                {asset.thumbnail_url && (
                  <img src={asset.thumbnail_url} alt={asset.name} className="w-full h-40 object-cover" />
                )}
                {!asset.thumbnail_url && (
                  <div className="w-full h-40 bg-gradient-card flex items-center justify-center">
                    <FileText className="h-12 w-12 text-primary" />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-medium truncate">{asset.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{asset.type}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
