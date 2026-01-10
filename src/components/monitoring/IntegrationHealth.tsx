import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Link2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  ExternalLink,
  Shield,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";

interface Integration {
  id: string;
  provider: string;
  status: string;
  expires_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type HealthStatus = 'healthy' | 'expiring_soon' | 'expired' | 'error' | 'unknown';

interface IntegrationWithHealth extends Integration {
  healthStatus: HealthStatus;
  expiresInHours: number | null;
  healthMessage: string;
}

const providerIcons: Record<string, string> = {
  google_drive: '📁',
  instagram: '📸',
  twitter: '🐦',
  linkedin: '💼',
  facebook: '📘',
  shopify: '🛒',
  notion: '📝',
  zapier: '⚡',
  tiktok: '🎵',
  youtube: '🎬',
};

const providerNames: Record<string, string> = {
  google_drive: 'Google Drive',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  shopify: 'Shopify',
  notion: 'Notion',
  zapier: 'Zapier',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const statusColors: Record<HealthStatus, string> = {
  healthy: 'bg-green-500/10 text-green-500 border-green-500/20',
  expiring_soon: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  expired: 'bg-red-500/10 text-red-500 border-red-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  unknown: 'bg-muted text-muted-foreground border-muted',
};

const statusIcons: Record<HealthStatus, React.ElementType> = {
  healthy: CheckCircle2,
  expiring_soon: Clock,
  expired: AlertCircle,
  error: AlertTriangle,
  unknown: Shield,
};

function getIntegrationHealth(integration: Integration): IntegrationWithHealth {
  const now = new Date();
  
  if (integration.status === 'error' || integration.status === 'failed') {
    return {
      ...integration,
      healthStatus: 'error',
      expiresInHours: null,
      healthMessage: 'Integration failed - needs re-authentication',
    };
  }
  
  if (!integration.expires_at) {
    // Permanent tokens (Shopify, Notion, Zapier)
    return {
      ...integration,
      healthStatus: 'healthy',
      expiresInHours: null,
      healthMessage: 'Permanent token - no expiration',
    };
  }
  
  const expiresAt = new Date(integration.expires_at);
  const hoursUntilExpiry = differenceInHours(expiresAt, now);
  const daysUntilExpiry = differenceInDays(expiresAt, now);
  
  if (hoursUntilExpiry < 0) {
    return {
      ...integration,
      healthStatus: 'expired',
      expiresInHours: hoursUntilExpiry,
      healthMessage: `Expired ${formatDistanceToNow(expiresAt)} ago - needs re-authentication`,
    };
  }
  
  if (hoursUntilExpiry < 24) {
    return {
      ...integration,
      healthStatus: 'expiring_soon',
      expiresInHours: hoursUntilExpiry,
      healthMessage: `Expires in ${hoursUntilExpiry} hours - auto-refresh scheduled`,
    };
  }
  
  if (daysUntilExpiry < 7) {
    return {
      ...integration,
      healthStatus: 'expiring_soon',
      expiresInHours: hoursUntilExpiry,
      healthMessage: `Expires in ${daysUntilExpiry} days`,
    };
  }
  
  return {
    ...integration,
    healthStatus: 'healthy',
    expiresInHours: hoursUntilExpiry,
    healthMessage: `Healthy - expires in ${daysUntilExpiry} days`,
  };
}

function IntegrationCard({ integration }: { integration: IntegrationWithHealth }) {
  const Icon = statusIcons[integration.healthStatus];
  const providerIcon = providerIcons[integration.provider] || '🔗';
  const providerName = providerNames[integration.provider] || integration.provider;
  
  const expiryProgress = integration.expiresInHours !== null
    ? Math.max(0, Math.min(100, (integration.expiresInHours / (30 * 24)) * 100))
    : 100;
  
  return (
    <Card className={cn(
      "overflow-hidden border transition-all hover:shadow-md",
      integration.healthStatus === 'error' && "border-red-500/30",
      integration.healthStatus === 'expired' && "border-red-500/30",
      integration.healthStatus === 'expiring_soon' && "border-yellow-500/30"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{providerIcon}</div>
            <div>
              <h3 className="font-medium">{providerName}</h3>
              <p className="text-xs text-muted-foreground">
                Connected {formatDistanceToNow(new Date(integration.created_at))} ago
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn("capitalize text-xs", statusColors[integration.healthStatus])}
          >
            <Icon className="h-3 w-3 mr-1" />
            {integration.healthStatus.replace('_', ' ')}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3">
          {integration.healthMessage}
        </p>
        
        {integration.expires_at && integration.healthStatus !== 'expired' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Token validity</span>
              <span>
                {integration.expiresInHours !== null && integration.expiresInHours > 0
                  ? `${Math.floor(integration.expiresInHours / 24)}d ${integration.expiresInHours % 24}h remaining`
                  : 'Expired'}
              </span>
            </div>
            <Progress 
              value={expiryProgress} 
              className={cn(
                "h-1.5",
                integration.healthStatus === 'expiring_soon' && "[&>div]:bg-yellow-500",
                integration.healthStatus === 'healthy' && "[&>div]:bg-green-500"
              )}
            />
          </div>
        )}
        
        {integration.last_sync_at && (
          <p className="text-xs text-muted-foreground mt-2">
            Last synced: {formatDistanceToNow(new Date(integration.last_sync_at))} ago
          </p>
        )}
        
        {(integration.healthStatus === 'expired' || integration.healthStatus === 'error') && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-3 border-red-500/30 text-red-500 hover:bg-red-500/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-authenticate
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function HealthSummaryCard({ 
  integrations 
}: { 
  integrations: IntegrationWithHealth[] 
}) {
  const healthy = integrations.filter(i => i.healthStatus === 'healthy').length;
  const expiringSoon = integrations.filter(i => i.healthStatus === 'expiring_soon').length;
  const needsAttention = integrations.filter(i => 
    i.healthStatus === 'expired' || i.healthStatus === 'error'
  ).length;
  
  const overallStatus = needsAttention > 0 ? 'critical' : expiringSoon > 0 ? 'warning' : 'healthy';
  
  return (
    <Card className={cn(
      "border-2",
      overallStatus === 'healthy' && "border-green-500/20 bg-green-500/5",
      overallStatus === 'warning' && "border-yellow-500/20 bg-yellow-500/5",
      overallStatus === 'critical' && "border-red-500/20 bg-red-500/5"
    )}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-4 rounded-full",
              overallStatus === 'healthy' && "bg-green-500/20",
              overallStatus === 'warning' && "bg-yellow-500/20",
              overallStatus === 'critical' && "bg-red-500/20"
            )}>
              {overallStatus === 'healthy' ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : overallStatus === 'warning' ? (
                <Clock className="h-8 w-8 text-yellow-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {overallStatus === 'healthy' && 'All Integrations Healthy'}
                {overallStatus === 'warning' && 'Some Integrations Expiring Soon'}
                {overallStatus === 'critical' && 'Integrations Need Attention'}
              </h2>
              <p className="text-muted-foreground">
                {integrations.length} integration{integrations.length !== 1 ? 's' : ''} connected
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{healthy}</p>
              <p className="text-xs text-muted-foreground">Healthy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-500">{expiringSoon}</p>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{needsAttention}</p>
              <p className="text-xs text-muted-foreground">Needs Action</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegrationHealth() {
  const { orgId, isLoading: orgLoading } = useCurrentOrg();
  
  const { data: integrations, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['integration-health', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('integrations')
        .select('id, provider, status, expires_at, last_sync_at, created_at, metadata')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Map the database response to our Integration type
      return (data || []).map(row => {
        const integration: Integration = {
          id: row.id,
          provider: row.provider,
          status: row.status,
          expires_at: row.expires_at,
          last_sync_at: row.last_sync_at,
          created_at: row.created_at,
          metadata: typeof row.metadata === 'object' && row.metadata !== null && !Array.isArray(row.metadata)
            ? row.metadata as Record<string, unknown>
            : null,
        };
        return getIntegrationHealth(integration);
      });
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Refresh every minute
  });
  
  if (orgLoading || !orgId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Select an organization to view integration health
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-500">Failed to load integrations</h3>
              <p className="text-muted-foreground text-sm">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!integrations || integrations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Integrations Connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your social media accounts and tools to start publishing content.
          </p>
          <Button>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Integration
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Integration Health
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor OAuth token status and expiration
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
          Refresh
        </Button>
      </div>
      
      {/* Summary Card */}
      <HealthSummaryCard integrations={integrations} />
      
      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>
      
      {/* Auto-refresh info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-medium">Automatic Token Refresh</h4>
              <p className="text-sm text-muted-foreground">
                Tokens expiring within 24 hours are automatically refreshed every 6 hours. 
                If auto-refresh fails, you'll receive a webhook notification and need to re-authenticate manually.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
