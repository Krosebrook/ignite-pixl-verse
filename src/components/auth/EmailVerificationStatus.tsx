import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmailVerificationStatusProps {
  email: string;
  isVerified?: boolean;
  showResend?: boolean;
  className?: string;
  onResendSuccess?: () => void;
}

export function EmailVerificationStatus({
  email,
  isVerified = false,
  showResend = true,
  className,
  onResendSuccess,
}: EmailVerificationStatusProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        if (error.message?.toLowerCase().includes('rate') || error.status === 429) {
          toast.error("Too many requests. Please wait before trying again.");
          setResendCooldown(60);
        } else {
          toast.error("Failed to resend verification email. Please try again.");
        }
        return;
      }

      toast.success("Verification email sent! Check your inbox.");
      setResendCooldown(60);
      onResendSuccess?.();

      // Start cooldown timer
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Resend verification error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  if (isVerified) {
    return (
      <Alert className={cn("bg-green-500/10 border-green-500/30", className)}>
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertDescription className="text-sm">
          <span className="font-medium text-green-600">Email verified</span>
          <span className="text-muted-foreground ml-1">— Your account is fully activated.</span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className={cn("bg-amber-500/10 border-amber-500/30", className)}>
      <AlertCircle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-sm">
        <div className="flex flex-col gap-2">
          <div>
            <span className="font-medium text-amber-600">Email not verified</span>
            <span className="text-muted-foreground ml-1">— Please check your inbox for a verification link.</span>
          </div>
          
          {showResend && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResendVerification}
              disabled={isResending || resendCooldown > 0}
              className="w-fit h-7 px-2 text-xs hover:bg-amber-500/10"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Resend in {resendCooldown}s
                </>
              ) : (
                <>
                  <Mail className="h-3 w-3 mr-1.5" />
                  Resend verification email
                </>
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface PendingVerificationProps {
  email: string;
  onBackToSignIn: () => void;
  className?: string;
}

export function PendingVerification({ email, onBackToSignIn, className }: PendingVerificationProps) {
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        if (error.message?.toLowerCase().includes('rate') || error.status === 429) {
          toast.error("Too many requests. Please wait before trying again.");
        } else {
          toast.error("Failed to resend. Please try again.");
        }
        return;
      }

      toast.success("Verification email sent!");
      setResendCooldown(60);

      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className={cn("text-center space-y-6", className)}>
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-amber-500" />
          </div>
          <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">Verify Your Email</h1>
        <p className="text-muted-foreground">
          We've sent a verification link to
        </p>
        <p className="font-semibold text-foreground mt-1">{email}</p>
      </div>

      <Alert className="bg-muted/50 border-border text-left">
        <Mail className="h-4 w-4" />
        <AlertDescription className="text-sm space-y-2">
          <p>Click the link in your email to verify your account and get started.</p>
          <p className="text-xs text-muted-foreground">
            Don't see it? Check your spam folder or request a new link below.
          </p>
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <Button
          onClick={handleResend}
          variant="outline"
          className="w-full"
          disabled={isResending || resendCooldown > 0}
        >
          {isResending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : resendCooldown > 0 ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Resend in {resendCooldown}s
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Resend Verification Email
            </>
          )}
        </Button>

        <button
          onClick={onBackToSignIn}
          className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
