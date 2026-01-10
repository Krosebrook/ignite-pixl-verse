import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  Smartphone, 
  Monitor, 
  Tablet, 
  MapPin, 
  Clock, 
  Bell,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface LoginRecord {
  id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  ip_address: string | null;
  is_new_device: boolean;
  notification_sent: boolean;
  created_at: string;
}

interface LoginHistoryProps {
  className?: string;
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
      return <Smartphone className="h-4 w-4" />;
    case 'tablet':
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

function parseUserAgent(): { browser: string; os: string; deviceType: string; deviceName: string } {
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';
  
  const deviceName = `${browser} on ${os}`;
  
  return { browser, os, deviceType, deviceName };
}

export function LoginHistory({ className }: LoginHistoryProps) {
  const [history, setHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLoginHistory();
    recordCurrentLogin();
  }, []);

  const recordCurrentLogin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { browser, os, deviceType, deviceName } = parseUserAgent();
      
      // Check if this device has logged in before (within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentLogins } = await supabase
        .from('login_history')
        .select('id')
        .eq('user_id', user.id)
        .eq('browser', browser)
        .eq('os', os)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .limit(1);

      const isNewDevice = !recentLogins || recentLogins.length === 0;

      // Record this login
      await supabase
        .from('login_history')
        .insert({
          user_id: user.id,
          user_agent: navigator.userAgent,
          device_name: deviceName,
          device_type: deviceType,
          browser,
          os,
          is_new_device: isNewDevice,
          notification_sent: false
        });

      // If new device, trigger notification
      if (isNewDevice) {
        try {
          await supabase.functions.invoke('login-notification', {
            body: { 
              userId: user.id,
              email: user.email,
              deviceName,
              browser,
              os,
              timestamp: new Date().toISOString(),
              isNewDevice: true
            }
          });
        } catch (error) {
          console.error('Failed to send login notification:', error);
        }
      }
    } catch (error) {
      console.error('Error recording login:', error);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('login_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching login history:', error);
        return;
      }

      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching login history:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchLoginHistory();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Login History</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
        <CardDescription>
          Recent sign-in activity on your account with automatic new device alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No login history available</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {history.map((record, index) => (
                <div
                  key={record.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    index === 0 && "bg-primary/5 border-primary/20",
                    record.is_new_device && "border-amber-500/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        index === 0 ? "bg-primary/10 text-primary" : "bg-muted"
                      )}>
                        {getDeviceIcon(record.device_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {record.device_name || 'Unknown Device'}
                          </span>
                          {index === 0 && (
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Current
                            </Badge>
                          )}
                          {record.is_new_device && (
                            <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              New Device
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                          </span>
                          {record.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {record.location}
                            </span>
                          )}
                        </div>
                        {record.browser && record.os && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {record.browser} • {record.os}
                          </p>
                        )}
                      </div>
                    </div>
                    {record.notification_sent && (
                      <div title="Notification sent">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
