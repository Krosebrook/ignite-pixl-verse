import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function TeamMemberList({ members, orgId, currentUserId, isAdmin, ownerId }: TeamMemberListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

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
    },
    onError: (error) => {
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
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

  return (
    <>
      <div className="space-y-3">
        {members.map((member) => {
          const RoleIcon = roleIcons[member.role] || User;
          const isOwner = member.user_id === ownerId;
          const isSelf = member.user_id === currentUserId;
          const canModify = isAdmin && !isOwner && !isSelf;

          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
            >
              <div className="flex items-center gap-3">
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
                      onClick={() => updateRole.mutate({ memberId: member.id, newRole: "admin" })}
                      disabled={member.role === "admin"}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateRole.mutate({ memberId: member.id, newRole: "member" })}
                      disabled={member.role === "member"}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateRole.mutate({ memberId: member.id, newRole: "viewer" })}
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
