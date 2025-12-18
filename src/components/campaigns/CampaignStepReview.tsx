import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CampaignData, Segment, Asset, CampaignGoal } from "@/hooks/useCampaignBuilder";
import {
  FileText, Users, Image, Share2, Calendar, Target, DollarSign,
  CheckCircle2, AlertCircle
} from "lucide-react";

interface Props {
  campaign: CampaignData;
  assets: Asset[];
  segments: Segment[];
}

const GOAL_LABELS: Record<CampaignGoal["goal_type"], string> = {
  impressions: "Impressions",
  clicks: "Clicks",
  conversions: "Conversions",
  engagement: "Engagement",
  reach: "Reach",
  followers: "Followers",
};

export function CampaignStepReview({ campaign, assets, segments }: Props) {
  const selectedAssets = assets.filter(a => campaign.assets.includes(a.id));
  const selectedSegments = segments.filter(s => campaign.segments.includes(s.id));

  const formatBudget = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleString();
  };

  const hasAllRequirements = 
    campaign.name &&
    campaign.objective &&
    campaign.assets.length > 0 &&
    campaign.platforms.length > 0 &&
    campaign.start_date;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {hasAllRequirements ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Ready to launch</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Missing required fields</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campaign Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Campaign Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{campaign.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Objective</span>
              <Badge variant="secondary" className="capitalize">
                {campaign.objective || "Not set"}
              </Badge>
            </div>
            {campaign.description && (
              <div className="pt-2">
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm mt-1">{campaign.description}</p>
              </div>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Budget
              </span>
              <span className="text-sm font-medium">
                {campaign.budget_cents ? formatBudget(campaign.budget_cents) : "Not set"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Start Date</span>
              <span className="text-sm font-medium">{formatDate(campaign.start_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">End Date</span>
              <span className="text-sm font-medium">{formatDate(campaign.end_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Frequency</span>
              <Badge variant="outline" className="capitalize">
                {campaign.schedule_config.frequency}
              </Badge>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm text-muted-foreground">Posting Times</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {campaign.schedule_config.times.map((time, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {time}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audience Segments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Audience Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSegments.length > 0 ? (
              <div className="space-y-2">
                {selectedSegments.map((segment) => (
                  <div key={segment.id} className="flex justify-between items-center py-1">
                    <span className="text-sm">{segment.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ~{segment.estimated_reach.toLocaleString()} reach
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All audiences (no targeting)</p>
            )}
          </CardContent>
        </Card>

        {/* Platforms */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.platforms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {campaign.platforms.map((platform) => (
                  <Badge key={platform} variant="secondary" className="capitalize">
                    {platform}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No platforms selected</p>
            )}
          </CardContent>
        </Card>

        {/* Assets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="h-4 w-4" />
              Assets ({selectedAssets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAssets.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {selectedAssets.slice(0, 8).map((asset) => (
                  <div
                    key={asset.id}
                    className="aspect-square rounded-md overflow-hidden bg-muted"
                  >
                    {asset.thumbnail_url ? (
                      <img
                        src={asset.thumbnail_url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        {asset.type}
                      </div>
                    )}
                  </div>
                ))}
                {selectedAssets.length > 8 && (
                  <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-sm text-muted-foreground">
                    +{selectedAssets.length - 8}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No assets selected</p>
            )}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goals ({campaign.goals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.goals.length > 0 ? (
              <div className="space-y-2">
                {campaign.goals.map((goal, index) => (
                  <div key={index} className="flex justify-between items-center py-1">
                    <span className="text-sm">{GOAL_LABELS[goal.goal_type]}</span>
                    <span className="text-sm font-medium">
                      {goal.target_value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No goals defined</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{campaign.assets.length}</p>
              <p className="text-xs text-muted-foreground">Assets</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{campaign.platforms.length}</p>
              <p className="text-xs text-muted-foreground">Platforms</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {campaign.assets.length * campaign.platforms.length * campaign.schedule_config.times.length}
              </p>
              <p className="text-xs text-muted-foreground">Scheduled Posts</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{campaign.goals.length}</p>
              <p className="text-xs text-muted-foreground">Goals</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
