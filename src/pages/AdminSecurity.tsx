import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Shield,
  AlertTriangle,
  Users,
  Lock,
  RefreshCw,
  Filter,
  Search,
  Download,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Smartphone,
  Monitor,
  Tablet,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Key,
  LogIn,
  LogOut,
  Fingerprint,
  Mail,
  Unlock,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SecurityEvent {
  id: string;
  user_id: string;
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
  user_email?: string;
  user_name?: string;
}

interface SecurityStats {
  totalEvents: number;
  failedLogins: number;
  highRiskEvents: number;
  uniqueUsers: number;
  accountLockouts: number;
  mfaChanges: number;
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
  return <Badge variant="outline" className="text-xs">Low Risk</Badge>;
}

export default function AdminSecurity() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { orgId, isAdmin, isLoading: orgLoading } = useCurrentOrg();

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 0,
    failedLogins: 0,
    highRiskEvents: 0,
    uniqueUsers: 0,
    accountLockouts: 0,
    mfaChanges: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState("7d");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string }>>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!orgLoading && orgId && !isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [orgLoading, isAdmin, navigate, orgId]);

  useEffect(() => {
    if (orgId && isAdmin) {
      fetchEvents();
      fetchOrgUsers();
    }
  }, [orgId, isAdmin, filter, dateRange, selectedUser]);

  const getDateRangeFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "24h":
        return subDays(now, 1);
      case "7d":
        return subDays(now, 7);
      case "30d":
        return subDays(now, 30);
      case "90d":
        return subDays(now, 90);
      default:
        return subDays(now, 7);
    }
  };

  const fetchOrgUsers = async () => {
    if (!orgId) return;

    try {
      const { data: members, error } = await supabase
        .from("members")
        .select("user_id")
        .eq("org_id", orgId);

      if (error) throw error;

      if (members && members.length > 0) {
        const userIds = members.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        const userList = userIds.map((id) => {
          const profile = profiles?.find((p) => p.id === id);
          return {
            id,
            email: id.substring(0, 8) + "...",
            name: profile?.display_name || "Unknown User",
          };
        });

        setUsers(userList);
      }
    } catch (error) {
      console.error("Error fetching org users:", error);
    }
  };

  const fetchEvents = async () => {
    if (!orgId) return;

    try {
      // First get all member user_ids for this org
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select("user_id")
        .eq("org_id", orgId);

      if (membersError) throw membersError;

      if (!members || members.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const userIds = members.map((m) => m.user_id);
      const startDate = getDateRangeFilter();

      let query = supabase
        .from("security_activity_log")
        .select("*")
        .in("user_id", userIds)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (filter !== "all") {
        if (filter === "failures") {
          query = query.eq("success", false);
        } else if (filter === "high_risk") {
          query = query.gte("risk_score", 40);
        } else {
          query = query.eq("event_category", filter);
        }
      }

      if (selectedUser) {
        query = query.eq("user_id", selectedUser);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get profiles for display names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const eventsWithUsers = (data || []).map((event) => {
        const profile = profiles?.find((p) => p.id === event.user_id);
        return {
          ...event,
          user_name: profile?.display_name || "Unknown User",
          user_email: event.user_id.substring(0, 8) + "...",
        };
      });

      setEvents(eventsWithUsers);

      // Calculate stats
      const failedLogins = eventsWithUsers.filter(
        (e) => e.event_type === "login_failure"
      ).length;
      const highRiskEvents = eventsWithUsers.filter(
        (e) => e.risk_score >= 40
      ).length;
      const uniqueUsers = new Set(eventsWithUsers.map((e) => e.user_id)).size;
      const accountLockouts = eventsWithUsers.filter(
        (e) => e.event_type === "account_locked"
      ).length;
      const mfaChanges = eventsWithUsers.filter(
        (e) =>
          e.event_type === "mfa_enabled" || e.event_type === "mfa_disabled"
      ).length;

      setStats({
        totalEvents: eventsWithUsers.length,
        failedLogins,
        highRiskEvents,
        uniqueUsers,
        accountLockouts,
        mfaChanges,
      });
    } catch (error) {
      console.error("Error fetching security events:", error);
      toast.error("Failed to load security events");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
    toast.success("Security data refreshed");
  };

  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "User",
      "Event Type",
      "Category",
      "Success",
      "IP Address",
      "Location",
      "Device",
      "Risk Score",
    ];

    const rows = events.map((event) => [
      format(new Date(event.created_at), "yyyy-MM-dd HH:mm:ss"),
      event.user_name || event.user_id,
      EVENT_LABELS[event.event_type] || event.event_type,
      event.event_category,
      event.success ? "Yes" : "No",
      event.ip_address || "N/A",
      event.location || "N/A",
      event.device_type || "N/A",
      event.risk_score.toString(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `security-activity-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    
    toast.success("Security report exported");
  };

  const filteredEvents = events.filter((event) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.user_name?.toLowerCase().includes(query) ||
      event.event_type.toLowerCase().includes(query) ||
      event.ip_address?.toLowerCase().includes(query) ||
      event.location?.toLowerCase().includes(query)
    );
  });

  if (authLoading || orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title="Admin Security Dashboard"
          description="Monitor security activity across all users in your organization"
          icon={ShieldAlert}
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{stats.totalEvents}</p>
                </div>
                <Activity className="h-8 w-8 text-primary opacity-70" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Failed Logins</p>
                  <p className="text-2xl font-bold text-destructive">
                    {stats.failedLogins}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-destructive opacity-70" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">High Risk</p>
                  <p className="text-2xl font-bold text-warning">
                    {stats.highRiskEvents}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning opacity-70" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-70" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Lockouts</p>
                  <p className="text-2xl font-bold text-destructive">
                    {stats.accountLockouts}
                  </p>
                </div>
                <UserX className="h-8 w-8 text-destructive opacity-70" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">MFA Changes</p>
                  <p className="text-2xl font-bold">{stats.mfaChanges}</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-success opacity-70" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Security Activity Log</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>

                <Select value={selectedUser || "all"} onValueChange={(v) => setSelectedUser(v === "all" ? null : v)}>
                  <SelectTrigger className="w-[150px]">
                    <Users className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[140px]">
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

                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[120px]">
                    <Clock className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="7 days" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24h</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", refreshing && "animate-spin")}
                  />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No security activity found</p>
                <p className="text-sm mt-1">
                  Try adjusting your filters or date range
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.slice(0, 100).map((event) => (
                      <TableRow
                        key={event.id}
                        className={cn(
                          !event.success && "bg-destructive/5",
                          event.risk_score >= 40 && "bg-warning/5"
                        )}
                      >
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">
                            {format(new Date(event.created_at), "MMM d, HH:mm")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {event.user_name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {event.user_email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {EVENT_ICONS[event.event_type] || (
                              <Activity className="h-4 w-4" />
                            )}
                            <span className="text-sm">
                              {EVENT_LABELS[event.event_type] || event.event_type}
                            </span>
                          </div>
                          {event.failure_reason && (
                            <div className="text-xs text-destructive mt-1">
                              {event.failure_reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.success ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-success/50 text-success"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.location ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {event.location}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Unknown
                            </span>
                          )}
                          {event.ip_address && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {event.ip_address}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            {getDeviceIcon(event.device_type)}
                            <span>{event.browser || "Unknown"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {event.os || "Unknown OS"}
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(event.risk_score)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {filteredEvents.length > 100 && (
              <div className="text-center text-sm text-muted-foreground mt-4">
                Showing first 100 of {filteredEvents.length} events
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
