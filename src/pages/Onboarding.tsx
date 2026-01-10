import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkOnboardingStatus } from "@/lib/onboarding";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap, SkipForward } from "lucide-react";
import { EmailVerificationReminder } from "@/components/auth/EmailVerificationReminder";

type Step = 1 | 2 | 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewOrg = searchParams.get('new') === 'true';
  
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  // Step 1: Organization
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en-US");

  // Step 2: Brand Kit
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#0f172a");
  const [brandVoice, setBrandVoice] = useState("Professional");

  useEffect(() => {
    checkInitialStatus();
  }, []);

  // Auto-generate slug from org name
  useEffect(() => {
    if (orgName && !orgSlug) {
      setOrgSlug(orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  }, [orgName, orgSlug]);

  const checkInitialStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      setUserEmail(user.email || "");

      // If creating new org, always start at step 1
      if (isNewOrg) {
        setCurrentStep(1);
        setLoading(false);
        return;
      }

      const status = await checkOnboardingStatus(user.id);
      
      if (status.onboardingComplete) {
        navigate('/dashboard');
        return;
      }

      // Determine step based on actual data state (more resilient than relying on step counter)
      if (status.hasOrg && status.hasBrandKit) {
        // Both exist but onboarding not marked complete - go to step 3
        setCurrentStep(3);
      } else if (status.hasOrg && !status.hasBrandKit) {
        // Has org but no brand kit - go to step 2
        setCurrentStep(2);
      } else {
        // No org - start from step 1
        setCurrentStep(1);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      toast.error('Failed to load onboarding state');
      setLoading(false);
    }
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    const slug = orgSlug || orgName.toLowerCase().replace(/\s+/g, "-");
    
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Create organization with owner atomically via RPC
      const { data: orgId, error: orgError } = await supabase.rpc('create_org_with_owner', {
        p_name: orgName.trim(),
        p_slug: slug,
        p_timezone: timezone,
        p_locale: locale,
      });

      if (orgError) throw orgError;

      // Update onboarding step
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_step: 1 })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Organization created!');
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brandName.trim()) {
      toast.error('Brand name is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Get org_id
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('org_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError || !member?.org_id) {
        throw new Error('Organization not found');
      }

      // Create brand kit
      const { error: brandError } = await supabase
        .from('brand_kits')
        .insert({
          org_id: member.org_id,
          name: brandName.trim(),
          colors: {
            primary: primaryColor,
            secondary: secondaryColor,
          },
          brand_voice: brandVoice,
        });

      if (brandError) throw brandError;

      // Update onboarding step
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_step: 2 })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Brand kit created!');
      setCurrentStep(3);
    } catch (error: any) {
      console.error('Error creating brand kit:', error);
      toast.error(error.message || 'Failed to create brand kit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipBrandKit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Update onboarding step to complete (skipping brand kit)
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_step: 3 })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Welcome to FlashFusion! You can set up your brand kit later.');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error skipping brand kit:', error);
      toast.error(error.message || 'Failed to complete onboarding');
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Update onboarding step to complete
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_step: 3 })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Welcome to FlashFusion!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      toast.error(error.message || 'Failed to complete onboarding');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">FlashFusion Setup</h1>
          </div>
          <p className="text-muted-foreground">Let's get your workspace ready</p>
        </div>

        {/* Email verification reminder */}
        <div className="mb-6">
          <EmailVerificationReminder email={userEmail} />
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium hidden sm:inline">Organization</span>
          </div>
          <div className={`h-0.5 w-8 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Brand Kit</span>
          </div>
          <div className={`h-0.5 w-8 ${currentStep >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep >= 3 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              3
            </div>
            <span className="text-sm font-medium hidden sm:inline">Welcome</span>
          </div>
        </div>

        <Card className="p-6">
          {currentStep === 1 && (
            <form onSubmit={handleOrgSubmit} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Create your organization</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up your workspace to start creating content
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgName">Organization name *</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="My Awesome Company"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgSlug">URL slug</Label>
                <Input
                  id="orgSlug"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="my-awesome-company"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">This will be part of your organization's URL</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="UTC"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locale">Locale</Label>
                  <Input
                    id="locale"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    placeholder="en-US"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={submitting || !orgName.trim()}>
                  {submitting ? 'Creating...' : 'Continue to Brand Kit →'}
                </Button>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <form onSubmit={handleBrandSubmit} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Set up your brand kit</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Define your brand identity for consistent content creation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandName">Brand name *</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="My Brand"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="primaryColor"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                      disabled={submitting}
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="secondaryColor"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                      disabled={submitting}
                    />
                    <Input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandVoice">Brand voice</Label>
                <Select value={brandVoice} onValueChange={setBrandVoice} disabled={submitting}>
                  <SelectTrigger id="brandVoice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Playful">Playful</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Bold">Bold</SelectItem>
                    <SelectItem value="Minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between pt-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    disabled={submitting}
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSkipBrandKit}
                    disabled={submitting}
                    className="text-muted-foreground"
                  >
                    <SkipForward className="mr-2 h-4 w-4" />
                    Skip for now
                  </Button>
                </div>
                <Button type="submit" disabled={submitting || !brandName.trim()}>
                  {submitting ? 'Creating...' : 'Continue →'}
                </Button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-semibold mb-2">You're all set! 🎉</h2>
                <p className="text-muted-foreground">
                  Your organization and brand kit are ready. Start creating amazing content!
                </p>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-left">
                <p className="text-sm font-medium">Quick actions to get started:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Connect your social media accounts</li>
                  <li>• Generate your first asset in Content Studio</li>
                  <li>• Create a campaign to organize your content</li>
                </ul>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  disabled={submitting}
                >
                  ← Review brand details
                </Button>
                <Button onClick={handleFinish} disabled={submitting}>
                  {submitting ? 'Loading...' : 'Go to Dashboard →'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
