import { supabase } from "@/integrations/supabase/client";

export interface OnboardingStatus {
  onboardingComplete: boolean;
  onboardingStep: number;
  hasOrg: boolean;
  hasBrandKit: boolean;
  orgId?: string;
}

/**
 * Check and potentially create user profile, then evaluate onboarding status.
 * Handles edge case where profile trigger fails or user was created before trigger existed.
 */
export async function checkOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  // Get profile onboarding step (or create if missing)
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarding_step')
    .eq('id', userId)
    .maybeSingle();

  // If no profile exists, create one (handles trigger failure edge case)
  if (!profile && !profileError) {
    const { data: user } = await supabase.auth.getUser();
    const displayName = user?.user?.email?.split('@')[0] || 'User';
    
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, display_name: displayName, onboarding_step: 0 })
      .select('onboarding_step')
      .single();
    
    if (!insertError) {
      profile = newProfile;
    }
  }

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
  
  // Onboarding is complete if:
  // 1. onboarding_step >= 3 (user completed or skipped steps)
  // 2. OR user has org AND brand kit (even if step wasn't properly incremented)
  const onboardingComplete = onboardingStep >= 3 || (hasOrg && hasBrandKit);

  // Auto-repair: If user has org+brand but step is behind, update it
  if (hasOrg && hasBrandKit && onboardingStep < 3) {
    await supabase
      .from('profiles')
      .update({ onboarding_step: 3 })
      .eq('id', userId);
  }

  return {
    onboardingComplete,
    onboardingStep: onboardingComplete ? 3 : onboardingStep,
    hasOrg,
    hasBrandKit,
    orgId,
  };
}

/**
 * Ensure a profile exists for the user (call after sign-in/sign-up)
 */
export async function ensureProfileExists(userId: string, email?: string): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    const displayName = email?.split('@')[0] || 'User';
    await supabase
      .from('profiles')
      .insert({ id: userId, display_name: displayName, onboarding_step: 0 });
  }
}
