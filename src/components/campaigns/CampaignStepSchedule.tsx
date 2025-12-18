import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignData } from "@/hooks/useCampaignBuilder";
import { Clock, Plus, X, Calendar, Globe } from "lucide-react";

interface Props {
  campaign: CampaignData;
  onUpdate: (updates: Partial<CampaignData>) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export function CampaignStepSchedule({ campaign, onUpdate }: Props) {
  const scheduleConfig = campaign.schedule_config;

  const updateScheduleConfig = (updates: Partial<CampaignData["schedule_config"]>) => {
    onUpdate({
      schedule_config: {
        ...scheduleConfig,
        ...updates,
      },
    });
  };

  const addTime = () => {
    if (scheduleConfig.times.length < 6) {
      updateScheduleConfig({
        times: [...scheduleConfig.times, "12:00"],
      });
    }
  };

  const removeTime = (index: number) => {
    updateScheduleConfig({
      times: scheduleConfig.times.filter((_, i) => i !== index),
    });
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...scheduleConfig.times];
    newTimes[index] = value;
    updateScheduleConfig({ times: newTimes });
  };

  const toggleDayOfWeek = (day: number) => {
    const days = scheduleConfig.days_of_week || [];
    updateScheduleConfig({
      days_of_week: days.includes(day)
        ? days.filter(d => d !== day)
        : [...days, day].sort(),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Schedule Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Define when your content should be published
        </p>
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Campaign Duration
          </CardTitle>
          <CardDescription>Set the start and end dates for your campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date <span className="text-destructive">*</span></Label>
              <Input
                id="start_date"
                type="datetime-local"
                value={campaign.start_date}
                onChange={(e) => onUpdate({ start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date (optional)</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={campaign.end_date}
                onChange={(e) => onUpdate({ end_date: e.target.value })}
                min={campaign.start_date}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frequency */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Posting Frequency
          </CardTitle>
          <CardDescription>How often should posts be published?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={scheduleConfig.frequency}
            onValueChange={(value: CampaignData["schedule_config"]["frequency"]) => updateScheduleConfig({ frequency: value })}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">One Time Only</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="custom">Custom Schedule</SelectItem>
            </SelectContent>
          </Select>

          {/* Days of Week (for weekly/custom) */}
          {(scheduleConfig.frequency === "weekly" || scheduleConfig.frequency === "custom") && (
            <div className="space-y-2">
              <Label>Days of the Week</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={scheduleConfig.days_of_week?.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDayOfWeek(day.value)}
                    className="w-12"
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posting Times */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Posting Times
          </CardTitle>
          <CardDescription>When during the day should posts go live?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {scheduleConfig.times.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => updateTime(index, e.target.value)}
                  className="w-28"
                />
                {scheduleConfig.times.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTime(index)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {scheduleConfig.times.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTime}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Time
              </Button>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-2 pt-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </Label>
            <Select
              value={scheduleConfig.timezone}
              onValueChange={(value) => updateScheduleConfig({ timezone: value })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm font-medium mb-2">Schedule Summary</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {scheduleConfig.frequency === "once" ? "One-time" : scheduleConfig.frequency}
          </Badge>
          {scheduleConfig.times.map((time, i) => (
            <Badge key={i} variant="outline">
              {time}
            </Badge>
          ))}
          {scheduleConfig.days_of_week && scheduleConfig.days_of_week.length > 0 && (
            <Badge variant="outline">
              {scheduleConfig.days_of_week.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(", ")}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
