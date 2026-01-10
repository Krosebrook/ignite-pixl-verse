/**
 * Email verification reminder banner for onboarding
 */

import { useState, useEffect } from "react";
import { AlertCircle, Mail, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailVerificationReminderProps {
  email?: string;
}

export function EmailVerificationReminder({ email }: EmailVerificationReminderProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const checkVerificationStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Check if email is confirmed
      const isConfirmed = user.email_confirmed_at !== null;
      setIsVerified(isConfirmed);
    }
  };

  const handleResendVerification = async () => {
    if (cooldown > 0 || isResending) return;
    
    setIsResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = email || user?.email;
      
      if (!userEmail) {
        toast.error("No email address found");
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (error) {
        // Handle rate limit errors
        if (error.message?.toLowerCase().includes('rate') || error.status === 429) {
          toast.error("Too many requests. Please wait before trying again.");
          setCooldown(60);
        } else {
          toast.error(error.message || "Failed to resend verification email");
        }
        return;
      }

      toast.success("Verification email sent! Check your inbox.");
      setCooldown(60); // 60 second cooldown
    } catch (error) {
      console.error("Error resending verification:", error);
      toast.error("Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  // Don't show if verified or still checking
  if (isVerified === null || isVerified) {
    return null;
  }

  return (
    <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
      <AlertCircle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-600 dark:text-amber-400">
        Email not verified
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">
          Please verify your email address to unlock all features. Check your inbox for a verification link.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResendVerification}
          disabled={isResending || cooldown > 0}
        >
          {isResending ? (
            <>
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
              Sending...
            </>
          ) : cooldown > 0 ? (
            <>
              <Mail className="mr-2 h-3 w-3" />
              Resend in {cooldown}s
            </>
          ) : (
            <>
              <Mail className="mr-2 h-3 w-3" />
              Resend verification email
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
