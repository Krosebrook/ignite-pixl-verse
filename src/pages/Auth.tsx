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
import { useRecaptchaV3 } from "@/components/auth/RecaptchaV3";
import { TotpVerification, checkTotpEnabled } from "@/components/auth/TotpVerification";
import { InvitationBanner } from "@/components/auth/InvitationBanner";
import { useInvitationToken } from "@/hooks/useInvitationToken";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkOnboardingStatus } from "@/lib/onboarding";
import { logSecurityEvent, checkIpRateLimit, resetIpRateLimit, calculateRiskScore, parseUserAgent } from "@/lib/securityActivity";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup" | "forgot-password" | "reset-sent" | "magic-link-sent" | "pending-verification" | "totp-verification";

// Rate limiting constants
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MAGIC_LINK_REQUESTS = 3;
const MAX_LOGIN_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;

// CAPTCHA threshold - show CAPTCHA after this many failed attempts
const CAPTCHA_THRESHOLD = 3;

// Progressive lockout durations (in seconds): 5 min, 15 min, 1 hour
const LOCKOUT_DURATIONS = [300, 900, 3600];
const LOCKOUT_STORAGE_KEY = 'ff_lockout_level';
const LOCKOUT_RESET_HOURS = 24; // Reset lockout level after 24 hours of no lockouts

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [authMethod, setAuthMethod] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  
  // Rate limiting state
  const [magicLinkRequests, setMagicLinkRequests] = useState<number[]>([]);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  // Login attempt tracking with progressive lockout
  const [loginAttempts, setLoginAttempts] = useState<number[]>([]);
  const [loginLockoutCooldown, setLoginLockoutCooldown] = useState(0);
  const [isLoginLocked, setIsLoginLocked] = useState(false);
  const [lockoutLevel, setLockoutLevel] = useState(0); // 0, 1, or 2 for progressive durations
  
  // CAPTCHA state
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);

  // TOTP verification state
  const [pendingTotpUserId, setPendingTotpUserId] = useState<string | null>(null);
  const [pendingTotpEmail, setPendingTotpEmail] = useState<string>("");
  const navigate = useNavigate();

  // Invitation token handling
  const { inviteToken, invitationInfo, isLoading: invitationLoading, isAccepting, acceptInvitation, clearInvitation } = useInvitationToken();

  // Pre-fill email from invitation
  useEffect(() => {
    if (invitationInfo?.email && !email) {
      setEmail(invitationInfo.email);
    }
  }, [invitationInfo?.email]);

  // Load lockout level from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (stored) {
      const { level, timestamp } = JSON.parse(stored);
      const hoursSinceLastLockout = (Date.now() - timestamp) / (1000 * 60 * 60);
      // Reset level if 24 hours have passed
      if (hoursSinceLastLockout >= LOCKOUT_RESET_HOURS) {
        localStorage.removeItem(LOCKOUT_STORAGE_KEY);
        setLockoutLevel(0);
      } else {
        setLockoutLevel(level);
      }
    }
  }, []);

  // Get current lockout duration based on level
  const getCurrentLockoutDuration = useCallback(() => {
    return LOCKOUT_DURATIONS[Math.min(lockoutLevel, LOCKOUT_DURATIONS.length - 1)];
  }, [lockoutLevel]);

  // Track if we've already checked auth to prevent loops
  const hasCheckedAuth = useRef(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
  }, []); // Empty deps - run only once on mount

  // Rate limit cooldown timer
  useEffect(() => {
    if (rateLimitCooldown > 0) {
      const timer = setInterval(() => {
        setRateLimitCooldown((prev) => {
          if (prev <= 1) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitCooldown]);

  // Login lockout cooldown timer
  useEffect(() => {
    if (loginLockoutCooldown > 0) {
      const timer = setInterval(() => {
        setLoginLockoutCooldown((prev) => {
          if (prev <= 1) {
            setIsLoginLocked(false);
            setLoginAttempts([]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [loginLockoutCooldown]);

  // Get remaining login attempts
  const getRemainingLoginAttempts = useCallback(() => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS * 5 // 5 minute window
    );
    return Math.max(0, MAX_LOGIN_ATTEMPTS - recentAttempts.length);
  }, [loginAttempts]);

  // Check if CAPTCHA should be shown
  const shouldShowCaptcha = useCallback(() => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS * 5
    );
    return recentAttempts.length >= CAPTCHA_THRESHOLD && !captchaVerified;
  }, [loginAttempts, captchaVerified]);

  // Send lockout notification email
  const sendLockoutNotification = useCallback(async (userEmail: string, lockoutDuration: number) => {
    try {
      const response = await fetch(
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
            lockoutLevel: lockoutLevel + 1,
            isProgressive: true,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          }),
        }
      );
      
      if (!response.ok) {
        console.warn('Failed to send lockout notification');
      }
    } catch (error) {
      console.error('Error sending lockout notification:', error);
    }
  }, [lockoutLevel]);

  // Track failed login attempt with progressive lockout
  const trackLoginAttempt = useCallback((userEmail?: string) => {
    const now = Date.now();
    const recentAttempts = loginAttempts.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS * 5
    );
    const newAttempts = [...recentAttempts, now];
    setLoginAttempts(newAttempts);
    
    if (newAttempts.length >= MAX_LOGIN_ATTEMPTS) {
      // Get current lockout duration and increment level
      const currentDuration = LOCKOUT_DURATIONS[Math.min(lockoutLevel, LOCKOUT_DURATIONS.length - 1)];
      const newLevel = Math.min(lockoutLevel + 1, LOCKOUT_DURATIONS.length - 1);
      
      setIsLoginLocked(true);
      setLoginLockoutCooldown(currentDuration);
      setLockoutLevel(newLevel);
      
      // Store lockout level with timestamp
      localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({
        level: newLevel,
        timestamp: now,
      }));
      
      // Send lockout notification if email provided
      if (userEmail) {
        sendLockoutNotification(userEmail, currentDuration);
      }
      
      return true; // Locked
    }
    return false; // Not locked
  }, [loginAttempts, sendLockoutNotification]);

  // Check if rate limited
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const recentRequests = magicLinkRequests.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );
    setMagicLinkRequests(recentRequests);
    
    if (recentRequests.length >= MAX_MAGIC_LINK_REQUESTS) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestRequest)) / 1000);
      setRateLimitCooldown(waitTime);
      setIsRateLimited(true);
      return false;
    }
    return true;
  }, [magicLinkRequests]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (password.length > 72) {
      return "Password must be less than 72 characters";
    }
    return null;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if locked out
    if (isLoginLocked) {
      const minutes = Math.ceil(loginLockoutCooldown / 60);
      toast.error(`Too many failed attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`);
      return;
    }
    
    // Check if CAPTCHA is required but not verified
    if (shouldShowCaptcha() && !captchaVerified) {
      setShowCaptcha(true);
      toast.error("Please complete the security verification first.");
      return;
    }
    
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
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
        // Track the failed attempt with email for lockout notification
        const isNowLocked = trackLoginAttempt(email);
        const remaining = getRemainingLoginAttempts();
        
        // Check if it's an invalid credentials error
        if (error.message?.includes('Invalid login credentials') || error.code === 'invalid_credentials') {
          if (isNowLocked) {
            const lockoutMins = Math.ceil(getCurrentLockoutDuration() / 60);
            const lockoutLabel = lockoutMins >= 60 ? `${lockoutMins / 60} hour${lockoutMins >= 120 ? 's' : ''}` : `${lockoutMins} minutes`;
            toast.error(
              `Account temporarily locked due to too many failed attempts. A notification has been sent to your email. Please wait ${lockoutLabel}.`,
              { duration: 8000 }
            );
          } else {
            toast.error(
              `No account found with these credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before temporary lockout.`,
              {
                duration: 6000,
                action: {
                  label: "Sign Up",
                  onClick: () => switchMode("signup"),
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
          setPendingTotpUserId(user.id);
          setPendingTotpEmail(email);
          setMode("totp-verification");
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
  };

  const completeSignIn = async (userId: string) => {
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
  };

  const handleTotpSuccess = async () => {
    if (!pendingTotpUserId || !pendingTotpEmail) {
      toast.error("Session expired. Please sign in again.");
      setMode("signin");
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate with the stored credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: pendingTotpEmail,
        password,
      });

      if (error) {
        toast.error("Session expired. Please sign in again.");
        setMode("signin");
        return;
      }

      // Clear pending state
      setPendingTotpUserId(null);
      setPendingTotpEmail("");

      // Complete sign in
      if (data.user) {
        await completeSignIn(data.user.id);
      }
    } catch (error) {
      console.error("Error completing TOTP sign in:", error);
      toast.error("An error occurred. Please try again.");
      setMode("signin");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpCancel = async () => {
    setPendingTotpUserId(null);
    setPendingTotpEmail("");
    setPassword("");
    setMode("signin");
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check rate limit
    if (!checkRateLimit()) {
      toast.error(`Too many requests. Please wait ${rateLimitCooldown} seconds.`);
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
        // Check for rate limit error from Supabase
        if (error.message?.toLowerCase().includes('rate') || error.status === 429) {
          setIsRateLimited(true);
          setRateLimitCooldown(COOLDOWN_SECONDS);
          toast.error("Too many requests. Please wait before trying again.");
        } else {
          toast.error("Failed to send magic link. Please try again.");
        }
        return;
      }
      
      // Track this request for rate limiting
      setMagicLinkRequests((prev) => [...prev, Date.now()]);
      
      setResetEmail(email);
      setMode("magic-link-sent");
      toast.success("Magic link sent! Check your email.");
    } catch (error: any) {
      console.error("Magic link error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
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
        // Email confirmation is required
        setResetEmail(email);
        setMode("pending-verification");
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
        setResetEmail(email);
        setMode("pending-verification");
        toast.success("Account created! Please check your email to confirm.");
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
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
      
      setResetEmail(email);
      setMode("reset-sent");
      toast.success("Password reset link sent! Check your email.");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
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
        setOauthLoading(false);
      }
      // Don't set loading to false here - we're redirecting
    } catch (error: any) {
      console.error("Google sign in error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setOauthLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setLoading(false);
    // Reset CAPTCHA state on form reset
    setShowCaptcha(false);
    setCaptchaVerified(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

  // OAuth Loading Overlay
  if (oauthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-secondary/20 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          {/* Animated logo */}
          <div className="relative">
            <div className="w-20 h-20 bg-card rounded-2xl flex items-center justify-center shadow-2xl border border-border">
              <Zap className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-xl animate-pulse" />
          </div>

          {/* Loading spinner and text */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-lg font-medium">Connecting to Google...</span>
            </div>
            <p className="text-sm text-muted-foreground">
              You'll be redirected shortly
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          {/* Cancel button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOauthLoading(false)}
            className="mt-4 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Show loading spinner while checking existing session
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-glow-pulse" style={{ animationDelay: "1s" }} />
        <Card className="w-full max-w-sm p-8 bg-card border-border relative z-10 animate-scale-in">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Zap className="h-10 w-10 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 blur-xl" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking session...</span>
            </div>
          </div>
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
          <div className="relative">
            <Zap className="h-8 w-8 text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-xl" />
          </div>
          <span className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            FlashFusion
          </span>
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

            {/* Auth method tabs */}
            <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "password" | "magic-link")} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password" className="gap-2">
                  Password
                </TabsTrigger>
                <TabsTrigger value="magic-link" className="gap-2">
                  <Sparkles className="h-3 w-3" />
                  Magic Link
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
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
                      <button
                        type="button"
                        onClick={() => switchMode("forgot-password")}
                        className="text-xs text-primary hover:underline"
                        disabled={loading}
                      >
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

                  {/* Login attempt warning */}
                  {isLoginLocked ? (
                    <Alert className="bg-destructive/10 border-destructive/30">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">Account temporarily locked.</span>{" "}
                          Please wait{" "}
                          <span className="font-bold text-destructive">
                            {loginLockoutCooldown >= 3600 
                              ? `${Math.floor(loginLockoutCooldown / 3600)}:${String(Math.floor((loginLockoutCooldown % 3600) / 60)).padStart(2, '0')}:${String(loginLockoutCooldown % 60).padStart(2, '0')}`
                              : `${Math.floor(loginLockoutCooldown / 60)}:${String(loginLockoutCooldown % 60).padStart(2, '0')}`
                            }
                          </span>
                        </div>
                        {lockoutLevel > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Lockout level {lockoutLevel + 1} of {LOCKOUT_DURATIONS.length} • Duration increases with repeated lockouts
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : getRemainingLoginAttempts() < MAX_LOGIN_ATTEMPTS && getRemainingLoginAttempts() > 0 ? (
                    <Alert className="bg-warning/10 border-warning/30">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      <AlertDescription className="text-sm">
                        <span className="font-bold text-warning">{getRemainingLoginAttempts()}</span>{" "}
                        login attempt{getRemainingLoginAttempts() !== 1 ? 's' : ''} remaining before temporary lockout
                        {lockoutLevel > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (next: {Math.ceil(LOCKOUT_DURATIONS[Math.min(lockoutLevel, LOCKOUT_DURATIONS.length - 1)] / 60)} min)
                          </span>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {/* CAPTCHA Challenge */}
                  {(showCaptcha || shouldShowCaptcha()) && !captchaVerified && (
                    <CaptchaChallenge
                      onVerified={() => {
                        setCaptchaVerified(true);
                        setShowCaptcha(false);
                        toast.success("Verification successful! You may now sign in.");
                      }}
                      onCancel={() => setShowCaptcha(false)}
                    />
                  )}
                  
                  {/* CAPTCHA verified indicator */}
                  {captchaVerified && (
                    <Alert className="bg-success/10 border-success/30">
                      <Shield className="h-4 w-4 text-success" />
                      <AlertDescription className="text-sm text-success">
                        Security verification complete. You may proceed.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Remember me checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <label
                      htmlFor="remember-me"
                      className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
                    >
                      <Shield className="h-3 w-3" />
                      Remember this device
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className={cn(
                      "w-full bg-gradient-hero hover:opacity-90 transition-opacity",
                      isLoginLocked && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={loading || isLoginLocked}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : isLoginLocked ? (
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Locked ({Math.ceil(loginLockoutCooldown / 60)}m)
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="magic-link" className="mt-4">
                <form onSubmit={handleMagicLinkSignIn} className="space-y-4">
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

                  {/* Rate limit warning */}
                  {isRateLimited ? (
                    <Alert className="bg-destructive/10 border-destructive/30">
                      <Clock className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-sm">
                        <span className="font-medium">Too many requests.</span>{" "}
                        Please wait{" "}
                        <span className="font-bold text-destructive">{rateLimitCooldown}s</span>{" "}
                        before requesting another magic link.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="bg-muted/50 border-border">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-sm">
                        We'll send you a secure link to sign in instantly — no password needed!
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Remember me checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-me-magic"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <label
                      htmlFor="remember-me-magic"
                      className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
                    >
                      <Shield className="h-3 w-3" />
                      Remember this device
                    </label>
                  </div>

                  <Button
                    type="submit"
                    className={cn(
                      "w-full bg-gradient-hero hover:opacity-90 transition-all",
                      isRateLimited && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={loading || isRateLimited}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending magic link...
                      </span>
                    ) : isRateLimited ? (
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Wait {rateLimitCooldown}s
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Send Magic Link
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Passkey Sign-In */}
            <PasskeySignInButton 
              disabled={loading}
              onSuccess={() => navigate("/dashboard")}
            />

            <div className="mt-6 text-center">
              <button
                onClick={() => switchMode("signup")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                disabled={loading}
              >
                Don't have an account?{" "}
                <span className="font-semibold">Sign up</span>
              </button>
            </div>

            {/* Social proof */}
            <SocialProofCompact className="mt-6" />
          </>
        )}

        {/* Sign Up Form */}
        {mode === "signup" && (
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

            <form onSubmit={handleSignUp} className="space-y-4">
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

              <Button
                type="submit"
                className="w-full bg-gradient-hero hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="mt-6 text-center">
              <button
                onClick={() => switchMode("signin")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                disabled={loading}
              >
                Already have an account?{" "}
                <span className="font-semibold">Sign in</span>
              </button>
            </div>

            {/* Social proof */}
            <SocialProof className="mt-8 pt-6 border-t border-border" />
          </>
        )}

        {/* Forgot Password Form */}
        {mode === "forgot-password" && (
          <>
            <button
              onClick={() => switchMode("signin")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
              <p className="text-muted-foreground">
                Enter your email and we'll send you a link to reset your password
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
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
                  If an account exists with this email, you will receive a password reset link within a few minutes.
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                className="w-full bg-gradient-hero hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending reset link...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Send Reset Link
                  </span>
                )}
              </Button>
            </form>
          </>
        )}

        {/* Reset Email Sent Success */}
        {mode === "reset-sent" && (
          <>
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
                <p className="text-muted-foreground">
                  We've sent a password reset link to
                </p>
                <p className="font-semibold text-foreground mt-1">{resetEmail}</p>
              </div>

              <Alert className="bg-muted/50 border-border text-left">
                <Mail className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <p>Click the link in the email to reset your password.</p>
                  <p className="text-xs text-muted-foreground">
                    Don't see it? Check your spam folder or wait a few minutes.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Button
                  onClick={() => switchMode("signin")}
                  className="w-full bg-gradient-hero hover:opacity-90"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>

                <button
                  onClick={() => {
                    setMode("forgot-password");
                    setEmail(resetEmail);
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Didn't receive the email? Try again
                </button>
              </div>
            </div>
          </>
        )}

        {/* Magic Link Sent Success */}
        {mode === "magic-link-sent" && (
          <>
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
                <p className="text-muted-foreground">
                  We've sent a magic sign-in link to
                </p>
                <p className="font-semibold text-foreground mt-1">{resetEmail}</p>
              </div>

              <Alert className="bg-muted/50 border-border text-left">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm space-y-2">
                  <p>Click the link in the email to sign in instantly.</p>
                  <p className="text-xs text-muted-foreground">
                    The link will expire in 1 hour. Don't see it? Check your spam folder.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Button
                  onClick={() => switchMode("signin")}
                  className="w-full bg-gradient-hero hover:opacity-90"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>

                <button
                  onClick={() => {
                    setMode("signin");
                    setAuthMethod("magic-link");
                    setEmail(resetEmail);
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Didn't receive the email? Try again
                </button>
              </div>
            </div>
          </>
        )}

        {/* Pending Email Verification */}
        {mode === "pending-verification" && (
          <PendingVerification
            email={resetEmail}
            onBackToSignIn={() => switchMode("signin")}
          />
        )}

        {/* TOTP Verification */}
        {mode === "totp-verification" && pendingTotpUserId && (
          <TotpVerification
            userId={pendingTotpUserId}
            userEmail={pendingTotpEmail}
            onSuccess={handleTotpSuccess}
            onCancel={handleTotpCancel}
          />
        )}
      </Card>
    </div>
  );
}
