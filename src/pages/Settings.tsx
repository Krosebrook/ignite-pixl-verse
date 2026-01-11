import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon, User, Building2, Users, CreditCard, Bell, Shield, ChevronRight, Globe, Clock, Loader2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { PendingInvitations } from "@/components/team/PendingInvitations";
import { TeamMemberList } from "@/components/team/TeamMemberList";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  timezone: string;
  locale: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
];

const LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "ja-JP", label: "Japanese" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
];

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const { orgId, isLoading: orgLoading } = useCurrentOrg();
  const { isAdmin } = useUserRole(orgId);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
  });

  // Fetch org
  const { data: orgData, isLoading: orgDataLoading } = useQuery({
    queryKey: ["organization-details", orgId],
    queryFn: async () => {
      if (!orgId) return null;

      const { data, error } = await supabase
        .from("orgs")
        .select("*")
        .eq("id", orgId)
        .single();

      if (error) throw error;
      return data as Org;
    },
    enabled: !!orgId,
  });

  // Fetch members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["organization-members", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data: membersData, error } = await supabase
        .from("members")
        .select("id, user_id, role")
        .eq("org_id", orgId)
        .order("created_at");

      if (error) throw error;

      // Fetch profiles for members
      const membersList: Member[] = [];
      for (const member of membersData || []) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", member.user_id)
          .single();

        membersList.push({
          ...member,
          profiles: profileData,
        });
      }
      return membersList;
    },
    enabled: !!orgId,
  });

  // Get current user ID
  const [currentUserId, setCurrentUserId] = useState<string>("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Sync state with query data
  useEffect(() => {
    if (profileData) setProfile(profileData);
  }, [profileData]);

  useEffect(() => {
    if (orgData) setOrg(orgData);
  }, [orgData]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<Profile>) => {
      if (!profile?.id) throw new Error("No profile");

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Success", description: "Profile updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Update org mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: Partial<Org>) => {
      if (!org?.id) throw new Error("No organization");

      const { error } = await supabase
        .from("orgs")
        .update(data)
        .eq("id", org.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-details", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      toast({ title: "Success", description: "Organization updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update organization",
        variant: "destructive",
      });
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const loading = profileLoading || orgLoading || orgDataLoading;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Settings"
        description="Manage your account and organization settings"
        icon={SettingsIcon}
      />

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          {isAdmin && org && (
            <>
              <TabsTrigger value="organization">
                <Building2 className="h-4 w-4 mr-2" />
                Organization
              </TabsTrigger>
              <TabsTrigger value="team">
                <Users className="h-4 w-4 mr-2" />
                Team
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={profile?.display_name || ""}
                  onChange={(e) => setProfile({ ...profile!, display_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={profile?.bio || ""}
                  onChange={(e) => setProfile({ ...profile!, bio: e.target.value })}
                  placeholder="Tell us about yourself"
                />
              </div>
              <Button
                onClick={() =>
                  updateProfileMutation.mutate({
                    display_name: profile?.display_name,
                    bio: profile?.bio,
                  })
                }
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage passkeys, sessions, and account recovery</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/security">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Open Security Settings
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>Manage your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleSignOut}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        {isAdmin && org && (
          <TabsContent value="organization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Manage your organization settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={org?.name || ""}
                      onChange={(e) => setOrg({ ...org!, name: e.target.value })}
                      placeholder="Organization name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgSlug">Organization Slug</Label>
                    <Input
                      id="orgSlug"
                      value={org?.slug || ""}
                      onChange={(e) => setOrg({ ...org!, slug: e.target.value })}
                      placeholder="organization-slug"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="timezone" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Timezone
                    </Label>
                    <Select
                      value={org?.timezone || "UTC"}
                      onValueChange={(value) => setOrg({ ...org!, timezone: value })}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="locale" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Language & Region
                    </Label>
                    <Select
                      value={org?.locale || "en-US"}
                      onValueChange={(value) => setOrg({ ...org!, locale: value })}
                    >
                      <SelectTrigger id="locale">
                        <SelectValue placeholder="Select locale" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((locale) => (
                          <SelectItem key={locale.value} value={locale.value}>
                            {locale.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={() =>
                    updateOrgMutation.mutate({
                      name: org?.name,
                      slug: org?.slug,
                      timezone: org?.timezone,
                      locale: org?.locale,
                    })
                  }
                  disabled={updateOrgMutation.isPending}
                >
                  {updateOrgMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Team Tab */}
        {isAdmin && org && (
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage your team members and roles</CardDescription>
                </div>
                {orgId && org && (
                  <InviteMemberDialog
                    orgId={orgId}
                    orgName={org.name}
                    onInviteSent={() =>
                      queryClient.invalidateQueries({ queryKey: ["invitations", orgId] })
                    }
                  />
                )}
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <TeamMemberList
                    members={members}
                    orgId={orgId || ""}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    ownerId={org?.owner_id}
                  />
                )}
              </CardContent>
            </Card>

            {orgId && <PendingInvitations orgId={orgId} />}
          </TabsContent>
        )}

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Usage</CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Current Plan</span>
                  <span className="text-sm font-semibold text-primary">Starter</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You're on the free Starter plan. Upgrade to unlock more features.
                </p>
              </div>
              <div className="flex gap-3">
                <Link to="/pricing">
                  <Button>View Plans</Button>
                </Link>
                <Link to="/usage">
                  <Button variant="outline">View Usage</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Notification settings coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
