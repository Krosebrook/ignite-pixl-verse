import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, Sparkles } from "lucide-react";

export default function OrgSetup() {
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName.trim()) {
      toast({
        title: "Organization name required",
        description: "Please enter a name for your organization.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create an organization.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Generate slug from name
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("orgs")
        .insert({
          name: orgName,
          slug,
          owner_id: user.id,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // The trigger handle_new_org will automatically create the owner role
      // Wait a moment for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: "Organization created!",
        description: `Welcome to ${orgName}. Let's start creating.`,
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast({
        title: "Error creating organization",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold font-display bg-gradient-hero bg-clip-text text-transparent">
            Create Your Organization
          </h1>
          <p className="text-muted-foreground text-lg">
            Let's get you set up with your creative workspace
          </p>
        </div>

        <Card className="border-primary/20 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              What's an Organization?
            </CardTitle>
            <CardDescription>
              Organizations help you manage projects, team members, and content all in one place. 
              You can create multiple organizations or join existing ones later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createOrganization} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Acme Studios"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This can be your company name, project name, or anything that helps you organize your work.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !orgName.trim()}
              >
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          You can manage organization settings and invite team members later.
        </p>
      </div>
    </div>
  );
}
