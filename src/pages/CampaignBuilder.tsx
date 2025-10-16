import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Rocket, Check } from "lucide-react";

const STEPS = ["Details", "Assets", "Platforms", "Schedule", "Review"];

export default function CampaignBuilder() {
  const { id } = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [campaign, setCampaign] = useState({
    name: "",
    description: "",
    objective: "",
    assets: [] as string[],
    platforms: [] as string[],
    scheduleConfig: {
      startDate: "",
      frequency: "daily",
    },
  });
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) loadCampaign();
    loadAssets();
  }, [id]);

  const loadCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setCampaign({
        name: data.name,
        description: data.description || "",
        objective: data.objective || "",
        assets: (data.assets as any) || [],
        platforms: (data.platforms as any) || [],
        scheduleConfig: {
          startDate: "",
          frequency: "daily",
        },
      });
    } catch (error) {
      console.error("Load campaign error:", error);
      toast({
        title: "Error",
        description: "Failed to load campaign",
        variant: "destructive",
      });
    }
  };

  const loadAssets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type, thumbnail_url")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Load assets error:", error);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleToggleAsset = (assetId: string) => {
    setCampaign({
      ...campaign,
      assets: campaign.assets.includes(assetId)
        ? campaign.assets.filter((id) => id !== assetId)
        : [...campaign.assets, assetId],
    });
  };

  const handleTogglePlatform = (platform: string) => {
    setCampaign({
      ...campaign,
      platforms: campaign.platforms.includes(platform)
        ? campaign.platforms.filter((p) => p !== platform)
        : [...campaign.platforms, platform],
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("members")
        .select("org_id")
        .eq("user_id", user.id)
        .single();

      if (!membership) return;

      if (id) {
        // Update existing campaign
        const { error } = await supabase
          .from("campaigns")
          .update({
            name: campaign.name,
            description: campaign.description,
            objective: campaign.objective,
            assets: campaign.assets,
            platforms: campaign.platforms,
            status: "active",
          })
          .eq("id", id);

        if (error) throw error;
      } else {
        // Create new campaign
        const { error } = await supabase.from("campaigns").insert({
          org_id: membership.org_id,
          user_id: user.id,
          name: campaign.name,
          description: campaign.description,
          objective: campaign.objective,
          assets: campaign.assets,
          platforms: campaign.platforms,
          status: "active",
        });

        if (error) throw error;
      }

      // Create schedule entries for each platform
      if (campaign.scheduleConfig.startDate) {
        for (const platform of campaign.platforms) {
          for (const assetId of campaign.assets) {
            await supabase.from("schedules").insert({
              org_id: membership.org_id,
              platform,
              asset_id: assetId,
              scheduled_at: new Date(campaign.scheduleConfig.startDate).toISOString(),
              status: "pending",
            });
          }
        }
      }

      toast({
        title: "Success",
        description: "Campaign created and scheduled successfully",
      });

      navigate("/campaigns");
    } catch (error) {
      console.error("Save campaign error:", error);
      toast({
        title: "Error",
        description: "Failed to save campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const platforms = [
    "Instagram",
    "Twitter",
    "Facebook",
    "LinkedIn",
    "TikTok",
    "YouTube",
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title={id ? "Edit Campaign" : "Create Campaign"}
        description="Build your multi-channel campaign"
        icon={Rocket}
      />

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                index <= currentStep
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted text-muted-foreground"
              }`}
            >
              {index < currentStep ? (
                <Check className="h-5 w-5" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-24 h-0.5 mx-2 ${
                  index < currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep]}</CardTitle>
          <CardDescription>
            {currentStep === 0 && "Define your campaign details"}
            {currentStep === 1 && "Select assets to include"}
            {currentStep === 2 && "Choose target platforms"}
            {currentStep === 3 && "Configure scheduling"}
            {currentStep === 4 && "Review and launch"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 0: Details */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={campaign.name}
                  onChange={(e) =>
                    setCampaign({ ...campaign, name: e.target.value })
                  }
                  placeholder="Summer Product Launch"
                />
              </div>
              <div>
                <Label htmlFor="objective">Objective</Label>
                <Select
                  value={campaign.objective}
                  onValueChange={(value) =>
                    setCampaign({ ...campaign, objective: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select objective" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awareness">Brand Awareness</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="conversion">Conversions</SelectItem>
                    <SelectItem value="traffic">Website Traffic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={campaign.description}
                  onChange={(e) =>
                    setCampaign({ ...campaign, description: e.target.value })
                  }
                  placeholder="Describe your campaign goals..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 1: Assets */}
          {currentStep === 1 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className={`relative p-4 border rounded-lg cursor-pointer transition-all ${
                    campaign.assets.includes(asset.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleToggleAsset(asset.id)}
                >
                  <div className="absolute top-2 right-2">
                    <Checkbox checked={campaign.assets.includes(asset.id)} />
                  </div>
                  {asset.thumbnail_url && (
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.name}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                  )}
                  <p className="font-medium">{asset.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {asset.type}
                  </p>
                </div>
              ))}
              {assets.length === 0 && (
                <p className="text-center text-muted-foreground col-span-full py-8">
                  No assets available. Create some content first!
                </p>
              )}
            </div>
          )}

          {/* Step 2: Platforms */}
          {currentStep === 2 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {platforms.map((platform) => (
                <div
                  key={platform}
                  className={`p-6 border rounded-lg cursor-pointer transition-all ${
                    campaign.platforms.includes(platform.toLowerCase())
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleTogglePlatform(platform.toLowerCase())}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-lg">{platform}</p>
                    <Checkbox
                      checked={campaign.platforms.includes(
                        platform.toLowerCase()
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Schedule */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={campaign.scheduleConfig.startDate}
                  onChange={(e) =>
                    setCampaign({
                      ...campaign,
                      scheduleConfig: {
                        ...campaign.scheduleConfig,
                        startDate: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="frequency">Posting Frequency</Label>
                <Select
                  value={campaign.scheduleConfig.frequency}
                  onValueChange={(value) =>
                    setCampaign({
                      ...campaign,
                      scheduleConfig: {
                        ...campaign.scheduleConfig,
                        frequency: value,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Campaign Details</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>Name:</strong> {campaign.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Objective:</strong>{" "}
                  {campaign.objective || "Not specified"}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Description:</strong> {campaign.description}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Selected Assets</h3>
                <p className="text-sm text-muted-foreground">
                  {campaign.assets.length} asset(s) selected
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Target Platforms</h3>
                <p className="text-sm text-muted-foreground">
                  {campaign.platforms.join(", ")}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Schedule</h3>
                <p className="text-sm text-muted-foreground">
                  Start: {campaign.scheduleConfig.startDate || "Not set"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Frequency: {campaign.scheduleConfig.frequency}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          Back
        </Button>
        {currentStep === STEPS.length - 1 ? (
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Launching..." : "Launch Campaign"}
          </Button>
        ) : (
          <Button onClick={handleNext}>Next</Button>
        )}
      </div>
    </div>
  );
}
