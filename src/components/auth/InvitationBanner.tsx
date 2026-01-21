import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, AlertCircle, Loader2, X, CheckCircle, Shield, Eye, Edit3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvitationBannerProps {
  email: string | null;
  orgName: string | null;
  role: string | null;
  isValid: boolean;
  error: string | null;
  isAccepting?: boolean;
  onAccept?: () => void;
  onDismiss?: () => void;
  showAcceptButton?: boolean;
  showRoleDetails?: boolean;
}

// Role permission definitions
const rolePermissions: Record<string, { icon: React.ReactNode; description: string; permissions: string[] }> = {
  admin: {
    icon: <Shield className="h-4 w-4" />,
    description: "Full access to manage the organization",
    permissions: [
      "Manage team members & invitations",
      "Create, edit & delete all content",
      "Access billing & organization settings",
      "View analytics & audit logs",
    ],
  },
  member: {
    icon: <Edit3 className="h-4 w-4" />,
    description: "Create and manage content",
    permissions: [
      "Create, edit & schedule content",
      "Access brand kits & templates",
      "View team analytics",
      "Cannot manage team or billing",
    ],
  },
  viewer: {
    icon: <Eye className="h-4 w-4" />,
    description: "View-only access",
    permissions: [
      "View content & campaigns",
      "View analytics & reports",
      "Cannot create or edit content",
      "Cannot access settings",
    ],
  },
};

export function InvitationBanner({
  email,
  orgName,
  role,
  isValid,
  error,
  isAccepting = false,
  onAccept,
  onDismiss,
  showAcceptButton = false,
  showRoleDetails = true,
}: InvitationBannerProps) {
  const roleColors: Record<string, string> = {
    admin: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    member: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    viewer: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const roleDetails = role ? rolePermissions[role] : null;

  if (!isValid && error) {
    return (
      <Card className="p-4 mb-6 border-destructive/50 bg-destructive/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-destructive">Invalid Invitation</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (!isValid) return null;

  return (
    <Card className="p-4 mb-6 border-primary/50 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-medium">You've been invited to join</p>
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{orgName || "an organization"}</span>
              {role && (
                <Badge variant="outline" className={cn("text-xs capitalize", roleColors[role] || "")}>
                  {roleDetails?.icon}
                  <span className="ml-1">{role}</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Role details section */}
          {showRoleDetails && role && roleDetails && (
            <div className="p-3 rounded-lg bg-background/50 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Role Permissions</span>
              </div>
              <p className="text-xs text-muted-foreground">{roleDetails.description}</p>
              <ul className="grid grid-cols-1 gap-1 text-xs">
                {roleDetails.permissions.map((perm, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{perm}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {email && (
            <p className="text-sm text-muted-foreground">
              Invitation sent to: <span className="text-foreground">{email}</span>
            </p>
          )}
          {showAcceptButton && onAccept && (
            <Button
              onClick={onAccept}
              disabled={isAccepting}
              size="sm"
              className="mt-2"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept & Join
                </>
              )}
            </Button>
          )}
          {!showAcceptButton && (
            <p className="text-sm text-muted-foreground">
              Sign in or create an account with <span className="font-medium">{email}</span> to join
            </p>
          )}
        </div>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
