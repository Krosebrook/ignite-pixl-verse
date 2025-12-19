import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { TrendingUp, Clock, Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthDataPoint {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  servicesHealthy: number;
  servicesTotal: number;
  circuitsClosed: number;
  circuitsTotal: number;
  latencyMs: number;
  errorRate: number;
  requestsPerMinute: number;
}

interface HealthHistoryChartProps {
  currentHealth?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{ status: string }>;
    circuitBreakers: Array<{ state: string }>;
    metrics: {
      requestsTotal: number;
      errorsTotal: number;
      avgLatencyMs: number;
    };
  };
}

const statusToNumber = (status: string) => {
  switch (status) {
    case 'healthy': return 100;
    case 'degraded': return 50;
    case 'unhealthy': return 0;
    default: return 0;
  }
};

export function HealthHistoryChart({ currentHealth }: HealthHistoryChartProps) {
  const [history, setHistory] = useState<HealthDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'5m' | '15m' | '1h' | '24h'>('15m');

  // Add new data point when health changes
  useEffect(() => {
    if (!currentHealth) return;

    const newPoint: HealthDataPoint = {
      timestamp: new Date(),
      status: currentHealth.status,
      servicesHealthy: currentHealth.services.filter(s => s.status === 'healthy').length,
      servicesTotal: currentHealth.services.length,
      circuitsClosed: currentHealth.circuitBreakers.filter(cb => cb.state === 'closed').length,
      circuitsTotal: currentHealth.circuitBreakers.length,
      latencyMs: currentHealth.metrics.avgLatencyMs,
      errorRate: currentHealth.metrics.requestsTotal > 0 
        ? (currentHealth.metrics.errorsTotal / currentHealth.metrics.requestsTotal) * 100 
        : 0,
      requestsPerMinute: Math.round(Math.random() * 50 + 20), // Simulated RPM
    };

    setHistory(prev => {
      const maxPoints = timeRange === '5m' ? 30 : timeRange === '15m' ? 90 : timeRange === '1h' ? 360 : 1440;
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - (
        timeRange === '5m' ? 5 : timeRange === '15m' ? 15 : timeRange === '1h' ? 60 : 1440
      ));
      
      const filtered = prev.filter(p => p.timestamp > cutoffTime);
      return [...filtered, newPoint].slice(-maxPoints);
    });
  }, [currentHealth, timeRange]);

  const chartData = history.map(point => ({
    time: point.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullTime: point.timestamp.toLocaleString(),
    health: statusToNumber(point.status),
    latency: point.latencyMs,
    errorRate: point.errorRate.toFixed(2),
    rpm: point.requestsPerMinute,
    servicesUp: (point.servicesHealthy / point.servicesTotal) * 100,
    circuitsUp: (point.circuitsClosed / point.circuitsTotal) * 100,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{payload[0]?.payload?.fullTime}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name.includes('Rate') || entry.name.includes('Up') ? '%' : entry.name === 'Latency' ? 'ms' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Health History
          </CardTitle>
          <div className="flex items-center gap-2">
            {(['5m', '15m', '1h', '24h'] as const).map(range => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="latency">Latency</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="throughput">Throughput</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="h-[300px]">
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Collecting data...</p>
                  <p className="text-sm">Chart will appear after a few data points</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCircuits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="servicesUp" 
                    name="Services Up"
                    stroke="#22c55e" 
                    fillOpacity={1}
                    fill="url(#colorServices)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="circuitsUp" 
                    name="Circuits Closed"
                    stroke="#3b82f6" 
                    fillOpacity={1}
                    fill="url(#colorCircuits)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          <TabsContent value="latency" className="h-[300px]">
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Collecting latency data...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}ms`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    name="Latency"
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          <TabsContent value="errors" className="h-[300px]">
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Collecting error data...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[0, 'auto']}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="errorRate" 
                    name="Error Rate"
                    stroke="#ef4444" 
                    fillOpacity={1}
                    fill="url(#colorError)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          <TabsContent value="throughput" className="h-[300px]">
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Collecting throughput data...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}/m`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="rpm" 
                    name="Requests/min"
                    fill="#8b5cf6" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
