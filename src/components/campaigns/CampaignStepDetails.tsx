import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampaignData } from "@/hooks/useCampaignBuilder";
import { DollarSign, Calendar } from "lucide-react";

interface Props {
  campaign: CampaignData;
  onUpdate: (updates: Partial<CampaignData>) => void;
}

const OBJECTIVES = [
  { value: "awareness", label: "Brand Awareness", description: "Increase visibility and recognition" },
  { value: "engagement", label: "Engagement", description: "Drive likes, comments, and shares" },
  { value: "conversion", label: "Conversions", description: "Generate leads or sales" },
  { value: "traffic", label: "Website Traffic", description: "Drive visitors to your website" },
  { value: "followers", label: "Follower Growth", description: "Increase your social following" },
  { value: "video_views", label: "Video Views", description: "Maximize video content views" },
];

export function CampaignStepDetails({ campaign, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      {/* Campaign Name */}
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Campaign Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={campaign.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g., Summer Product Launch 2024"
          className="max-w-lg"
        />
      </div>

      {/* Objective */}
      <div className="space-y-2">
        <Label htmlFor="objective" className="text-sm font-medium">
          Campaign Objective <span className="text-destructive">*</span>
        </Label>
        <Select
          value={campaign.objective}
          onValueChange={(value) => onUpdate({ objective: value })}
        >
          <SelectTrigger className="max-w-lg">
            <SelectValue placeholder="Select your primary goal" />
          </SelectTrigger>
          <SelectContent>
            {OBJECTIVES.map((obj) => (
              <SelectItem key={obj.value} value={obj.value}>
                <div className="flex flex-col">
                  <span className="font-medium">{obj.label}</span>
                  <span className="text-xs text-muted-foreground">{obj.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          Description
        </Label>
        <Textarea
          id="description"
          value={campaign.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Describe your campaign goals, target audience, and key messages..."
          rows={4}
          className="max-w-lg"
        />
      </div>

      {/* Budget */}
      <div className="space-y-2">
        <Label htmlFor="budget" className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Budget (optional)
        </Label>
        <div className="relative max-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="budget"
            type="number"
            min={0}
            step={1}
            value={campaign.budget_cents / 100 || ""}
            onChange={(e) => onUpdate({ budget_cents: Math.round(parseFloat(e.target.value || "0") * 100) })}
            placeholder="0.00"
            className="pl-7"
          />
        </div>
        <p className="text-xs text-muted-foreground">Set a budget to track campaign spending</p>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Campaign Duration
        </Label>
        <div className="flex items-center gap-4 max-w-lg">
          <div className="flex-1 space-y-1">
            <Label htmlFor="start_date" className="text-xs text-muted-foreground">Start Date</Label>
            <Input
              id="start_date"
              type="datetime-local"
              value={campaign.start_date}
              onChange={(e) => onUpdate({ start_date: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="end_date" className="text-xs text-muted-foreground">End Date (optional)</Label>
            <Input
              id="end_date"
              type="datetime-local"
              value={campaign.end_date}
              onChange={(e) => onUpdate({ end_date: e.target.value })}
              min={campaign.start_date}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
