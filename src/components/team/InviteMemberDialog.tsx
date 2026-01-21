import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Mail, Loader2 } from "lucide-react";

interface InviteMemberDialogProps {
  orgId: string;
  orgName: string;
  onInviteSent?: () => void;
}

export function InviteMemberDialog({ orgId, orgName, onInviteSent }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: { email: email.toLowerCase().trim(), role, orgId, orgName },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Invitation sent!",
        description: `An invitation has been sent to ${email}`,
      });

      setEmail("");
      setRole("member");
      setOpen(false);
      onInviteSent?.();
    } catch (error) {
      console.error("Failed to send invitation:", error);
      toast({
        title: "Failed to send invitation",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an email invitation to add someone to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole} disabled={isLoading}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="w-[320px]">
                  <SelectItem value="admin">
                    <div className="flex flex-col gap-1 py-1">
                      <span className="font-medium">Admin</span>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• Manage organization settings & billing</li>
                        <li>• Invite, remove & change member roles</li>
                        <li>• Full access to all content & campaigns</li>
                        <li>• Access audit logs & security settings</li>
                      </ul>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex flex-col gap-1 py-1">
                      <span className="font-medium">Member</span>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• Create, edit & delete own content</li>
                        <li>• Schedule posts & manage campaigns</li>
                        <li>• Access brand kits & templates</li>
                        <li>• Cannot manage members or settings</li>
                      </ul>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex flex-col gap-1 py-1">
                      <span className="font-medium">Viewer</span>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• View content, campaigns & analytics</li>
                        <li>• Browse brand kits & templates</li>
                        <li>• Cannot create, edit or delete anything</li>
                        <li>• Read-only access for stakeholders</li>
                      </ul>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
