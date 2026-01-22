/**
 * Auth Page - Refactored
 * Handles user authentication with sign in, sign up, magic link, and OAuth
 * Uses extracted hooks for rate limiting, validation, and auth actions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, ArrowLeft, Mail, CheckCircle, AlertCircle, Sparkles, Loader2, Clock, Shield, Fingerprint } from "lucide-react";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SocialProof, SocialProofCompact } from "@/components/auth/SocialProof";
import { PendingVerification } from "@/components/auth/EmailVerificationStatus";
import { PasskeySignInButton } from "@/components/auth/PasskeyAuth";
import { CaptchaChallenge } from "@/components/auth/CaptchaChallenge";
import { TotpVerification, checkTotpEnabled } from "@/components/auth/TotpVerification";
import { InvitationBanner } from "@/components/auth/InvitationBanner";
import { useInvitationToken } from "@/hooks/useInvitationToken";
import { useAuthRateLimit, AUTH_RATE_LIMIT_CONSTANTS } from "@/hooks/useAuthRateLimit";
import { useAuthActions, type AuthMode } from "@/hooks/useAuthActions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkOnboardingStatus } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const { LOCKOUT_DURATIONS, MAX_LOGIN_ATTEMPTS } = AUTH_RATE_LIMIT_CONSTANTS;

export default function Auth() {
  // Form state
  const [mode, setMode] = useState<AuthMode>("signin");
  const [authMethod, setAuthMethod] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  
  // OAuth and auth checking state
  const [oauthLoading, setOauthLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const hasCheckedAuth = useRef(false);
  
  // TOTP verification state
  const [pendingTotpUserId, setPendingTotpUserId] = useState<string | null>(null);
  const [pendingTotpEmail, setPendingTotpEmail] = useState<string>("");
  
  // CAPTCHA visibility state
  const [showCaptcha, setShowCaptcha] = useState(false);
  
  const navigate = useNavigate();

  // Invitation token handling
  const { inviteToken, invitationInfo, isLoading: invitationLoading, isAccepting, acceptInvitation, clearInvitation } = useInvitationToken();

  // Lockout notification callback
  const sendLockoutNotification = useCallback(async (userEmail: string, lockoutDuration: number, level: number) => {
    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-lockout-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: userEmail,
            failedAttempts: MAX_LOGIN_ATTEMPTS,
            lockoutMinutes: Math.ceil(lockoutDuration / 60),
            lockoutLevel: level,
            isProgressive: true,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          }),
        }
      );
    } catch (error) {
      console.error('Error sending lockout notification:', error);
    }
  }, []);

  // Rate limiting hook
  const rateLimit = useAuthRateLimit(sendLockoutNotification);

  // Auth actions hook
  const authActions = useAuthActions({
    onModeChange: setMode,
    onLoginAttempt: rateLimit.trackLoginAttempt,
    onMagicLinkRequest: rateLimit.trackMagicLinkRequest,
    checkRateLimit: rateLimit.checkRateLimit,
    setResetEmail,
    setPendingTotp: (userId, email) => {
      setPendingTotpUserId(userId);
      setPendingTotpEmail(email);
    },
  });

  // Pre-fill email from invitation
  useEffect(() => {
    if (invitationInfo?.email && !email) {
      setEmail(invitationInfo.email);
    }
  }, [invitationInfo?.email, email]);

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

        // If there's a valid invitation, accept it
        if (invitationInfo?.isValid && !isAccepting) {
          acceptInvitation().then((result) => {
            if (result.success) {
              toast.success(`Joined ${invitationInfo.orgName || "the organization"} successfully!`);
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
  }, [navigate, invitationInfo, isAccepting, acceptInvitation]);

  // TOTP verification handlers
  const handleTotpSuccess = async () => {
    if (!pendingTotpUserId || !pendingTotpEmail) {
      toast.error("Session expired. Please sign in again.");
      setMode("signin");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: pendingTotpEmail,
        password,
      });

      if (error) {
        toast.error("Session expired. Please sign in again.");
        setMode("signin");
        return;
      }

      setPendingTotpUserId(null);
      setPendingTotpEmail("");

      if (data.user) {
        await authActions.completeSignIn(data.user.id);
      }
    } catch (error) {
      console.error("Error completing TOTP sign in:", error);
      toast.error("An error occurred. Please try again.");
      setMode("signin");
    }
  };

  const handleTotpCancel = () => {
    setPendingTotpUserId(null);
    setPendingTotpEmail("");
    setPassword("");
    setMode("signin");
  };

  // Google Sign In with OAuth loading state
  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    try {
      await authActions.handleGoogleSignIn();
      // Don't set loading to false - we're redirecting
    } catch {
      setOauthLoading(false);
    }
  };

  // Form reset and mode switching
  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowCaptcha(false);
    rateLimit.setCaptchaVerified(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  // OAuth Loading Overlay
  if (oauthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="w-20 h-20 bg-card rounded-2xl flex items-center justify-center shadow-2xl border border-border">
              <Zap className="h-10 w-10 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-lg font-medium">Connecting to Google...</span>
            </div>
            <p className="text-sm text-muted-foreground">You'll be redirected shortly</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOauthLoading(false)} className="mt-4 text-muted-foreground">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Auth checking spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
        <Card className="w-full max-w-sm p-8 bg-card border-border relative z-10 animate-scale-in">
          <div className="flex flex-col items-center gap-4">
            <Zap className="h-10 w-10 text-primary animate-pulse" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking session...</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // TOTP Verification Mode
  if (mode === "totp-verification" && pendingTotpUserId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
        <Card className="w-full max-w-md p-8 bg-card border-border relative z-10">
          <TotpVerification
            userId={pendingTotpUserId}
            userEmail={pendingTotpEmail}
            onSuccess={handleTotpSuccess}
            onCancel={handleTotpCancel}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: "1s" }} />

      <Card className="w-full max-w-md p-8 bg-card border-border relative z-10 animate-scale-in">
        {/* Logo Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">FlashFusion</span>
        </div>

        {/* Invitation Banner */}
        {invitationInfo && (mode === "signin" || mode === "signup") && (
          <InvitationBanner
            email={invitationInfo.email}
            orgName={invitationInfo.orgName}
            role={invitationInfo.role}
            isValid={invitationInfo.isValid}
            error={invitationInfo.error}
            onDismiss={clearInvitation}
          />
        )}

        {/* Sign In Form */}
        {mode === "signin" && (
          <SignInForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            rememberMe={rememberMe}
            setRememberMe={setRememberMe}
            authMethod={authMethod}
            setAuthMethod={setAuthMethod}
            loading={authActions.loading}
            rateLimit={rateLimit}
            showCaptcha={showCaptcha}
            setShowCaptcha={setShowCaptcha}
            onSignIn={(e) => authActions.handleSignIn(e, email, password)}
            onMagicLinkSignIn={(e) => authActions.handleMagicLinkSignIn(e, email)}
            onGoogleSignIn={handleGoogleSignIn}
            onForgotPassword={() => switchMode("forgot-password")}
            onSwitchToSignUp={() => switchMode("signup")}
            invitationInfo={invitationInfo}
          />
        )}

        {/* Sign Up Form */}
        {mode === "signup" && (
          <SignUpForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            loading={authActions.loading}
            onSignUp={(e) => authActions.handleSignUp(e, email, password, confirmPassword)}
            onGoogleSignIn={handleGoogleSignIn}
            onSwitchToSignIn={() => switchMode("signin")}
            invitationInfo={invitationInfo}
          />
        )}

        {/* Forgot Password Form */}
        {mode === "forgot-password" && (
          <ForgotPasswordForm
            email={email}
            setEmail={setEmail}
            loading={authActions.loading}
            onSubmit={(e) => authActions.handleForgotPassword(e, email)}
            onBack={() => switchMode("signin")}
          />
        )}

        {/* Reset Email Sent */}
        {mode === "reset-sent" && (
          <ResetSentView
            email={resetEmail}
            onBack={() => switchMode("signin")}
            onRetry={() => {
              setMode("forgot-password");
              setEmail(resetEmail);
            }}
          />
        )}

        {/* Magic Link Sent */}
        {mode === "magic-link-sent" && (
          <MagicLinkSentView
            email={resetEmail}
            onBack={() => switchMode("signin")}
            onRetry={() => {
              setAuthMethod("magic-link");
              setMode("signin");
              setEmail(resetEmail);
            }}
          />
        )}

        {/* Pending Email Verification */}
        {mode === "pending-verification" && (
          <PendingVerification email={resetEmail} />
        )}
      </Card>
    </div>
  );
}

// ============= Sub-components =============

interface SignInFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  rememberMe: boolean;
  setRememberMe: (remember: boolean) => void;
  authMethod: "password" | "magic-link";
  setAuthMethod: (method: "password" | "magic-link") => void;
  loading: boolean;
  rateLimit: ReturnType<typeof useAuthRateLimit>;
  showCaptcha: boolean;
  setShowCaptcha: (show: boolean) => void;
  onSignIn: (e: React.FormEvent) => void;
  onMagicLinkSignIn: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  onForgotPassword: () => void;
  onSwitchToSignUp: () => void;
  invitationInfo: any;
}

function SignInForm({
  email, setEmail, password, setPassword, rememberMe, setRememberMe,
  authMethod, setAuthMethod, loading, rateLimit, showCaptcha, setShowCaptcha,
  onSignIn, onMagicLinkSignIn, onGoogleSignIn, onForgotPassword, onSwitchToSignUp,
  invitationInfo
}: SignInFormProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
        <p className="text-muted-foreground">
          {invitationInfo?.isValid 
            ? `Sign in to join ${invitationInfo.orgName || "the organization"}`
            : "Sign in to continue your creative journey"
          }
        </p>
      </div>

      <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "password" | "magic-link")} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="magic-link" className="gap-2">
            <Sparkles className="h-3 w-3" />
            Magic Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="mt-4">
          <form onSubmit={onSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-background border-border"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={onForgotPassword} className="text-xs text-primary hover:underline" disabled={loading}>
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                className="bg-background border-border"
                autoComplete="current-password"
              />
            </div>

            {/* Login lockout/attempt warnings */}
            {rateLimit.isLoginLocked ? (
              <Alert className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Account temporarily locked.</span>{" "}
                  Please wait <span className="font-bold text-destructive">
                    {Math.floor(rateLimit.loginLockoutCooldown / 60)}:{String(rateLimit.loginLockoutCooldown % 60).padStart(2, '0')}
                  </span>
                </AlertDescription>
              </Alert>
            ) : rateLimit.getRemainingLoginAttempts() < MAX_LOGIN_ATTEMPTS && rateLimit.getRemainingLoginAttempts() > 0 ? (
              <Alert className="bg-warning/10 border-warning/30">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  <span className="font-bold text-warning">{rateLimit.getRemainingLoginAttempts()}</span>{" "}
                  attempt{rateLimit.getRemainingLoginAttempts() !== 1 ? 's' : ''} remaining before lockout
                </AlertDescription>
              </Alert>
            ) : null}

            {/* CAPTCHA Challenge */}
            {(showCaptcha || rateLimit.shouldShowCaptcha()) && !rateLimit.captchaVerified && (
              <CaptchaChallenge
                onVerified={() => {
                  rateLimit.setCaptchaVerified(true);
                  setShowCaptcha(false);
                  toast.success("Verification successful!");
                }}
                onCancel={() => setShowCaptcha(false)}
              />
            )}

            {rateLimit.captchaVerified && (
              <Alert className="bg-success/10 border-success/30">
                <Shield className="h-4 w-4 text-success" />
                <AlertDescription className="text-sm text-success">
                  Security verification complete.
                </AlertDescription>
              </Alert>
            )}

            {/* Remember me */}
            <div className="flex items-center space-x-2">
              <Checkbox id="remember-me" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
              <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Remember this device
              </label>
            </div>

            <Button
              type="submit"
              className={cn("w-full bg-gradient-hero hover:opacity-90", rateLimit.isLoginLocked && "opacity-50 cursor-not-allowed")}
              disabled={loading || rateLimit.isLoginLocked}
            >
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing in...</span>
              ) : rateLimit.isLoginLocked ? (
                <span className="flex items-center gap-2"><Clock className="h-4 w-4" />Locked</span>
              ) : "Sign In"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic-link" className="mt-4">
          <form onSubmit={onMagicLinkSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="magic-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="magic-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-background border-border pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            {rateLimit.isRateLimited ? (
              <Alert className="bg-destructive/10 border-destructive/30">
                <Clock className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm">
                  Please wait <span className="font-bold text-destructive">{rateLimit.rateLimitCooldown}s</span> before requesting another magic link.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-muted/50 border-border">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  We'll send you a secure link to sign in instantly!
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className={cn("w-full bg-gradient-hero hover:opacity-90", rateLimit.isRateLimited && "opacity-50")}
              disabled={loading || rateLimit.isRateLimited}
            >
              {loading ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sending...</span>
              ) : rateLimit.isRateLimited ? (
                <span className="flex items-center gap-2"><Clock className="h-4 w-4" />Wait {rateLimit.rateLimitCooldown}s</span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Send Magic Link</span>
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      {/* OAuth buttons */}
      <Button type="button" variant="outline" className="w-full" onClick={onGoogleSignIn} disabled={loading}>
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </Button>

      <PasskeySignInButton disabled={loading} onSuccess={() => navigate("/dashboard")} />

      <div className="mt-6 text-center">
        <button onClick={onSwitchToSignUp} className="text-sm text-muted-foreground hover:text-primary" disabled={loading}>
          Don't have an account? <span className="font-semibold">Sign up</span>
        </button>
      </div>

      <SocialProofCompact className="mt-6" />
    </>
  );
}

interface SignUpFormProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (password: string) => void;
  loading: boolean;
  onSignUp: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  onSwitchToSignIn: () => void;
  invitationInfo: any;
}

function SignUpForm({
  email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
  loading, onSignUp, onGoogleSignIn, onSwitchToSignIn, invitationInfo
}: SignUpFormProps) {
  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Create Account</h1>
        <p className="text-muted-foreground">
          {invitationInfo?.isValid 
            ? `Create an account to join ${invitationInfo.orgName || "the organization"}`
            : "Start creating amazing content today"
          }
        </p>
      </div>

      <form onSubmit={onSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="bg-background border-border"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <PasswordInput
            id="signup-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            className="bg-background border-border"
            autoComplete="new-password"
          />
          <PasswordStrengthIndicator password={password} className="mt-3" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <PasswordInput
            id="confirm-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            className="bg-background border-border"
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="w-full bg-gradient-hero hover:opacity-90" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating account...</span>
          ) : "Create Account"}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onGoogleSignIn} disabled={loading}>
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </Button>

      <div className="mt-6 text-center">
        <button onClick={onSwitchToSignIn} className="text-sm text-muted-foreground hover:text-primary" disabled={loading}>
          Already have an account? <span className="font-semibold">Sign in</span>
        </button>
      </div>

      <SocialProof className="mt-8 pt-6 border-t border-border" />
    </>
  );
}

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (email: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

function ForgotPasswordForm({ email, setEmail, loading, onSubmit, onBack }: ForgotPasswordFormProps) {
  return (
    <>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6" disabled={loading}>
        <ArrowLeft className="h-4 w-4" />Back to sign in
      </button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
        <p className="text-muted-foreground">Enter your email and we'll send you a link to reset your password</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-background border-border pl-10"
              autoComplete="email"
            />
          </div>
        </div>

        <Alert className="bg-muted/50 border-border">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            If an account exists with this email, you will receive a password reset link.
          </AlertDescription>
        </Alert>

        <Button type="submit" className="w-full bg-gradient-hero hover:opacity-90" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sending...</span>
          ) : (
            <span className="flex items-center gap-2"><Mail className="h-4 w-4" />Send Reset Link</span>
          )}
        </Button>
      </form>
    </>
  );
}

interface ResetSentViewProps {
  email: string;
  onBack: () => void;
  onRetry: () => void;
}

function ResetSentView({ email, onBack, onRetry }: ResetSentViewProps) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-muted-foreground">We've sent a password reset link to</p>
        <p className="font-semibold text-foreground mt-1">{email}</p>
      </div>
      <div className="space-y-3">
        <Button onClick={onBack} className="w-full bg-gradient-hero hover:opacity-90">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Sign In
        </Button>
        <button onClick={onRetry} className="w-full text-sm text-muted-foreground hover:text-primary">
          Didn't receive the email? Try again
        </button>
      </div>
    </div>
  );
}

interface MagicLinkSentViewProps {
  email: string;
  onBack: () => void;
  onRetry: () => void;
}

function MagicLinkSentView({ email, onBack, onRetry }: MagicLinkSentViewProps) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-muted-foreground">We've sent a magic link to</p>
        <p className="font-semibold text-foreground mt-1">{email}</p>
      </div>
      <div className="space-y-3">
        <Button onClick={onBack} className="w-full bg-gradient-hero hover:opacity-90">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Sign In
        </Button>
        <button onClick={onRetry} className="w-full text-sm text-muted-foreground hover:text-primary">
          Didn't receive the email? Try again
        </button>
      </div>
    </div>
  );
}
