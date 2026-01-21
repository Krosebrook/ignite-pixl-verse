import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  UserPlus, 
  UserMinus, 
  Settings, 
  Mail, 
  Shield, 
  Building2,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface AuditLogViewerProps {
  orgId: string;
}

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, typeof History> = {
  member_added: UserPlus,
  member_removed: UserMinus,
  member_role_updated: Shield,
  invitation_sent: Mail,
  invitation_accepted: UserPlus,
  invitation_cancelled: UserMinus,
  org_updated: Building2,
  settings_updated: Settings,
  integration_token_updated: Shield,
  marketplace_content_access: History,
};

const ACTION_COLORS: Record<string, string> = {
  member_added: "bg-green-500/10 text-green-500 border-green-500/20",
  member_removed: "bg-red-500/10 text-red-500 border-red-500/20",
  member_role_updated: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  invitation_sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  invitation_accepted: "bg-green-500/10 text-green-500 border-green-500/20",
  invitation_cancelled: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  org_updated: "bg-primary/10 text-primary border-primary/20",
  settings_updated: "bg-muted text-muted-foreground border-border",
  integration_token_updated: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

const ACTION_LABELS: Record<string, string> = {
  member_added: "Member Added",
  member_removed: "Member Removed",
  member_role_updated: "Role Updated",
  invitation_sent: "Invitation Sent",
  invitation_accepted: "Invitation Accepted",
  invitation_cancelled: "Invitation Cancelled",
  org_updated: "Organization Updated",
  settings_updated: "Settings Updated",
  integration_token_updated: "Integration Updated",
  marketplace_content_access: "Marketplace Access",
};

const PAGE_SIZE = 20;

export function AuditLogViewer({ orgId }: AuditLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-log", orgId, page, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { entries: data as AuditEntry[], totalCount: count || 0 };
    },
    enabled: !!orgId,
  });

  // Filter entries by search query
  const filteredEntries = data?.entries?.filter((entry) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      entry.action.toLowerCase().includes(searchLower) ||
      entry.resource_type.toLowerCase().includes(searchLower) ||
      JSON.stringify(entry.metadata).toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / PAGE_SIZE);

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || History;
    return Icon;
  };

  const getActionDescription = (entry: AuditEntry): string => {
    const metadata = entry.metadata || {};
    
    switch (entry.action) {
      case "member_added":
        return `Added ${metadata.member_email || "a member"} as ${metadata.role || "member"}`;
      case "member_removed":
        return `Removed ${metadata.member_email || "a member"} from the organization`;
      case "member_role_updated":
        return `Changed role from ${metadata.old_role || "unknown"} to ${metadata.new_role || "unknown"}`;
      case "invitation_sent":
        return `Sent invitation to ${metadata.email || "unknown"} as ${metadata.role || "member"}`;
      case "invitation_accepted":
        return `${metadata.email || "Someone"} accepted invitation`;
      case "invitation_cancelled":
        return `Cancelled invitation for ${metadata.email || "unknown"}`;
      case "org_updated":
        return `Updated organization settings`;
      case "settings_updated":
        return `Modified ${metadata.setting || "settings"}`;
      case "integration_token_updated":
        return `Updated integration connection`;
      default:
        return entry.action.replace(/_/g, " ");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Track team changes, invitations, and settings modifications
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="member_added">Member Added</SelectItem>
              <SelectItem value="member_removed">Member Removed</SelectItem>
              <SelectItem value="member_role_updated">Role Updates</SelectItem>
              <SelectItem value="invitation_sent">Invitations Sent</SelectItem>
              <SelectItem value="invitation_accepted">Invitations Accepted</SelectItem>
              <SelectItem value="org_updated">Org Updates</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Log Entries */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredEntries || filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No activity logs found</p>
            <p className="text-sm mt-1">Team changes and settings updates will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredEntries.map((entry) => {
                const Icon = getActionIcon(entry.action);
                const colorClass = ACTION_COLORS[entry.action] || "bg-muted text-muted-foreground border-border";
                
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${colorClass.split(" ")[0]}`}>
                      <Icon className={`h-4 w-4 ${colorClass.split(" ")[1]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${colorClass}`}>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{getActionDescription(entry)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
