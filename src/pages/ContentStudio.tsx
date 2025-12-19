import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Image, Video, Music, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LayerBuilder } from "@/components/content/LayerBuilder";
import { BrandKitSelector } from "@/components/BrandKitSelector";
import { BrandValidator } from "@/components/content/BrandValidator";
import { useBrandValidation } from "@/hooks/useBrandValidation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BrandRules } from "@/lib/brandValidation";

interface Layer {
  id: string;
  type: string;
  content: string;
  position: { x?: number; y?: number; z_index: number };
  style?: any;
  animation?: string;
  visible: boolean;
}

export default function ContentStudio() {
  const [youtubePrompt, setYoutubePrompt] = useState("");
  const [tiktokPrompt, setTiktokPrompt] = useState("");
  const [youtubeLayers, setYoutubeLayers] = useState<Layer[]>([]);
  const [tiktokLayers, setTiktokLayers] = useState<Layer[]>([]);
  const [youtubeQualityTier, setYoutubeQualityTier] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [tiktokQualityTier, setTiktokQualityTier] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [isGenerating, setIsGenerating] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [selectedBrandKit, setSelectedBrandKit] = useState<{
    id: string;
    name: string;
    colors: { primary: string; secondary: string };
    brand_voice: string;
    rules?: BrandRules;
  } | null>(null);
  const [overrideValidation, setOverrideValidation] = useState(false);

  // Brand validation for YouTube prompt
  const youtubeValidation = useBrandValidation(
    youtubePrompt,
    selectedBrandKit ? {
      colors: {
        required: [selectedBrandKit.colors.primary, selectedBrandKit.colors.secondary],
        forbidden: [],
      },
      tone: {
        brand_voice: selectedBrandKit.brand_voice,
        forbidden_words: ['cheap', 'guarantee', 'best ever'],
      }
    } : null,
    { enabled: !!selectedBrandKit }
  );

  // Brand validation for TikTok prompt
  const tiktokValidation = useBrandValidation(
    tiktokPrompt,
    selectedBrandKit ? {
      colors: {
        required: [selectedBrandKit.colors.primary, selectedBrandKit.colors.secondary],
        forbidden: [],
      },
      tone: {
        brand_voice: selectedBrandKit.brand_voice,
        forbidden_words: ['cheap', 'guarantee', 'best ever'],
      }
    } : null,
    { enabled: !!selectedBrandKit }
  );

  useEffect(() => {
    loadOrgId();
  }, []);

  const loadOrgId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (membership) {
        setOrgId(membership.org_id);
      }
    } catch (error) {
      console.error("Error loading org ID:", error);
    }
  };

  const enrichPromptWithBrand = (prompt: string) => {
    if (!selectedBrandKit) return prompt;

    return `${prompt}

Brand Context:
- Primary Color: ${selectedBrandKit.colors.primary}
- Secondary Color: ${selectedBrandKit.colors.secondary}
- Brand Voice: ${selectedBrandKit.brand_voice}`;
  };

  const generateYouTubeContent = async () => {
    if (!youtubePrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (selectedBrandKit && !youtubeValidation.isValid && !overrideValidation) {
      toast.error("Please fix brand compliance errors or override");
      return;
    }

    setIsGenerating(true);
    setOverrideValidation(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to generate content");
        return;
      }

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        toast.error("No organization found");
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-youtube-content', {
        body: {
          org_id: membership.org_id,
          prompt: enrichPromptWithBrand(youtubePrompt),
          quality_tier: youtubeQualityTier,
          duration_seconds: 60,
          layers: youtubeLayers
        }
      });

      if (error) throw error;

      toast.success("YouTube video generated successfully!");
      console.log("Generated video:", data);
    } catch (error: any) {
      console.error("Error generating YouTube content:", error);
      toast.error(error.message || "Failed to generate YouTube content");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateTikTokContent = async () => {
    if (!tiktokPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (selectedBrandKit && !tiktokValidation.isValid && !overrideValidation) {
      toast.error("Please fix brand compliance errors or override");
      return;
    }

    setIsGenerating(true);
    setOverrideValidation(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to generate content");
        return;
      }

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        toast.error("No organization found");
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-tiktok-content', {
        body: {
          org_id: membership.org_id,
          prompt: enrichPromptWithBrand(tiktokPrompt),
          quality_tier: tiktokQualityTier,
          duration_seconds: 30,
          layers: tiktokLayers,
          effects: []
        }
      });

      if (error) throw error;

      toast.success("TikTok video generated successfully!");
      console.log("Generated video:", data);
    } catch (error: any) {
      console.error("Error generating TikTok content:", error);
      toast.error(error.message || "Failed to generate TikTok content");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Content Studio"
        description="Generate professional studio-grade content with AI-powered multi-layer video generation"
      />

      {/* Brand Kit Selector - shown at the top for all content */}
      {orgId && (
        <div className="mb-6">
          <BrandKitSelector
            orgId={orgId}
            selectedKitId={selectedBrandKit?.id}
            onSelectKit={setSelectedBrandKit}
          />
        </div>
      )}

      <Tabs defaultValue="text" className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-6">
          <TabsTrigger value="text">
            <FileText className="h-4 w-4 mr-2" />
            Text
          </TabsTrigger>
          <TabsTrigger value="image">
            <Image className="h-4 w-4 mr-2" />
            Image
          </TabsTrigger>
          <TabsTrigger value="youtube">
            <Video className="h-4 w-4 mr-2" />
            YouTube
          </TabsTrigger>
          <TabsTrigger value="tiktok">
            <Music className="h-4 w-4 mr-2" />
            TikTok
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video className="h-4 w-4 mr-2" />
            Video
          </TabsTrigger>
          <TabsTrigger value="music" disabled>
            <Music className="h-4 w-4 mr-2" />
            Music
          </TabsTrigger>
          <TabsTrigger value="multi">
            <Sparkles className="h-4 w-4 mr-2" />
            Multi-Platform
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Text Generation</h3>
            <p className="text-muted-foreground">Coming soon: AI-powered text generation</p>
          </Card>
        </TabsContent>

        <TabsContent value="image">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Image Generation</h3>
            <p className="text-muted-foreground">Coming soon: AI-powered image generation</p>
          </Card>
        </TabsContent>

        <TabsContent value="youtube">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">YouTube Video Generation</h3>
                  <Badge variant="outline">16:9 Format</Badge>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <Label>Quality Tier</Label>
                    <Select value={youtubeQualityTier} onValueChange={(value: any) => setYoutubeQualityTier(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter - 1080p (5 layers max)</SelectItem>
                        <SelectItem value="pro">Pro - 4K (15 layers max)</SelectItem>
                        <SelectItem value="enterprise">Enterprise - 8K (Unlimited layers)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Video Prompt</Label>
                    <Textarea
                      placeholder="Describe your YouTube video... (e.g., 'Create a tech product review with modern transitions')"
                      value={youtubePrompt}
                      onChange={(e) => setYoutubePrompt(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <LayerBuilder
                  platform="youtube"
                  qualityTier={youtubeQualityTier}
                  layers={youtubeLayers}
                  onChange={setYoutubeLayers}
                />

                <Button 
                  onClick={generateYouTubeContent} 
                  disabled={isGenerating || (selectedBrandKit && !youtubeValidation.isValid && !overrideValidation)}
                  size="lg"
                  className="w-full mt-6"
                >
                  {isGenerating ? "Generating..." : "Generate YouTube Video"}
                </Button>
              </Card>
            </div>

            {/* Brand Validation Panel */}
            {selectedBrandKit && youtubePrompt.trim() && (
              <div className="lg:col-span-1">
                <BrandValidator
                  result={youtubeValidation}
                  isValidating={youtubeValidation.isValidating}
                  brandKitName={selectedBrandKit.name}
                  showOverride={!youtubeValidation.isValid}
                  onOverride={() => setOverrideValidation(true)}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tiktok">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">TikTok Video Generation</h3>
                  <Badge variant="outline">9:16 Format</Badge>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <Label>Quality Tier</Label>
                    <Select value={tiktokQualityTier} onValueChange={(value: any) => setTiktokQualityTier(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter - 720p (5 layers max)</SelectItem>
                        <SelectItem value="pro">Pro - 1080p (15 layers max)</SelectItem>
                        <SelectItem value="enterprise">Enterprise - 4K (Unlimited layers)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Video Prompt</Label>
                    <Textarea
                      placeholder="Describe your TikTok video... (e.g., 'Create an unboxing short with trending effects')"
                      value={tiktokPrompt}
                      onChange={(e) => setTiktokPrompt(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <LayerBuilder
                  platform="tiktok"
                  qualityTier={tiktokQualityTier}
                  layers={tiktokLayers}
                  onChange={setTiktokLayers}
                />

                <Button 
                  onClick={generateTikTokContent} 
                  disabled={isGenerating || (selectedBrandKit && !tiktokValidation.isValid && !overrideValidation)}
                  size="lg"
                  className="w-full mt-6"
                >
                  {isGenerating ? "Generating..." : "Generate TikTok Video"}
                </Button>
              </Card>
            </div>

            {/* Brand Validation Panel */}
            {selectedBrandKit && tiktokPrompt.trim() && (
              <div className="lg:col-span-1">
                <BrandValidator
                  result={tiktokValidation}
                  isValidating={tiktokValidation.isValidating}
                  brandKitName={selectedBrandKit.name}
                  showOverride={!tiktokValidation.isValid}
                  onOverride={() => setOverrideValidation(true)}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="video">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Generic Video Generation</h3>
            <p className="text-muted-foreground">Coming soon: Generate videos for other platforms</p>
          </Card>
        </TabsContent>

        <TabsContent value="music">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Music Generation</h3>
            <p className="text-muted-foreground">Coming soon: AI-powered music creation</p>
          </Card>
        </TabsContent>

        <TabsContent value="multi">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Multi-Platform Generator</h3>
            <p className="text-muted-foreground">Coming soon: Generate optimized content for multiple platforms at once</p>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
