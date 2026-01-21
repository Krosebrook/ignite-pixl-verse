import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreVertical, Shield, User, Eye, UserMinus, Crown } from "lucide-react";
import { RoleChangeConfirmDialog } from "./RoleChangeConfirmDialog";
import { BulkRoleManager } from "./BulkRoleManager";

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface TeamMemberListProps {
  members: Member[];
  orgId: string;
  currentUserId: string;
  isAdmin: boolean;
  ownerId?: string;
}

interface RoleChangeRequest {
  member: Member;
  newRole: string;
}

export function TeamMemberList({ members, orgId, currentUserId, isAdmin, ownerId }: TeamMemberListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [roleChangeRequest, setRoleChangeRequest] = useState<RoleChangeRequest | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  // Filter members that can be modified (not owner, not self)
  const modifiableMembers = members.filter(
    (m) => m.user_id !== ownerId && m.user_id !== currentUserId
  );

  const selectedMembers = members.filter((m) => selectedMemberIds.has(m.id));

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMemberIds.size === modifiableMembers.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(modifiableMembers.map((m) => m.id)));
    }
  };

  const clearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  const updateRole = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: string }) => {
      const { error } = await supabase
        .from("members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
      toast({ title: "Role updated", description: "Member role has been updated" });
      setRoleChangeRequest(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setRoleChangeRequest(null);
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", orgId] });
      toast({ title: "Member removed", description: "The member has been removed from the organization" });
      setMemberToRemove(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to remove member",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

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
    viewer: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const allModifiableSelected = modifiableMembers.length > 0 && selectedMemberIds.size === modifiableMembers.length;
  const someSelected = selectedMemberIds.size > 0 && selectedMemberIds.size < modifiableMembers.length;

  return (
    <>
      {/* Select All Header (only for admins with modifiable members) */}
      {isAdmin && modifiableMembers.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Checkbox
            id="select-all"
            checked={allModifiableSelected}
            onCheckedChange={toggleSelectAll}
            className="data-[state=indeterminate]:bg-primary"
            {...(someSelected ? { "data-state": "indeterminate" } : {})}
          />
          <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
            {allModifiableSelected
              ? `All ${modifiableMembers.length} modifiable members selected`
              : someSelected
                ? `${selectedMemberIds.size} of ${modifiableMembers.length} selected`
                : `Select all ${modifiableMembers.length} modifiable members`}
          </label>
        </div>
      )}

      <div className="space-y-3">
        {members.map((member) => {
          const RoleIcon = roleIcons[member.role] || User;
          const isOwner = member.user_id === ownerId;
          const isSelf = member.user_id === currentUserId;
          const canModify = isAdmin && !isOwner && !isSelf;
          const isSelected = selectedMemberIds.has(member.id);

          return (
            <div
              key={member.id}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                isSelected
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/50 bg-card/30 hover:bg-card/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Selection checkbox (only for modifiable members) */}
                {canModify && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleMemberSelection(member.id)}
                    className="mr-1"
                  />
                )}
                
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(member.profiles?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {member.profiles?.display_name || "Unnamed User"}
                    {isSelf && <span className="text-muted-foreground ml-2">(you)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${roleColors[member.role] || ""}`}
                    >
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {member.role}
                    </Badge>
                  </div>
                </div>
              </div>

              {canModify && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setRoleChangeRequest({ member, newRole: "admin" })}
                      disabled={member.role === "admin"}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRoleChangeRequest({ member, newRole: "member" })}
                      disabled={member.role === "member"}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRoleChangeRequest({ member, newRole: "viewer" })}
                      disabled={member.role === "viewer"}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Make Viewer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setMemberToRemove(member)}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="h-4 w-4 mr-2" />
                      Remove from Team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk Role Manager */}
      <BulkRoleManager
        selectedMembers={selectedMembers}
        orgId={orgId}
        onClearSelection={clearSelection}
      />

      <RoleChangeConfirmDialog
        open={!!roleChangeRequest}
        onOpenChange={(open) => !open && setRoleChangeRequest(null)}
        memberName={roleChangeRequest?.member.profiles?.display_name || "this member"}
        currentRole={roleChangeRequest?.member.role || "member"}
        newRole={roleChangeRequest?.newRole || "member"}
        onConfirm={() => {
          if (roleChangeRequest) {
            updateRole.mutate({
              memberId: roleChangeRequest.member.id,
              newRole: roleChangeRequest.newRole,
            });
          }
        }}
        isLoading={updateRole.isPending}
      />

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{memberToRemove?.profiles?.display_name || "this member"}</strong> from the
              organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && removeMember.mutate(memberToRemove.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
