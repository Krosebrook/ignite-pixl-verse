import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  criteria: {
    ageRange?: { min: number; max: number };
    locations?: string[];
    interests?: string[];
    gender?: string[];
    languages?: string[];
  };
  estimated_reach: number;
}

export interface CampaignGoal {
  id?: string;
  goal_type: "impressions" | "clicks" | "conversions" | "engagement" | "reach" | "followers";
  target_value: number;
  current_value: number;
  deadline: string | null;
}

export interface CampaignData {
  name: string;
  description: string;
  objective: string;
  budget_cents: number;
  start_date: string;
  end_date: string;
  assets: string[];
  platforms: string[];
  segments: string[];
  schedule_config: {
    frequency: "once" | "daily" | "weekly" | "custom";
    times: string[];
    days_of_week?: number[];
    timezone: string;
  };
  goals: CampaignGoal[];
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  thumbnail_url: string | null;
  created_at: string;
}

const INITIAL_CAMPAIGN: CampaignData = {
  name: "",
  description: "",
  objective: "",
  budget_cents: 0,
  start_date: "",
  end_date: "",
  assets: [],
  platforms: [],
  segments: [],
  schedule_config: {
    frequency: "once",
    times: ["09:00"],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  goals: [],
};

export function useCampaignBuilder(campaignId?: string) {
  const [currentStep, setCurrentStep] = useState(0);
  const [campaign, setCampaign] = useState<CampaignData>(INITIAL_CAMPAIGN);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const STEPS = ["Details", "Segments", "Assets", "Platforms", "Schedule", "Goals", "Review"];

  // Load org ID
  useEffect(() => {
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

    loadOrgId();
  }, []);

  // Load campaign if editing
  useEffect(() => {
    if (campaignId && orgId) {
      loadCampaign(campaignId);
    }
  }, [campaignId, orgId]);

  // Load assets and segments when org ID is available
  useEffect(() => {
    if (orgId) {
      loadAssets();
      loadSegments();
    }
  }, [orgId]);

  const loadCampaign = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Load campaign goals
      const { data: goals } = await supabase
        .from("campaign_goals")
        .select("*")
        .eq("campaign_id", id);

      setCampaign({
        name: data.name,
        description: data.description || "",
        objective: data.objective || "",
        budget_cents: data.budget_cents || 0,
        start_date: data.start_date || "",
        end_date: data.end_date || "",
        assets: Array.isArray(data.assets) ? data.assets : [],
        platforms: Array.isArray(data.platforms) ? data.platforms : [],
        segments: Array.isArray(data.segments) ? data.segments : [],
        schedule_config: data.schedule_config || INITIAL_CAMPAIGN.schedule_config,
        goals: goals?.map(g => ({
          id: g.id,
          goal_type: g.goal_type as CampaignGoal["goal_type"],
          target_value: g.target_value,
          current_value: g.current_value,
          deadline: g.deadline,
        })) || [],
      });
    } catch (error) {
      console.error("Load campaign error:", error);
      toast({
        title: "Error",
        description: "Failed to load campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type, thumbnail_url, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error("Load assets error:", error);
    }
  };

  const loadSegments = async () => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from("segments")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSegments(data?.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        criteria: s.criteria as Segment["criteria"],
        estimated_reach: s.estimated_reach || 0,
      })) || []);
    } catch (error) {
      console.error("Load segments error:", error);
    }
  };

  const createSegment = async (segment: Omit<Segment, "id">) => {
    if (!orgId) return null;
    try {
      const { data, error } = await supabase
        .from("segments")
        .insert({
          org_id: orgId,
          name: segment.name,
          description: segment.description,
          criteria: segment.criteria,
          estimated_reach: segment.estimated_reach,
        })
        .select()
        .single();

      if (error) throw error;
      await loadSegments();
      toast({ title: "Success", description: "Segment created" });
      return data;
    } catch (error) {
      console.error("Create segment error:", error);
      toast({ title: "Error", description: "Failed to create segment", variant: "destructive" });
      return null;
    }
  };

  const updateCampaign = useCallback((updates: Partial<CampaignData>) => {
    setCampaign(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, STEPS.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < STEPS.length) {
      setCurrentStep(step);
    }
  }, [STEPS.length]);

  const toggleAsset = useCallback((assetId: string) => {
    setCampaign(prev => ({
      ...prev,
      assets: prev.assets.includes(assetId)
        ? prev.assets.filter(id => id !== assetId)
        : [...prev.assets, assetId],
    }));
  }, []);

  const togglePlatform = useCallback((platform: string) => {
    setCampaign(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  }, []);

  const toggleSegment = useCallback((segmentId: string) => {
    setCampaign(prev => ({
      ...prev,
      segments: prev.segments.includes(segmentId)
        ? prev.segments.filter(id => id !== segmentId)
        : [...prev.segments, segmentId],
    }));
  }, []);

  const addGoal = useCallback((goal: Omit<CampaignGoal, "current_value">) => {
    setCampaign(prev => ({
      ...prev,
      goals: [...prev.goals, { ...goal, current_value: 0 }],
    }));
  }, []);

  const removeGoal = useCallback((index: number) => {
    setCampaign(prev => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }));
  }, []);

  const saveCampaign = async () => {
    if (!orgId) {
      toast({ title: "Error", description: "No organization found", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const campaignPayload = {
        org_id: orgId,
        user_id: user.id,
        name: campaign.name,
        description: campaign.description,
        objective: campaign.objective,
        budget_cents: campaign.budget_cents,
        start_date: campaign.start_date || null,
        end_date: campaign.end_date || null,
        assets: campaign.assets,
        platforms: campaign.platforms,
        segments: campaign.segments,
        schedule_config: campaign.schedule_config,
        status: "active",
      };

      let savedCampaignId = campaignId;

      if (campaignId) {
        const { error } = await supabase
          .from("campaigns")
          .update(campaignPayload)
          .eq("id", campaignId);
        if (error) throw error;

        // Delete existing goals and recreate
        await supabase.from("campaign_goals").delete().eq("campaign_id", campaignId);
      } else {
        const { data, error } = await supabase
          .from("campaigns")
          .insert(campaignPayload)
          .select()
          .single();
        if (error) throw error;
        savedCampaignId = data.id;
      }

      // Create goals
      if (campaign.goals.length > 0 && savedCampaignId) {
        const goalsPayload = campaign.goals.map(g => ({
          campaign_id: savedCampaignId,
          goal_type: g.goal_type,
          target_value: g.target_value,
          current_value: g.current_value,
          deadline: g.deadline || null,
        }));

        const { error: goalsError } = await supabase
          .from("campaign_goals")
          .insert(goalsPayload);

        if (goalsError) throw goalsError;
      }

      // Create schedule entries
      if (campaign.start_date && savedCampaignId) {
        for (const platform of campaign.platforms) {
          for (const assetId of campaign.assets) {
            for (const time of campaign.schedule_config.times) {
              const scheduledDate = new Date(campaign.start_date);
              const [hours, minutes] = time.split(":").map(Number);
              scheduledDate.setHours(hours, minutes, 0, 0);

              await supabase.from("schedules").insert({
                org_id: orgId,
                campaign_id: savedCampaignId,
                platform,
                asset_id: assetId,
                scheduled_at: scheduledDate.toISOString(),
                status: "pending",
              });
            }
          }
        }
      }

      toast({
        title: "Success",
        description: campaignId ? "Campaign updated" : "Campaign launched successfully!",
      });

      navigate("/campaigns");
    } catch (error: any) {
      console.error("Save campaign error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save campaign",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const validateStep = useCallback((step: number): { valid: boolean; message?: string } => {
    switch (step) {
      case 0: // Details
        if (!campaign.name.trim()) return { valid: false, message: "Campaign name is required" };
        if (!campaign.objective) return { valid: false, message: "Objective is required" };
        return { valid: true };
      case 1: // Segments - optional
        return { valid: true };
      case 2: // Assets
        if (campaign.assets.length === 0) return { valid: false, message: "Select at least one asset" };
        return { valid: true };
      case 3: // Platforms
        if (campaign.platforms.length === 0) return { valid: false, message: "Select at least one platform" };
        return { valid: true };
      case 4: // Schedule
        if (!campaign.start_date) return { valid: false, message: "Start date is required" };
        return { valid: true };
      case 5: // Goals - optional but recommended
        return { valid: true };
      case 6: // Review
        return { valid: true };
      default:
        return { valid: true };
    }
  }, [campaign]);

  return {
    currentStep,
    campaign,
    assets,
    segments,
    orgId,
    loading,
    saving,
    STEPS,
    updateCampaign,
    nextStep,
    prevStep,
    goToStep,
    toggleAsset,
    togglePlatform,
    toggleSegment,
    addGoal,
    removeGoal,
    createSegment,
    saveCampaign,
    validateStep,
  };
}
