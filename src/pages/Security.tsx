import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { PasskeyAuth } from "@/components/auth/PasskeyAuth";
import { SessionManagement } from "@/components/auth/SessionManagement";
import { AccountRecovery } from "@/components/auth/AccountRecovery";
import { TotpAuth } from "@/components/auth/TotpAuth";
import { LoginHistory } from "@/components/auth/LoginHistory";
import { NotificationPreferences } from "@/components/auth/NotificationPreferences";
import { SecurityActivityLog } from "@/components/auth/SecurityActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Security() {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { isAdmin } = useCurrentOrg();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          title="Security Settings"
          description="Manage your account security, passkeys, and recovery options"
        />

        <div className="grid gap-6 mt-8">
          {/* Admin Security Dashboard Link */}
          {isAdmin && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ShieldAlert className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Admin Security Dashboard</h3>
                      <p className="text-sm text-muted-foreground">
                        View security activity across all organization users
                      </p>
                    </div>
                  </div>
                  <Button asChild>
                    <Link to="/admin/security">
                      Open Dashboard
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Activity Log */}
          <SecurityActivityLog />

          {/* Two-Factor Authentication */}
          <TotpAuth />

          {/* Passkey Authentication */}
          <PasskeyAuth />

          {/* Email Notification Preferences */}
          <NotificationPreferences />

          {/* Session Management */}
          <SessionManagement />

          {/* Login History */}
          <LoginHistory />

          {/* Account Recovery */}
          <AccountRecovery />
        </div>
      </div>
    </Layout>
  );
}
