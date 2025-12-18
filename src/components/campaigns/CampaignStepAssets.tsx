import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Asset, CampaignData } from "@/hooks/useCampaignBuilder";
import { Image, FileText, Video, Music, Plus, ImageOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  campaign: CampaignData;
  assets: Asset[];
  onToggleAsset: (assetId: string) => void;
}

const TYPE_ICONS: Record<string, any> = {
  image: Image,
  text: FileText,
  video: Video,
  music: Music,
};

export function CampaignStepAssets({ campaign, assets, onToggleAsset }: Props) {
  const navigate = useNavigate();

  const getTypeIcon = (type: string) => {
    const Icon = TYPE_ICONS[type] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  if (assets.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">No assets available</h3>
        <p className="text-muted-foreground mb-6">
          Create some content in the Content Studio first
        </p>
        <Button onClick={() => navigate("/content")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Content
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Select Assets</h3>
          <p className="text-sm text-muted-foreground">
            Choose the content to include in your campaign
          </p>
        </div>
        <Badge variant="outline">
          {campaign.assets.length} of {assets.length} selected
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {assets.map((asset) => {
          const isSelected = campaign.assets.includes(asset.id);
          return (
            <Card
              key={asset.id}
              className={`group cursor-pointer overflow-hidden transition-all hover:shadow-md ${
                isSelected
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onToggleAsset(asset.id)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted">
                {asset.thumbnail_url ? (
                  <img
                    src={asset.thumbnail_url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {getTypeIcon(asset.type)}
                  </div>
                )}
                
                {/* Checkbox overlay */}
                <div className={`absolute top-2 right-2 transition-opacity ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}>
                  <div className="bg-background rounded-md p-1 shadow-sm">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => onToggleAsset(asset.id)}
                    />
                  </div>
                </div>

                {/* Type badge */}
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {getTypeIcon(asset.type)}
                    <span className="ml-1">{asset.type}</span>
                  </Badge>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="font-medium text-sm truncate">{asset.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(asset.created_at).toLocaleDateString()}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {campaign.assets.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm">
            <span className="font-medium">{campaign.assets.length}</span> asset{campaign.assets.length > 1 ? "s" : ""} selected for this campaign
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => campaign.assets.forEach(id => onToggleAsset(id))}
          >
            Clear Selection
          </Button>
        </div>
      )}
    </div>
  );
}
