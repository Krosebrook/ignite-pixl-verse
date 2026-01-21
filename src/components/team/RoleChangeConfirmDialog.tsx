import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, User, Eye, Crown, Check, X, ArrowRight } from "lucide-react";

interface RoleChangeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  currentRole: string;
  newRole: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

const rolePermissions: Record<string, { label: string; permissions: string[] }> = {
  owner: {
    label: "Owner",
    permissions: [
      "Full organization ownership",
      "Transfer ownership to others",
      "Delete the organization",
      "All admin permissions",
    ],
  },
  admin: {
    label: "Admin",
    permissions: [
      "Manage organization settings & billing",
      "Invite, remove & change member roles",
      "Full access to all content & campaigns",
      "Access audit logs & security settings",
    ],
  },
  member: {
    label: "Member",
    permissions: [
      "Create, edit & delete own content",
      "Schedule posts & manage campaigns",
      "Access brand kits & templates",
      "View analytics & reports",
    ],
  },
  viewer: {
    label: "Viewer",
    permissions: [
      "View content, campaigns & analytics",
      "Browse brand kits & templates",
      "Read-only access to all resources",
      "Cannot create or modify anything",
    ],
  },
};

const roleIcons: Record<string, typeof Shield> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

const roleColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  member: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  viewer: "bg-muted/50 text-muted-foreground border-border",
};

export function RoleChangeConfirmDialog({
  open,
  onOpenChange,
  memberName,
  currentRole,
  newRole,
  onConfirm,
  isLoading,
}: RoleChangeConfirmDialogProps) {
  const CurrentIcon = roleIcons[currentRole] || User;
  const NewIcon = roleIcons[newRole] || User;
  
  const currentPerms = rolePermissions[currentRole]?.permissions || [];
  const newPerms = rolePermissions[newRole]?.permissions || [];
  
  // Calculate gained and lost permissions
  const gained = newPerms.filter(p => !currentPerms.includes(p));
  const lost = currentPerms.filter(p => !newPerms.includes(p));
  const isUpgrade = ["owner", "admin"].includes(newRole) && ["member", "viewer"].includes(currentRole);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Change Member Role</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You are about to change <strong>{memberName}</strong>'s role:
              </p>
              
              {/* Role transition visual */}
              <div className="flex items-center justify-center gap-3 py-3">
                <Badge variant="outline" className={`text-sm px-3 py-1.5 ${roleColors[currentRole]}`}>
                  <CurrentIcon className="h-3.5 w-3.5 mr-1.5" />
                  {rolePermissions[currentRole]?.label || currentRole}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className={`text-sm px-3 py-1.5 ${roleColors[newRole]}`}>
                  <NewIcon className="h-3.5 w-3.5 mr-1.5" />
                  {rolePermissions[newRole]?.label || newRole}
                </Badge>
              </div>

              {/* Permission changes */}
              <div className="space-y-3 text-sm">
                {gained.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      Will gain access to:
                    </p>
                    <ul className="space-y-1 pl-5.5 text-muted-foreground">
                      {gained.map((perm, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400 mt-0.5">+</span>
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {lost.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-medium text-destructive flex items-center gap-1.5">
                      <X className="h-4 w-4" />
                      Will lose access to:
                    </p>
                    <ul className="space-y-1 pl-5.5 text-muted-foreground">
                      {lost.map((perm, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-destructive mt-0.5">−</span>
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {!isUpgrade && lost.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md p-2">
                  ⚠️ This will restrict what {memberName} can do in the organization.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={isUpgrade ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
          >
            {isLoading ? "Changing..." : "Confirm Change"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
