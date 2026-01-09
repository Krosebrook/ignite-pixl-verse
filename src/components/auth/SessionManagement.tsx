import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  LogOut, 
  Shield, 
  MapPin,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  is_current: boolean;
  created_at: string;
  last_active_at: string;
}

interface SessionManagementProps {
  className?: string;
}

// Parse user agent to get device info
const parseUserAgent = () => {
  const ua = navigator.userAgent;
  
  // Detect device type
  let deviceType = "desktop";
  if (/tablet|ipad/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) {
    deviceType = "mobile";
  }

  // Detect browser
  let browser = "Unknown";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  // Detect OS
  let os = "Unknown";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";

  // Generate device name
  const deviceName = `${browser} on ${os}`;

  return { deviceType, browser, os, deviceName };
};

export function SessionManagement({ className }: SessionManagementProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const deviceInfo = parseUserAgent();
      // Check if current session exists
      const { data: existingSessions } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("session_token", session.access_token.substring(0, 50));

      if (!existingSessions || existingSessions.length === 0) {
        // Create current session record
        const { data: newSession, error } = await supabase
          .from("user_sessions")
          .insert({
            user_id: user.id,
            session_token: session.access_token.substring(0, 50),
            device_name: deviceInfo.deviceName,
            device_type: deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            is_current: true,
          })
          .select()
          .single();

        if (!error && newSession) {
          setCurrentSessionId(newSession.id);
        }
      } else {
        // Update last active
        const existingSession = existingSessions[0];
        setCurrentSessionId(existingSession.id);
        await supabase
          .from("user_sessions")
          .update({ 
            last_active_at: new Date().toISOString(),
            is_current: true 
          })
          .eq("id", existingSession.id);
      }

      fetchSessions();
    } catch (error) {
      console.error("Error initializing session:", error);
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_active_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (id: string) => {
    setRevokingId(id);

    try {
      const { error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Session revoked");
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error revoking session:", error);
      toast.error("Failed to revoke session");
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOtherSessions = async () => {
    setRevokingAll(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", user.id)
        .neq("id", currentSessionId || "");

      if (error) throw error;

      toast.success("All other sessions revoked");
      setSessions(sessions.filter((s) => s.id === currentSessionId));
    } catch (error) {
      console.error("Error revoking sessions:", error);
      toast.error("Failed to revoke sessions");
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="h-5 w-5" />;
      case "tablet":
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const formatLastActive = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const otherSessions = sessions.filter((s) => s.id !== currentSessionId);

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Active Sessions</CardTitle>
              <CardDescription>
                Manage your logged-in devices
              </CardDescription>
            </div>
          </div>
          {otherSessions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  disabled={revokingAll}
                >
                  {revokingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Sign Out All Others
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out all other devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will sign you out of all devices except this one. You'll need to sign in again on those devices.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={revokeAllOtherSessions}
                  >
                    Sign Out All Others
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active sessions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              
              return (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-start justify-between p-4 rounded-lg border",
                    isCurrent 
                      ? "bg-primary/5 border-primary/30" 
                      : "bg-muted/50 border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      isCurrent ? "bg-primary/10 text-primary" : "bg-background"
                    )}>
                      {getDeviceIcon(session.device_type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {session.device_name || "Unknown Device"}
                        </p>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            This Device
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {session.browser && session.os && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {session.browser} · {session.os}
                          </span>
                        )}
                        {session.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Active {formatLastActive(session.last_active_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!isCurrent && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={revokingId === session.id}
                        >
                          {revokingId === session.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Sign out this device?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will sign out {session.device_name || "this device"}. You'll need to sign in again on that device.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => revokeSession(session.id)}
                          >
                            Sign Out
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {otherSessions.length > 0 && (
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Security tip:</span> If you don't recognize a device, sign it out immediately and change your password.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
