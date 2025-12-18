import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampaignGoal, CampaignData } from "@/hooks/useCampaignBuilder";
import { Target, Plus, Trash2, TrendingUp, MousePointer, Users, Eye, Heart, UserPlus } from "lucide-react";

interface Props {
  campaign: CampaignData;
  onAddGoal: (goal: Omit<CampaignGoal, "current_value">) => void;
  onRemoveGoal: (index: number) => void;
}

const GOAL_TYPES: Array<{
  value: CampaignGoal["goal_type"];
  label: string;
  icon: any;
  description: string;
  placeholder: string;
}> = [
  {
    value: "impressions",
    label: "Impressions",
    icon: Eye,
    description: "Total number of times content is displayed",
    placeholder: "100000",
  },
  {
    value: "reach",
    label: "Reach",
    icon: Users,
    description: "Unique users who see your content",
    placeholder: "50000",
  },
  {
    value: "engagement",
    label: "Engagement",
    icon: Heart,
    description: "Likes, comments, shares, and saves",
    placeholder: "5000",
  },
  {
    value: "clicks",
    label: "Clicks",
    icon: MousePointer,
    description: "Link clicks and profile visits",
    placeholder: "2000",
  },
  {
    value: "conversions",
    label: "Conversions",
    icon: TrendingUp,
    description: "Completed goals (purchases, signups, etc.)",
    placeholder: "100",
  },
  {
    value: "followers",
    label: "New Followers",
    icon: UserPlus,
    description: "New followers gained during campaign",
    placeholder: "500",
  },
];

export function CampaignStepGoals({ campaign, onAddGoal, onRemoveGoal }: Props) {
  const [newGoal, setNewGoal] = useState<{
    goal_type: CampaignGoal["goal_type"] | "";
    target_value: string;
    deadline: string;
  }>({
    goal_type: "",
    target_value: "",
    deadline: "",
  });

  const handleAddGoal = () => {
    if (!newGoal.goal_type || !newGoal.target_value) return;
    
    onAddGoal({
      goal_type: newGoal.goal_type as CampaignGoal["goal_type"],
      target_value: parseInt(newGoal.target_value),
      deadline: newGoal.deadline || null,
    });
    
    setNewGoal({
      goal_type: "",
      target_value: "",
      deadline: "",
    });
  };

  const selectedGoalType = GOAL_TYPES.find(g => g.value === newGoal.goal_type);
  const usedGoalTypes = campaign.goals.map(g => g.goal_type);
  const availableGoalTypes = GOAL_TYPES.filter(g => !usedGoalTypes.includes(g.value));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Campaign Goals</h3>
        <p className="text-sm text-muted-foreground">
          Set measurable targets to track campaign success (optional but recommended)
        </p>
      </div>

      {/* Add New Goal */}
      {availableGoalTypes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Goal
            </CardTitle>
            <CardDescription>Define a new KPI for your campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Goal Type</Label>
                <Select
                  value={newGoal.goal_type}
                  onValueChange={(value: CampaignGoal["goal_type"]) => setNewGoal(prev => ({ ...prev, goal_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGoalTypes.map((goal) => (
                      <SelectItem key={goal.value} value={goal.value}>
                        <div className="flex items-center gap-2">
                          <goal.icon className="h-4 w-4" />
                          {goal.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedGoalType && (
                  <p className="text-xs text-muted-foreground">{selectedGoalType.description}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Target Value</Label>
                <Input
                  type="number"
                  min={1}
                  value={newGoal.target_value}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, target_value: e.target.value }))}
                  placeholder={selectedGoalType?.placeholder || "Enter target"}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Deadline (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newGoal.deadline}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))}
                    min={campaign.start_date?.split("T")[0]}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddGoal}
                    disabled={!newGoal.goal_type || !newGoal.target_value}
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Goals */}
      {campaign.goals.length > 0 ? (
        <div className="space-y-3">
          <Label>Active Goals</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {campaign.goals.map((goal, index) => {
              const goalType = GOAL_TYPES.find(g => g.value === goal.goal_type);
              const Icon = goalType?.icon || Target;
              const progress = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0;
              
              return (
                <Card key={index} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{goalType?.label || goal.goal_type}</p>
                          <p className="text-xs text-muted-foreground">
                            Target: {goal.target_value.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveGoal(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{goal.current_value.toLocaleString()} achieved</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    {goal.deadline && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Deadline: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No goals set</h4>
            <p className="text-sm text-muted-foreground">
              Add goals to track and measure your campaign's success
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
