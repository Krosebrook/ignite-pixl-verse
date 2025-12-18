import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CampaignData } from "@/hooks/useCampaignBuilder";

interface Props {
  campaign: CampaignData;
  onTogglePlatform: (platform: string) => void;
}

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Photo and video sharing",
    color: "bg-gradient-to-br from-purple-600 to-pink-500",
    features: ["Stories", "Reels", "Feed Posts", "Carousels"],
    bestFor: "Visual content, lifestyle brands",
  },
  {
    id: "twitter",
    name: "Twitter / X",
    description: "Real-time updates and conversations",
    color: "bg-black",
    features: ["Tweets", "Threads", "Spaces"],
    bestFor: "News, engagement, real-time updates",
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Broad audience reach",
    color: "bg-blue-600",
    features: ["Posts", "Stories", "Groups", "Events"],
    bestFor: "Community building, diverse audiences",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Professional networking",
    color: "bg-blue-700",
    features: ["Posts", "Articles", "Newsletters"],
    bestFor: "B2B, professional services, hiring",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Short-form video content",
    color: "bg-black",
    features: ["Videos", "Duets", "Stitches", "LIVE"],
    bestFor: "Gen Z, entertainment, viral content",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Long-form video platform",
    color: "bg-red-600",
    features: ["Videos", "Shorts", "Live Streams", "Community"],
    bestFor: "Tutorials, entertainment, education",
  },
];

export function CampaignStepPlatforms({ campaign, onTogglePlatform }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Target Platforms</h3>
          <p className="text-sm text-muted-foreground">
            Select the social media platforms for your campaign
          </p>
        </div>
        <Badge variant="outline">
          {campaign.platforms.length} selected
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const isSelected = campaign.platforms.includes(platform.id);
          return (
            <Card
              key={platform.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onTogglePlatform(platform.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center text-white font-bold text-sm`}>
                      {platform.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium">{platform.name}</h4>
                      <p className="text-xs text-muted-foreground">{platform.description}</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onTogglePlatform(platform.id)}
                  />
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {platform.features.slice(0, 3).map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {platform.features.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{platform.features.length - 3}
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Best for:</span> {platform.bestFor}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {campaign.platforms.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">
            Publishing to {campaign.platforms.length} platform{campaign.platforms.length > 1 ? "s" : ""}:
          </p>
          <div className="flex flex-wrap gap-2">
            {campaign.platforms.map((platformId) => {
              const platform = PLATFORMS.find(p => p.id === platformId);
              return platform ? (
                <Badge key={platformId} className={`${platform.color} text-white`}>
                  {platform.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
