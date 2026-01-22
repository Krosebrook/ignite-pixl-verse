/**
 * Auth Session Hook
 * Handles session checking, redirects, and OAuth loading states
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { checkOnboardingStatus } from '@/lib/onboarding';
import { toast } from 'sonner';

interface UseAuthSessionReturn {
  isCheckingAuth: boolean;
  oauthLoading: boolean;
  setOauthLoading: (loading: boolean) => void;
  hasCheckedAuth: boolean;
}

interface UseAuthSessionOptions {
  onInvitationFound?: {
    isValid: boolean;
    orgName?: string;
    acceptInvitation: () => Promise<{ success: boolean; error?: string }>;
  };
}

export function useAuthSession(options?: UseAuthSessionOptions): UseAuthSessionReturn {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const hasCheckedAuth = useRef(false);
  const navigate = useNavigate();

  // Check if user is already logged in - runs ONCE on mount
  useEffect(() => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsCheckingAuth(false);
          return;
        }

        // If there's a valid invitation, accept it (fire-and-forget)
        if (options?.onInvitationFound?.isValid) {
          options.onInvitationFound.acceptInvitation().then((result) => {
            if (result.success) {
              toast.success(`Joined ${options.onInvitationFound?.orgName || "the organization"} successfully!`);
            } else if (result.error) {
              toast.error(result.error);
            }
          });
        }

        const status = await checkOnboardingStatus(session.user.id);
        if (status.onboardingComplete) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/onboarding", { replace: true });
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [navigate, options?.onInvitationFound]);

  return {
    isCheckingAuth,
    oauthLoading,
    setOauthLoading,
    hasCheckedAuth: hasCheckedAuth.current,
  };
}

/**
 * Complete sign in flow helper
 * Checks onboarding status and navigates appropriately
 */
export async function completeSignInFlow(
  userId: string,
  navigate: (path: string, options?: { replace?: boolean }) => void
): Promise<void> {
  try {
    const status = await checkOnboardingStatus(userId);
    if (status.onboardingComplete) {
      toast.success("Welcome back!");
      navigate("/dashboard");
    } else {
      toast.success("Welcome! Let's complete your setup.");
      navigate("/onboarding");
    }
  } catch (error) {
    console.error("Error completing sign in:", error);
    toast.error("An error occurred. Please try again.");
  }
}
