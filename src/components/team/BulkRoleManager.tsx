import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Shield, User, Eye, Users, X, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface BulkRoleManagerProps {
  selectedMembers: Member[];
  orgId: string;
  onClearSelection: () => void;
}

const roleOptions = [
  { value: "admin", label: "Admin", icon: Shield, color: "text-purple-500" },
  { value: "member", label: "Member", icon: User, color: "text-blue-500" },
  { value: "viewer", label: "Viewer", icon: Eye, color: "text-muted-foreground" },
];

const rolePermissionSummary: Record<string, string[]> = {
  admin: ["Full org management", "Invite & manage members", "Access all settings"],
  member: ["Create & edit content", "Schedule posts", "View analytics"],
  viewer: ["View-only access", "Cannot modify anything"],
};

export function BulkRoleManager({ selectedMembers, orgId, onClearSelection }: BulkRoleManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const bulkUpdateRoles = useMutation({
    mutationFn: async ({ memberIds, newRole }: { memberIds: string[]; newRole: string }) => {
      // Update each member's role
      const updates = memberIds.map((memberId) =>
        supabase.from("members").update({ role: newRole }).eq("id", memberId)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} member(s)`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
      toast({
        title: "Roles updated",
        description: `Successfully updated ${selectedMembers.length} member(s) to ${selectedRole}`,
      });
      onClearSelection();
      setSelectedRole("");
      setShowConfirmDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update roles",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setShowConfirmDialog(false);
    },
  });

  const handleApplyRoles = () => {
    if (!selectedRole || selectedMembers.length === 0) return;
    setShowConfirmDialog(true);
  };

  const confirmBulkUpdate = () => {
    bulkUpdateRoles.mutate({
      memberIds: selectedMembers.map((m) => m.id),
      newRole: selectedRole,
    });
  };

  // Group selected members by their current role
  const roleBreakdown = selectedMembers.reduce(
    (acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (selectedMembers.length === 0) return null;

  const SelectedRoleIcon = roleOptions.find((r) => r.value === selectedRole)?.icon || Users;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 bg-card border border-border shadow-lg rounded-lg px-4 py-3">
            {/* Selection count */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-medium">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {selectedMembers.length} selected
              </Badge>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Role selector */}
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Change role to..." />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => {
                  const Icon = role.icon;
                  return (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${role.color}`} />
                        {role.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Apply button */}
            <Button
              size="sm"
              onClick={handleApplyRoles}
              disabled={!selectedRole || bulkUpdateRoles.isPending}
            >
              {bulkUpdateRoles.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Apply
            </Button>

            {/* Clear selection */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={bulkUpdateRoles.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Role Change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to change <strong>{selectedMembers.length} member(s)</strong> to the{" "}
                  <Badge variant="outline" className="mx-1">
                    <SelectedRoleIcon className="h-3 w-3 mr-1" />
                    {selectedRole}
                  </Badge>{" "}
                  role.
                </p>

                {/* Current roles breakdown */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Current roles:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(roleBreakdown).map(([role, count]) => (
                      <Badge key={role} variant="outline" className="text-xs capitalize">
                        {count} {role}(s)
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* New permissions summary */}
                {selectedRole && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      New permissions for all:
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {rolePermissionSummary[selectedRole]?.map((perm, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Check className="h-3 w-3 text-green-500" />
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Member names preview */}
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Affected members:</p>
                  <p className="truncate">
                    {selectedMembers
                      .slice(0, 3)
                      .map((m) => m.profiles?.display_name || "Unnamed")
                      .join(", ")}
                    {selectedMembers.length > 3 && ` and ${selectedMembers.length - 3} more`}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdateRoles.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkUpdate}
              disabled={bulkUpdateRoles.isPending}
            >
              {bulkUpdateRoles.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Confirm Changes
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
