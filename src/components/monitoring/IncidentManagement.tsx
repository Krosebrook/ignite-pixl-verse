import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertOctagon, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Search,
  User,
  MessageSquare,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { Alert } from "./AlertsPanel";

type IncidentSeverity = 'critical' | 'major' | 'minor' | 'warning';
type IncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

interface Incident {
  id: string;
  org_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  source_type: string | null;
  source_name: string | null;
  alert_id: string | null;
  started_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface IncidentUpdate {
  id: string;
  incident_id: string;
  user_id: string;
  update_type: string;
  previous_value: string | null;
  new_value: string | null;
  message: string | null;
  created_at: string;
}

interface IncidentManagementProps {
  alerts?: Alert[];
  onCreateFromAlert?: (alertId: string) => void;
}

const severityColors: Record<IncidentSeverity, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  major: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  minor: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  warning: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const statusColors: Record<IncidentStatus, string> = {
  open: 'bg-red-500/10 text-red-500 border-red-500/20',
  investigating: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  identified: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  monitoring: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  resolved: 'bg-green-500/10 text-green-500 border-green-500/20',
};

const statusLabels: Record<IncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

export function IncidentManagement({ alerts = [] }: IncidentManagementProps) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Form state for new incident
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    severity: 'warning' as IncidentSeverity,
    source_type: '',
    source_name: '',
  });

  // Fetch incidents
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents', organization?.id, statusFilter],
    queryFn: async () => {
      if (!organization?.id) return [];

      let query = supabase
        .from('incidents')
        .select('*')
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') {
        query = query.neq('status', 'resolved' as const);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as IncidentStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Incident[];
    },
    enabled: !!organization?.id,
  });

  // Fetch updates for selected incident
  const { data: incidentUpdates = [] } = useQuery({
    queryKey: ['incident-updates', selectedIncident?.id],
    queryFn: async () => {
      if (!selectedIncident?.id) return [];

      const { data, error } = await supabase
        .from('incident_updates')
        .select('*')
        .eq('incident_id', selectedIncident.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as IncidentUpdate[];
    },
    enabled: !!selectedIncident?.id,
  });

  // Create incident mutation
  const createIncidentMutation = useMutation({
    mutationFn: async (incident: typeof newIncident & { alert_id?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user || !organization?.id) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('incidents')
        .insert({
          org_id: organization.id,
          created_by: session.session.user.id,
          title: incident.title,
          description: incident.description || null,
          severity: incident.severity,
          source_type: incident.source_type || null,
          source_name: incident.source_name || null,
          alert_id: incident.alert_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setCreateDialogOpen(false);
      setNewIncident({ title: '', description: '', severity: 'warning', source_type: '', source_name: '' });
      toast({ title: 'Incident created', description: 'The incident has been created successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update incident status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ incidentId, status, message }: { incidentId: string; status: IncidentStatus; message?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) throw new Error('Not authenticated');

      const updates: { 
        status: IncidentStatus; 
        resolved_at?: string; 
        acknowledged_at?: string; 
      } = { status };
      
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      if (status !== 'open' && !selectedIncident?.acknowledged_at) {
        updates.acknowledged_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('incidents')
        .update(updates)
        .eq('id', incidentId);

      if (updateError) throw updateError;

      // Add update record
      const { error: logError } = await supabase
        .from('incident_updates')
        .insert({
          incident_id: incidentId,
          user_id: session.session.user.id,
          update_type: 'status_change',
          previous_value: selectedIncident?.status,
          new_value: status,
          message: message || null,
        });

      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident-updates'] });
      toast({ title: 'Status updated', description: 'Incident status has been updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ incidentId, message }: { incidentId: string; message: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('incident_updates')
        .insert({
          incident_id: incidentId,
          user_id: session.session.user.id,
          update_type: 'comment',
          message,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident-updates'] });
      toast({ title: 'Comment added' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createFromAlert = (alert: Alert) => {
    setNewIncident({
      title: alert.title,
      description: alert.message,
      severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'minor' : 'warning',
      source_type: alert.type.includes('circuit') ? 'circuit_breaker' : 'service',
      source_name: alert.source,
    });
    setCreateDialogOpen(true);
  };

  const filteredIncidents = incidents.filter(incident => 
    incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    incident.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = incidents.filter(i => i.status !== 'resolved').length;
  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertOctagon className="h-5 w-5" />
              Incidents
              {activeCount > 0 && (
                <Badge variant="outline" className="ml-2">
                  {activeCount} active
                </Badge>
              )}
              {criticalCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {criticalCount} critical
                </Badge>
              )}
            </CardTitle>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Incident
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Incident</DialogTitle>
                <DialogDescription>
                  Create a new incident to track and manage a system issue.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newIncident.title}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Brief description of the incident"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newIncident.description}
                    onChange={(e) => setNewIncident(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Detailed description of what happened"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Severity</Label>
                    <Select
                      value={newIncident.severity}
                      onValueChange={(value: IncidentSeverity) => setNewIncident(prev => ({ ...prev, severity: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source</Label>
                    <Input
                      value={newIncident.source_name}
                      onChange={(e) => setNewIncident(prev => ({ ...prev, source_name: e.target.value }))}
                      placeholder="e.g., api-gateway"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createIncidentMutation.mutate(newIncident)}
                  disabled={!newIncident.title || createIncidentMutation.isPending}
                >
                  {createIncidentMutation.isPending ? 'Creating...' : 'Create Incident'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Create from alerts section */}
        {alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <p className="text-sm font-medium text-red-500 mb-2">
              {alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length} critical alerts can be escalated to incidents
            </p>
            <div className="flex flex-wrap gap-2">
              {alerts.filter(a => a.severity === 'critical' && !a.acknowledged).slice(0, 3).map(alert => (
                <Button
                  key={alert.id}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => createFromAlert(alert)}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  {alert.source}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Incidents list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading incidents...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertOctagon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No incidents found</p>
            <p className="text-sm">Create an incident when issues arise</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {filteredIncidents.map(incident => (
                <div
                  key={incident.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedIncident(incident);
                    setDetailsOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-xs", severityColors[incident.severity])}>
                          {incident.severity}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs", statusColors[incident.status])}>
                          {statusLabels[incident.status]}
                        </Badge>
                        {incident.source_name && (
                          <span className="text-xs text-muted-foreground">
                            {incident.source_name}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium truncate">{incident.title}</h4>
                      {incident.description && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {incident.description}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(incident.started_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Incident Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            {selectedIncident && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={severityColors[selectedIncident.severity]}>
                      {selectedIncident.severity}
                    </Badge>
                    <Badge variant="outline" className={statusColors[selectedIncident.status]}>
                      {statusLabels[selectedIncident.status]}
                    </Badge>
                  </div>
                  <DialogTitle>{selectedIncident.title}</DialogTitle>
                  <DialogDescription>
                    Started {new Date(selectedIncident.started_at).toLocaleString()}
                    {selectedIncident.source_name && ` • ${selectedIncident.source_name}`}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="details" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline ({incidentUpdates.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="mt-1">{selectedIncident.description || 'No description provided'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <Select
                          value={selectedIncident.status}
                          onValueChange={(value: IncidentStatus) => {
                            updateStatusMutation.mutate({ incidentId: selectedIncident.id, status: value });
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="investigating">Investigating</SelectItem>
                            <SelectItem value="identified">Identified</SelectItem>
                            <SelectItem value="monitoring">Monitoring</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Duration</Label>
                        <p className="mt-2">
                          {selectedIncident.resolved_at 
                            ? `${Math.round((new Date(selectedIncident.resolved_at).getTime() - new Date(selectedIncident.started_at).getTime()) / 60000)} minutes`
                            : formatTime(selectedIncident.started_at)
                          }
                        </p>
                      </div>
                    </div>

                    {selectedIncident.status === 'resolved' && selectedIncident.resolution_notes && (
                      <div>
                        <Label className="text-muted-foreground">Resolution Notes</Label>
                        <p className="mt-1">{selectedIncident.resolution_notes}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="timeline">
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-3">
                        {incidentUpdates.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">No updates yet</p>
                        ) : (
                          incidentUpdates.map(update => (
                            <div key={update.id} className="flex gap-3 text-sm">
                              <div className="flex-shrink-0 mt-1">
                                {update.update_type === 'status_change' ? (
                                  <RefreshCw className="h-4 w-4 text-blue-500" />
                                ) : update.update_type === 'comment' ? (
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1">
                                {update.update_type === 'status_change' ? (
                                  <p>
                                    Status changed from <Badge variant="outline" className="text-xs">{update.previous_value}</Badge>
                                    {' to '}<Badge variant="outline" className="text-xs">{update.new_value}</Badge>
                                  </p>
                                ) : (
                                  <p>{update.message}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(update.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>

                    {/* Add comment form */}
                    <form
                      className="mt-4 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const input = form.elements.namedItem('comment') as HTMLInputElement;
                        if (input.value.trim()) {
                          addCommentMutation.mutate({ incidentId: selectedIncident.id, message: input.value.trim() });
                          input.value = '';
                        }
                      }}
                    >
                      <Input
                        name="comment"
                        placeholder="Add an update..."
                        className="flex-1"
                      />
                      <Button type="submit" size="sm" disabled={addCommentMutation.isPending}>
                        Add
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
