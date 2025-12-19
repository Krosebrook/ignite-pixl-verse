import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  BellOff, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Volume2,
  VolumeX
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export interface Alert {
  id: string;
  type: 'circuit_breaker_open' | 'service_unhealthy' | 'service_degraded' | 'circuit_breaker_recovered' | 'service_recovered';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  source: string;
}

interface AlertsPanelProps {
  circuitBreakers: Array<{
    name: string;
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    lastStateChange: string;
  }>;
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
  }>;
}

const severityColors = {
  critical: 'bg-red-500/10 border-red-500/20 text-red-500',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
};

const severityIcons = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: CheckCircle2,
};

export function AlertsPanel({ circuitBreakers, services }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [previousState, setPreviousState] = useState<{
    circuitBreakers: Map<string, string>;
    services: Map<string, string>;
  }>({ circuitBreakers: new Map(), services: new Map() });

  const playAlertSound = useCallback(() => {
    if (soundEnabled) {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  }, [soundEnabled]);

  const addAlert = useCallback((alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      acknowledged: false,
    };

    setAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50 alerts

    // Show toast notification
    toast({
      title: alert.title,
      description: alert.message,
      variant: alert.severity === 'critical' ? 'destructive' : 'default',
    });

    // Play sound for critical alerts
    if (alert.severity === 'critical') {
      playAlertSound();
    }
  }, [playAlertSound]);

  // Monitor for state changes
  useEffect(() => {
    if (!alertsEnabled) return;

    // Check circuit breakers
    circuitBreakers.forEach(cb => {
      const prevState = previousState.circuitBreakers.get(cb.name);
      
      if (prevState && prevState !== cb.state) {
        if (cb.state === 'open') {
          addAlert({
            type: 'circuit_breaker_open',
            severity: 'critical',
            title: 'Circuit Breaker Opened',
            message: `${cb.name} circuit breaker has opened after ${cb.failures} failures`,
            source: cb.name,
          });
        } else if (cb.state === 'closed' && prevState === 'open') {
          addAlert({
            type: 'circuit_breaker_recovered',
            severity: 'info',
            title: 'Circuit Breaker Recovered',
            message: `${cb.name} circuit breaker has recovered and closed`,
            source: cb.name,
          });
        }
      }
    });

    // Check services
    services.forEach(svc => {
      const prevStatus = previousState.services.get(svc.name);
      
      if (prevStatus && prevStatus !== svc.status) {
        if (svc.status === 'unhealthy') {
          addAlert({
            type: 'service_unhealthy',
            severity: 'critical',
            title: 'Service Unhealthy',
            message: `${svc.name} service is now unhealthy`,
            source: svc.name,
          });
        } else if (svc.status === 'degraded') {
          addAlert({
            type: 'service_degraded',
            severity: 'warning',
            title: 'Service Degraded',
            message: `${svc.name} service is experiencing degraded performance`,
            source: svc.name,
          });
        } else if (svc.status === 'healthy' && (prevStatus === 'unhealthy' || prevStatus === 'degraded')) {
          addAlert({
            type: 'service_recovered',
            severity: 'info',
            title: 'Service Recovered',
            message: `${svc.name} service has recovered and is now healthy`,
            source: svc.name,
          });
        }
      }
    });

    // Update previous state
    setPreviousState({
      circuitBreakers: new Map(circuitBreakers.map(cb => [cb.name, cb.state])),
      services: new Map(services.map(svc => [svc.name, svc.status])),
    });
  }, [circuitBreakers, services, alertsEnabled, previousState, addAlert]);

  const acknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, acknowledged: true } : alert
    ));
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alerts
              {unacknowledgedCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unacknowledgedCount}
                </Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="sound"
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
              <Label htmlFor="sound" className="text-sm cursor-pointer">
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="alerts"
                checked={alertsEnabled}
                onCheckedChange={setAlertsEnabled}
              />
              <Label htmlFor="alerts" className="text-sm cursor-pointer">
                {alertsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
              </Label>
            </div>
            {alerts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllAlerts}>
                Clear All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {criticalCount > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">{criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require attention</span>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No alerts</p>
            <p className="text-sm">Alerts will appear here when system issues are detected</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {alerts.map(alert => {
                const Icon = severityIcons[alert.severity];
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      severityColors[alert.severity],
                      alert.acknowledged && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alert.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {alert.source}
                            </Badge>
                          </div>
                          <p className="text-sm opacity-80 mt-0.5">{alert.message}</p>
                          <p className="text-xs opacity-60 mt-1">
                            {alert.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!alert.acknowledged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            Ack
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => dismissAlert(alert.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
