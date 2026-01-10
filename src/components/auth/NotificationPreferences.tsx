import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Shield, Smartphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotificationPrefs {
  login_alerts_enabled: boolean;
  new_device_alerts_enabled: boolean;
  security_alerts_enabled: boolean;
}

export function NotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPrefs>({
    login_alerts_enabled: true,
    new_device_alerts_enabled: true,
    security_alerts_enabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPrefs, setOriginalPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const prefs = {
          login_alerts_enabled: data.login_alerts_enabled,
          new_device_alerts_enabled: data.new_device_alerts_enabled,
          security_alerts_enabled: data.security_alerts_enabled,
        };
        setPreferences(prefs);
        setOriginalPrefs(prefs);
      } else {
        // Create default preferences
        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert({
            user_id: user.id,
            login_alerts_enabled: true,
            new_device_alerts_enabled: true,
            security_alerts_enabled: true,
          });

        if (insertError) throw insertError;
        
        const defaultPrefs = {
          login_alerts_enabled: true,
          new_device_alerts_enabled: true,
          security_alerts_enabled: true,
        };
        setOriginalPrefs(defaultPrefs);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
      toast.error("Failed to load notification preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationPrefs) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);
    setHasChanges(
      originalPrefs !== null &&
      (newPrefs.login_alerts_enabled !== originalPrefs.login_alerts_enabled ||
        newPrefs.new_device_alerts_enabled !== originalPrefs.new_device_alerts_enabled ||
        newPrefs.security_alerts_enabled !== originalPrefs.security_alerts_enabled)
    );
  };

  const savePreferences = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .update({
          login_alerts_enabled: preferences.login_alerts_enabled,
          new_device_alerts_enabled: preferences.new_device_alerts_enabled,
          security_alerts_enabled: preferences.security_alerts_enabled,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setOriginalPrefs(preferences);
      setHasChanges(false);
      toast.success("Notification preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which security alerts you want to receive via email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Login Alerts */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="login-alerts" className="font-medium">
                  Login Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive an email whenever you sign in to your account
                </p>
              </div>
            </div>
            <Switch
              id="login-alerts"
              checked={preferences.login_alerts_enabled}
              onCheckedChange={() => handleToggle("login_alerts_enabled")}
            />
          </div>

          {/* New Device Alerts */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-ff-accent/10 p-2">
                <Smartphone className="h-4 w-4 text-ff-accent" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-device-alerts" className="font-medium">
                  New Device Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a new device signs in to your account
                </p>
              </div>
            </div>
            <Switch
              id="new-device-alerts"
              checked={preferences.new_device_alerts_enabled}
              onCheckedChange={() => handleToggle("new_device_alerts_enabled")}
            />
          </div>

          {/* Security Alerts */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <Shield className="h-4 w-4 text-destructive" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="security-alerts" className="font-medium">
                  Security Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Important security notifications like password changes and suspicious activity
                </p>
              </div>
            </div>
            <Switch
              id="security-alerts"
              checked={preferences.security_alerts_enabled}
              onCheckedChange={() => handleToggle("security_alerts_enabled")}
            />
          </div>
        </div>

        {hasChanges && (
          <div className="flex justify-end pt-2">
            <Button onClick={savePreferences} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
