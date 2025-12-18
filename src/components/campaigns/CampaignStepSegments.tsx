import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, Plus, Target, Globe, Heart } from "lucide-react";
import { Segment, CampaignData } from "@/hooks/useCampaignBuilder";

interface Props {
  campaign: CampaignData;
  segments: Segment[];
  onToggleSegment: (segmentId: string) => void;
  onCreateSegment: (segment: Omit<Segment, "id">) => Promise<any>;
}

export function CampaignStepSegments({ campaign, segments, onToggleSegment, onCreateSegment }: Props) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSegment, setNewSegment] = useState({
    name: "",
    description: "",
    criteria: {
      ageRange: { min: 18, max: 65 },
      locations: [] as string[],
      interests: [] as string[],
    },
    estimated_reach: 0,
  });
  const [creating, setCreating] = useState(false);

  const handleCreateSegment = async () => {
    if (!newSegment.name.trim()) return;
    setCreating(true);
    try {
      await onCreateSegment(newSegment);
      setShowCreateDialog(false);
      setNewSegment({
        name: "",
        description: "",
        criteria: { ageRange: { min: 18, max: 65 }, locations: [], interests: [] },
        estimated_reach: 0,
      });
    } finally {
      setCreating(false);
    }
  };

  const formatReach = (reach: number) => {
    if (reach >= 1000000) return `${(reach / 1000000).toFixed(1)}M`;
    if (reach >= 1000) return `${(reach / 1000).toFixed(1)}K`;
    return reach.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Audience Segments</h3>
          <p className="text-sm text-muted-foreground">
            Target specific audience groups for your campaign (optional)
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Segment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Audience Segment</DialogTitle>
              <DialogDescription>
                Define targeting criteria for a new audience segment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="seg-name">Segment Name</Label>
                <Input
                  id="seg-name"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Young Professionals"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seg-desc">Description</Label>
                <Textarea
                  id="seg-desc"
                  value={newSegment.description}
                  onChange={(e) => setNewSegment(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this audience segment..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Age Range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={13}
                      max={100}
                      value={newSegment.criteria.ageRange?.min || 18}
                      onChange={(e) => setNewSegment(prev => ({
                        ...prev,
                        criteria: {
                          ...prev.criteria,
                          ageRange: { ...prev.criteria.ageRange!, min: parseInt(e.target.value) },
                        },
                      }))}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={13}
                      max={100}
                      value={newSegment.criteria.ageRange?.max || 65}
                      onChange={(e) => setNewSegment(prev => ({
                        ...prev,
                        criteria: {
                          ...prev.criteria,
                          ageRange: { ...prev.criteria.ageRange!, max: parseInt(e.target.value) },
                        },
                      }))}
                      className="w-20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Reach</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newSegment.estimated_reach}
                    onChange={(e) => setNewSegment(prev => ({ ...prev, estimated_reach: parseInt(e.target.value) || 0 }))}
                    placeholder="10000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Locations (comma separated)</Label>
                <Input
                  placeholder="e.g., United States, Canada, UK"
                  value={newSegment.criteria.locations?.join(", ") || ""}
                  onChange={(e) => setNewSegment(prev => ({
                    ...prev,
                    criteria: {
                      ...prev.criteria,
                      locations: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                    },
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Interests (comma separated)</Label>
                <Input
                  placeholder="e.g., Technology, Fashion, Sports"
                  value={newSegment.criteria.interests?.join(", ") || ""}
                  onChange={(e) => setNewSegment(prev => ({
                    ...prev,
                    criteria: {
                      ...prev.criteria,
                      interests: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                    },
                  }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateSegment} disabled={creating || !newSegment.name.trim()}>
                {creating ? "Creating..." : "Create Segment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {segments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No segments yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create audience segments to target specific groups
            </p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Segment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {segments.map((segment) => (
            <Card
              key={segment.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                campaign.segments.includes(segment.id)
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onToggleSegment(segment.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      {segment.name}
                    </CardTitle>
                    {segment.description && (
                      <CardDescription className="mt-1">{segment.description}</CardDescription>
                    )}
                  </div>
                  <Checkbox
                    checked={campaign.segments.includes(segment.id)}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onToggleSegment(segment.id)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {segment.criteria.ageRange && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {segment.criteria.ageRange.min}-{segment.criteria.ageRange.max} years
                    </Badge>
                  )}
                  {segment.criteria.locations && segment.criteria.locations.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Globe className="h-3 w-3 mr-1" />
                      {segment.criteria.locations.slice(0, 2).join(", ")}
                      {segment.criteria.locations.length > 2 && ` +${segment.criteria.locations.length - 2}`}
                    </Badge>
                  )}
                  {segment.criteria.interests && segment.criteria.interests.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Heart className="h-3 w-3 mr-1" />
                      {segment.criteria.interests.slice(0, 2).join(", ")}
                      {segment.criteria.interests.length > 2 && ` +${segment.criteria.interests.length - 2}`}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Est. Reach: <span className="font-medium text-foreground">{formatReach(segment.estimated_reach)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {campaign.segments.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium">
            {campaign.segments.length} segment{campaign.segments.length > 1 ? "s" : ""} selected
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total estimated reach: {formatReach(
              segments
                .filter(s => campaign.segments.includes(s.id))
                .reduce((sum, s) => sum + s.estimated_reach, 0)
            )}
          </p>
        </div>
      )}
    </div>
  );
}
