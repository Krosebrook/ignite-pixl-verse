import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  Shield, 
  Key, 
  LogIn, 
  LogOut, 
  Lock, 
  Unlock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  Clock,
  RefreshCw,
  Filter,
  Fingerprint,
  Mail
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityLogEntry {
  id: string;
  event_type: string;
  event_category: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  success: boolean;
  failure_reason: string | null;
  risk_score: number;
  metadata: unknown;
  created_at: string;
}

interface SecurityActivityLogProps {
  className?: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  login_success: <LogIn className="h-4 w-4 text-success" />,
  login_failure: <LogIn className="h-4 w-4 text-destructive" />,
  login_attempt: <LogIn className="h-4 w-4 text-warning" />,
  logout: <LogOut className="h-4 w-4 text-muted-foreground" />,
  password_change: <Key className="h-4 w-4 text-primary" />,
  password_reset: <Key className="h-4 w-4 text-warning" />,
  mfa_enabled: <Shield className="h-4 w-4 text-success" />,
  mfa_disabled: <Shield className="h-4 w-4 text-destructive" />,
  passkey_added: <Fingerprint className="h-4 w-4 text-success" />,
  passkey_removed: <Fingerprint className="h-4 w-4 text-destructive" />,
  session_revoked: <Lock className="h-4 w-4 text-warning" />,
  account_locked: <Lock className="h-4 w-4 text-destructive" />,
  account_unlocked: <Unlock className="h-4 w-4 text-success" />,
  suspicious_activity: <AlertTriangle className="h-4 w-4 text-destructive" />,
  email_verification: <Mail className="h-4 w-4 text-primary" />,
};

const EVENT_LABELS: Record<string, string> = {
  login_success: "Successful Login",
  login_failure: "Failed Login",
  login_attempt: "Login Attempt",
  logout: "Signed Out",
  password_change: "Password Changed",
  password_reset: "Password Reset",
  mfa_enabled: "2FA Enabled",
  mfa_disabled: "2FA Disabled",
  passkey_added: "Passkey Added",
  passkey_removed: "Passkey Removed",
  session_revoked: "Session Revoked",
  account_locked: "Account Locked",
  account_unlocked: "Account Unlocked",
  suspicious_activity: "Suspicious Activity",
  email_verification: "Email Verified",
};

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
      return <Smartphone className="h-3 w-3" />;
    case 'tablet':
      return <Tablet className="h-3 w-3" />;
    default:
      return <Monitor className="h-3 w-3" />;
  }
}

function getRiskBadge(score: number) {
  if (score >= 70) {
    return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
  }
  if (score >= 40) {
    return <Badge variant="outline" className="text-xs border-warning text-warning">Medium Risk</Badge>;
  }
  return null;
}

export function SecurityActivityLog({ className }: SecurityActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('security_activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        if (filter === 'failures') {
          query = query.eq('success', false);
        } else if (filter === 'high_risk') {
          query = query.gte('risk_score', 40);
        } else {
          query = query.eq('event_category', filter);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching activity logs:', error);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchLogs();
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
            {[1, 2, 3, 4, 5].map((i) => (
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
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Security Activity</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="failures">Failed Only</SelectItem>
                <SelectItem value="high_risk">High Risk</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Track login attempts, password changes, and security events
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No security activity logged yet</p>
            <p className="text-sm mt-1">Activity will appear here as you use your account</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    !log.success && "border-destructive/30 bg-destructive/5",
                    log.risk_score >= 40 && "border-warning/30 bg-warning/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        log.success ? "bg-muted" : "bg-destructive/10"
                      )}>
                        {EVENT_ICONS[log.event_type] || <Activity className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {EVENT_LABELS[log.event_type] || log.event_type}
                          </span>
                          {!log.success && (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                          {log.success && log.event_type.includes('login') && (
                            <Badge variant="outline" className="text-xs border-success/50 text-success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          )}
                          {getRiskBadge(log.risk_score)}
                        </div>
                        
                        {log.failure_reason && (
                          <p className="text-xs text-destructive mt-1">
                            {log.failure_reason}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                          
                          {log.device_type && (
                            <span className="flex items-center gap-1">
                              {getDeviceIcon(log.device_type)}
                              {log.browser || 'Unknown'} • {log.os || 'Unknown'}
                            </span>
                          )}
                          
                          {log.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {log.location}
                            </span>
                          )}

                          {log.ip_address && (
                            <span className="font-mono text-[10px] opacity-70">
                              IP: {log.ip_address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </div>
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
