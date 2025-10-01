import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Schedule() {
  const { data: schedules } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .order("scheduled_at", { ascending: true });
      return data || [];
    },
  });

  return (
    <Layout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Schedule</h1>
          <p className="text-muted-foreground">
            Manage your content calendar and scheduled posts
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <Card className="lg:col-span-2 p-6 bg-card border-border">
            <div className="flex items-center gap-2 mb-6">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Content Calendar</h2>
            </div>
            <div className="h-96 flex items-center justify-center border-2 border-dashed border-border rounded-lg">
              <p className="text-muted-foreground">Calendar view coming soon</p>
            </div>
          </Card>

          {/* Upcoming Posts */}
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Upcoming</h2>
            </div>
            <div className="space-y-4">
              {schedules?.slice(0, 5).map((schedule) => (
                <div key={schedule.id} className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-1">{schedule.platform}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(schedule.scheduled_at).toLocaleDateString()}
                  </p>
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
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
              {schedules?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No scheduled posts yet
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
