/**
 * Auth Actions Hook
 * Handles authentication actions (sign in, sign up, magic link, etc.)
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkOnboardingStatus } from '@/lib/onboarding';
import { checkTotpEnabled } from '@/components/auth/TotpVerification';
import { isValidEmail, isValidPassword } from './useAuthValidation';

export type AuthMode = 
  | 'signin' 
  | 'signup' 
  | 'forgot-password' 
  | 'reset-sent' 
  | 'magic-link-sent' 
  | 'pending-verification' 
  | 'totp-verification';

interface UseAuthActionsOptions {
  onModeChange: (mode: AuthMode) => void;
  onLoginAttempt: (email?: string) => boolean;
  onMagicLinkRequest: () => void;
  checkRateLimit: () => boolean;
  setResetEmail: (email: string) => void;
  setPendingTotp: (userId: string, email: string) => void;
}

interface UseAuthActionsReturn {
  loading: boolean;
  handleSignIn: (e: React.FormEvent, email: string, password: string) => Promise<void>;
  handleSignUp: (e: React.FormEvent, email: string, password: string, confirmPassword: string) => Promise<void>;
  handleMagicLinkSignIn: (e: React.FormEvent, email: string) => Promise<void>;
  handleForgotPassword: (e: React.FormEvent, email: string) => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  completeSignIn: (userId: string) => Promise<void>;
}

export function useAuthActions(options: UseAuthActionsOptions): UseAuthActionsReturn {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const completeSignIn = useCallback(async (userId: string) => {
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
  }, [navigate]);

  const handleSignIn = useCallback(async (
    e: React.FormEvent, 
    email: string, 
    password: string
  ) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      toast.error(passwordValidation.error);
      return;
    }

    setLoading(true);

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error);
        const isNowLocked = options.onLoginAttempt(email);
        
        if (error.message?.includes('Invalid login credentials') || error.code === 'invalid_credentials') {
          if (isNowLocked) {
            toast.error(
              "Account temporarily locked due to too many failed attempts. A notification has been sent to your email.",
              { duration: 8000 }
            );
          } else {
            toast.error(
              "No account found with these credentials.",
              {
                duration: 6000,
                action: {
                  label: "Sign Up",
                  onClick: () => options.onModeChange("signup"),
                },
              }
            );
          }
        } else {
          toast.error("Authentication failed. Please try again.");
        }
        return;
      }
      
      // Check if user has TOTP enabled
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const hasTotpEnabled = await checkTotpEnabled(user.id);
        
        if (hasTotpEnabled) {
          // User has 2FA enabled - sign them out and require TOTP
          await supabase.auth.signOut();
          options.setPendingTotp(user.id, email);
          options.onModeChange("totp-verification");
          return;
        }
        
        // No 2FA, proceed with login
        await completeSignIn(user.id);
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [completeSignIn, options]);

  const handleSignUp = useCallback(async (
    e: React.FormEvent,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      toast.error(passwordValidation.error);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      
      if (error) {
        console.error('Sign up error:', error);
        toast.error("Unable to create account. Please try a different email or contact support.");
        return;
      }
      
      // Check if email confirmation is required
      if (data.user && !data.session) {
        options.setResetEmail(email);
        options.onModeChange("pending-verification");
        toast.success("Account created! Please check your email to verify.");
        return;
      }
      
      // After signup, check onboarding status and redirect (auto-confirm enabled)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const status = await checkOnboardingStatus(user.id);
        if (status.onboardingComplete) {
          toast.success("Welcome back!");
          navigate("/dashboard");
        } else {
          toast.success("Account created! Let's set up your organization.");
          navigate("/onboarding");
        }
      } else {
        options.setResetEmail(email);
        options.onModeChange("pending-verification");
        toast.success("Account created! Please check your email to confirm.");
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate, options]);

  const handleMagicLinkSignIn = useCallback(async (e: React.FormEvent, email: string) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!options.checkRateLimit()) {
      toast.error("Too many requests. Please wait before trying again.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      
      if (error) {
        console.error('Magic link error:', error);
        if (error.message?.toLowerCase().includes('rate') || error.status === 429) {
          toast.error("Too many requests. Please wait before trying again.");
        } else {
          toast.error("Failed to send magic link. Please try again.");
        }
        return;
      }
      
      options.onMagicLinkRequest();
      options.setResetEmail(email);
      options.onModeChange("magic-link-sent");
      toast.success("Magic link sent! Check your email.");
    } catch (error: any) {
      console.error("Magic link error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [options]);

  const handleForgotPassword = useCallback(async (e: React.FormEvent, email: string) => {
    e.preventDefault();
    
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) {
        toast.error(error.message);
        return;
      }
      
      options.setResetEmail(email);
      options.onModeChange("reset-sent");
      toast.success("Password reset link sent! Check your email.");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [options]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      
      if (error) {
        console.error('Google sign in error:', error);
        toast.error("Failed to sign in with Google. Please try again.");
      }
    } catch (error: any) {
      console.error("Google sign in error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  }, []);

  return {
    loading,
    handleSignIn,
    handleSignUp,
    handleMagicLinkSignIn,
    handleForgotPassword,
    handleGoogleSignIn,
    completeSignIn,
  };
}
