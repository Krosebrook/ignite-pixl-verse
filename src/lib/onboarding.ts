import { supabase } from "@/integrations/supabase/client";

export interface OnboardingStatus {
  onboardingComplete: boolean;
  onboardingStep: number;
  hasOrg: boolean;
  hasBrandKit: boolean;
  orgId?: string;
}

export async function checkOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  // Get profile onboarding step
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_step')
    .eq('id', userId)
    .maybeSingle();

  // Get org membership
  const { data: member } = await supabase
    .from('members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle();

  const orgId = member?.org_id ?? undefined;
  const hasOrg = !!orgId;

  // Check for brand kit
  let hasBrandKit = false;
  if (orgId) {
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('id')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle();
    hasBrandKit = !!brandKit;
  }

  const onboardingStep = profile?.onboarding_step ?? 0;
  const onboardingComplete = onboardingStep >= 3 && hasOrg && hasBrandKit;

  return {
    onboardingComplete,
    onboardingStep,
    hasOrg,
    hasBrandKit,
    orgId,
  };
}
