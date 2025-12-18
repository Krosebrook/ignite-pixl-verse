import { useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, Clock, Eye } from "lucide-react";
import { SocialPreview } from "@/components/schedule/SocialPreview";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Schedule {
  id: string;
  scheduled_at: string;
  platform: string;
  status: string;
  asset_id: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Schedule;
}

interface Asset {
  id: string;
  name: string;
  type: string;
  thumbnail_url: string | null;
  content_data: any;
}

export default function Schedule() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [newSchedule, setNewSchedule] = useState({
    scheduled_at: "",
    platform: "instagram",
    asset_id: "",
  });
  const { toast } = useToast();

  const getSelectedAsset = () => {
    return assets.find(a => a.id === newSchedule.asset_id);
  };

  const PLATFORM_LIMITS: Record<string, { max: number; name: string }> = {
    instagram: { max: 2200, name: "Instagram" },
    twitter: { max: 280, name: "Twitter/X" },
    linkedin: { max: 3000, name: "LinkedIn" },
    facebook: { max: 63206, name: "Facebook" },
    tiktok: { max: 2200, name: "TikTok" },
    youtube: { max: 5000, name: "YouTube" },
  };

  const currentLimit = PLATFORM_LIMITS[newSchedule.platform] || { max: 2200, name: "Default" };
  const charCount = postContent.length;
  const isOverLimit = charCount > currentLimit.max;
  const charPercentage = Math.min((charCount / currentLimit.max) * 100, 100);

  useEffect(() => {
    loadSchedules();
    loadAssets();
  }, []);

  const loadSchedules = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq('org_id', membership.org_id)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;

      setSchedules(data || []);
      
      // Convert to calendar events
      const calendarEvents: CalendarEvent[] = (data || []).map(schedule => ({
        id: schedule.id,
        title: `${schedule.platform} - ${schedule.status}`,
        start: new Date(schedule.scheduled_at),
        end: new Date(new Date(schedule.scheduled_at).getTime() + 60 * 60 * 1000), // 1 hour duration
        resource: schedule,
      }));
      
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Load schedules error:', error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { data, error } = await supabase
        .from("assets")
        .select("id, name, type, thumbnail_url, content_data")
        .eq('org_id', membership.org_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Load assets error:', error);
    }
  };


  const handleCreateSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) return;

      const { error } = await supabase
        .from("schedules")
        .insert({
          org_id: membership.org_id,
          scheduled_at: newSchedule.scheduled_at,
          platform: newSchedule.platform,
          asset_id: newSchedule.asset_id || null,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post scheduled successfully",
      });

      setDialogOpen(false);
      setNewSchedule({
        scheduled_at: "",
        platform: "instagram",
        asset_id: "",
      });
      loadSchedules();
    } catch (error) {
      console.error('Create schedule error:', error);
      toast({
        title: "Error",
        description: "Failed to schedule post",
        variant: "destructive",
      });
    }
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const status = event.resource.status;
    let backgroundColor = "#FF7B00";
    
    if (status === "posted") {
      backgroundColor = "#10b981";
    } else if (status === "failed") {
      backgroundColor = "#ef4444";
    } else if (status === "pending") {
      backgroundColor = "#f59e0b";
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
      },
    };
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Content Calendar"
        description="Schedule and manage your content publishing"
        icon={CalendarIcon}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Post</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                {/* Form Section */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="scheduled_at">Date & Time</Label>
                    <Input
                      id="scheduled_at"
                      type="datetime-local"
                      value={newSchedule.scheduled_at}
                      onChange={(e) => setNewSchedule({ ...newSchedule, scheduled_at: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="platform">Platform</Label>
                    <Select
                      value={newSchedule.platform}
                      onValueChange={(value) => setNewSchedule({ ...newSchedule, platform: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="twitter">Twitter</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="content">Post Content</Label>
                      <span className={`text-xs font-medium ${
                        isOverLimit 
                          ? "text-destructive" 
                          : charCount > currentLimit.max * 0.9 
                            ? "text-yellow-500" 
                            : "text-muted-foreground"
                      }`}>
                        {charCount.toLocaleString()} / {currentLimit.max.toLocaleString()}
                      </span>
                    </div>
                    <Textarea
                      id="content"
                      placeholder="Write your post caption here..."
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className={`min-h-[120px] ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          isOverLimit 
                            ? "bg-destructive" 
                            : charCount > currentLimit.max * 0.9 
                              ? "bg-yellow-500" 
                              : "bg-primary"
                        }`}
                        style={{ width: `${charPercentage}%` }}
                      />
                    </div>
                    {isOverLimit && (
                      <p className="text-xs text-destructive">
                        Your post exceeds the {currentLimit.name} character limit by {(charCount - currentLimit.max).toLocaleString()} characters.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="asset">Asset (Optional)</Label>
                    <Select
                      value={newSchedule.asset_id}
                      onValueChange={(value) => setNewSchedule({ ...newSchedule, asset_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an asset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleCreateSchedule} 
                    className="w-full"
                    disabled={isOverLimit}
                  >
                    {isOverLimit ? "Content exceeds limit" : "Schedule Post"}
                  </Button>
                </div>

                {/* Preview Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>Live Preview</span>
                  </div>
                  <SocialPreview
                    platform={newSchedule.platform}
                    content={postContent || "Your post content will appear here..."}
                    imageUrl={getSelectedAsset()?.thumbnail_url || undefined}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-6">
        <div style={{ height: "600px" }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            defaultView={Views.MONTH}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event) => {
              toast({
                title: event.title,
                description: `Scheduled for ${format(event.start, 'PPpp')}`,
              });
            }}
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Upcoming Posts</h2>
        </div>
        <div className="space-y-3">
          {schedules.slice(0, 10).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium capitalize">{schedule.platform}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(schedule.scheduled_at), 'PPpp')}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                schedule.status === "pending"
                  ? "bg-yellow-500/10 text-yellow-500"
                  : schedule.status === "posted"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-red-500/10 text-red-500"
              }`}>
                {schedule.status}
              </span>
            </div>
          ))}
          {schedules.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No scheduled posts yet. Click "Schedule Post" to get started.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
