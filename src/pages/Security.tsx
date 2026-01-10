import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { PasskeyAuth } from "@/components/auth/PasskeyAuth";
import { SessionManagement } from "@/components/auth/SessionManagement";
import { AccountRecovery } from "@/components/auth/AccountRecovery";
import { TotpAuth } from "@/components/auth/TotpAuth";
import { LoginHistory } from "@/components/auth/LoginHistory";
import { NotificationPreferences } from "@/components/auth/NotificationPreferences";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Security() {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

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
