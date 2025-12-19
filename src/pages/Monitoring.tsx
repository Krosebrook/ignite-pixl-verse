import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Database, 
  RefreshCw, 
  Server, 
  Shield, 
  Zap,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AlertsPanel } from "@/components/monitoring/AlertsPanel";
import { HealthHistoryChart } from "@/components/monitoring/HealthHistoryChart";

interface CircuitBreakerStatus {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailureTime: string | null;
  lastStateChange: string;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
  lastCheck?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: ServiceHealth[];
  circuitBreakers: CircuitBreakerStatus[];
  metrics: {
    requestsTotal: number;
    errorsTotal: number;
    avgLatencyMs: number;
  };
}

const statusColors = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
};

const statusTextColors = {
  healthy: 'text-green-500',
  degraded: 'text-yellow-500',
  unhealthy: 'text-red-500',
};

const circuitStateColors = {
  closed: 'bg-green-500/10 text-green-500 border-green-500/20',
  open: 'bg-red-500/10 text-red-500 border-red-500/20',
  'half-open': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
};

const circuitStateIcons = {
  closed: CheckCircle2,
  open: AlertCircle,
  'half-open': Clock,
};

function StatusIndicator({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-3 h-3 rounded-full animate-pulse", statusColors[status])} />
      <span className={cn("capitalize font-medium", statusTextColors[status])}>{status}</span>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const Icon = service.status === 'healthy' ? CheckCircle2 : 
               service.status === 'degraded' ? AlertTriangle : AlertCircle;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              service.status === 'healthy' ? 'bg-green-500/10' :
              service.status === 'degraded' ? 'bg-yellow-500/10' : 'bg-red-500/10'
            )}>
              <Icon className={cn(
                "h-5 w-5",
                service.status === 'healthy' ? 'text-green-500' :
                service.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
              )} />
            </div>
            <div>
              <h3 className="font-medium capitalize">{service.name.replace('-', ' ')}</h3>
              {service.message && (
                <p className="text-xs text-muted-foreground">{service.message}</p>
              )}
            </div>
          </div>
          <StatusIndicator status={service.status} />
        </div>
        {service.latencyMs !== undefined && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{service.latencyMs}ms latency</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CircuitBreakerCard({ breaker }: { breaker: CircuitBreakerStatus }) {
  const Icon = circuitStateIcons[breaker.state];
  const timeSinceChange = breaker.lastStateChange 
    ? Math.round((Date.now() - new Date(breaker.lastStateChange).getTime()) / 1000)
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg border",
              circuitStateColors[breaker.state]
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium capitalize">{breaker.name.replace('-', ' ')}</h3>
              <p className="text-xs text-muted-foreground">
                State changed {formatTime(timeSinceChange)} ago
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn("capitalize", circuitStateColors[breaker.state])}
          >
            {breaker.state}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-2xl font-bold text-red-500">{breaker.failures}</p>
            <p className="text-xs text-muted-foreground">Failures</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-2xl font-bold text-green-500">{breaker.successes}</p>
            <p className="text-xs text-muted-foreground">Successes</p>
          </div>
        </div>

        {breaker.lastFailureTime && (
          <p className="text-xs text-muted-foreground mt-3">
            Last failure: {new Date(breaker.lastFailureTime).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            trend === 'up' ? 'bg-green-500/10' :
            trend === 'down' ? 'bg-red-500/10' : 'bg-primary/10'
          )}>
            <Icon className={cn(
              "h-6 w-6",
              trend === 'up' ? 'text-green-500' :
              trend === 'down' ? 'text-red-500' : 'text-primary'
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Monitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: health, isLoading, error, refetch, isRefetching } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(session.session?.access_token && {
              'Authorization': `Bearer ${session.session.access_token}`,
            }),
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      return response.json();
    },
    refetchInterval: autoRefresh ? 10000 : false, // Refresh every 10 seconds
    retry: 1,
  });

  useEffect(() => {
    if (!isRefetching) {
      setLastRefresh(new Date());
    }
  }, [isRefetching]);

  const handleRefresh = () => {
    refetch();
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const errorRate = health?.metrics 
    ? ((health.metrics.errorsTotal / Math.max(health.metrics.requestsTotal, 1)) * 100).toFixed(1)
    : '0';

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-muted-foreground mt-1">
              Real-time health status and circuit breaker states
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(autoRefresh && "bg-primary/10")}
            >
              <Activity className={cn("h-4 w-4 mr-2", autoRefresh && "animate-pulse")} />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Status Banner */}
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-10 w-10 text-red-500" />
                <div>
                  <h2 className="text-xl font-semibold text-red-500">Health Check Failed</h2>
                  <p className="text-muted-foreground">
                    Unable to fetch system health status. Please check your connection.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : health && (
          <Card className={cn(
            "border-2",
            health.status === 'healthy' ? 'border-green-500/20 bg-green-500/5' :
            health.status === 'degraded' ? 'border-yellow-500/20 bg-yellow-500/5' :
            'border-red-500/20 bg-red-500/5'
          )}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-4 rounded-full",
                    health.status === 'healthy' ? 'bg-green-500/20' :
                    health.status === 'degraded' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                  )}>
                    {health.status === 'healthy' ? (
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    ) : health.status === 'degraded' ? (
                      <AlertTriangle className="h-10 w-10 text-yellow-500" />
                    ) : (
                      <AlertCircle className="h-10 w-10 text-red-500" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold capitalize">
                      System {health.status}
                    </h2>
                    <p className="text-muted-foreground">
                      Version {health.version} • Uptime: {formatUptime(health.uptime)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{health.services.filter(s => s.status === 'healthy').length}/{health.services.length}</p>
                    <p className="text-xs text-muted-foreground">Services Healthy</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{health.circuitBreakers.filter(cb => cb.state === 'closed').length}/{health.circuitBreakers.length}</p>
                    <p className="text-xs text-muted-foreground">Circuits Closed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Overview */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Requests"
              value={health.metrics.requestsTotal.toLocaleString()}
              subtitle="All-time requests"
              icon={TrendingUp}
              trend="neutral"
            />
            <MetricCard
              title="Error Rate"
              value={`${errorRate}%`}
              subtitle={`${health.metrics.errorsTotal} errors`}
              icon={AlertCircle}
              trend={Number(errorRate) > 5 ? 'down' : 'up'}
            />
            <MetricCard
              title="Avg Latency"
              value={`${health.metrics.avgLatencyMs}ms`}
              subtitle="Response time"
              icon={Zap}
              trend={health.metrics.avgLatencyMs > 500 ? 'down' : 'up'}
            />
            <MetricCard
              title="Uptime"
              value={formatUptime(health.uptime)}
              subtitle="Since last restart"
              icon={Server}
              trend="neutral"
            />
          </div>
        )}

        {/* Alerts Panel */}
        {health && (
          <AlertsPanel 
            circuitBreakers={health.circuitBreakers}
            services={health.services}
          />
        )}

        {/* Health History Charts */}
        {health && (
          <HealthHistoryChart currentHealth={health} />
        )}

        {/* Services Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Health
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : health && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {health.services.map(service => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
          )}
        </div>

        {/* Circuit Breakers Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Circuit Breakers
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : health && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {health.circuitBreakers.map(breaker => (
                <CircuitBreakerCard key={breaker.name} breaker={breaker} />
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Circuit Breaker States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={circuitStateColors['closed']}>
                  Closed
                </Badge>
                <span className="text-sm text-muted-foreground">Normal operation, requests flow through</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={circuitStateColors['half-open']}>
                  Half-Open
                </Badge>
                <span className="text-sm text-muted-foreground">Testing if service recovered</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={circuitStateColors['open']}>
                  Open
                </Badge>
                <span className="text-sm text-muted-foreground">Requests blocked, service failing</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
