import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, ArrowLeft, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkOnboardingStatus } from "@/lib/onboarding";

type AuthMode = "signin" | "signup" | "forgot-password" | "reset-sent";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const status = await checkOnboardingStatus(session.user.id);
        if (status.onboardingComplete) {
          navigate("/dashboard");
        } else {
          navigate("/onboarding");
        }
      }
    };
    
    checkAuth();
  }, [navigate]);

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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error);
        toast.error("Authentication failed. Please check your credentials and try again.");
        return;
      }
      
      // Check onboarding status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const status = await checkOnboardingStatus(user.id);
        if (status.onboardingComplete) {
          toast.success("Welcome back!");
          navigate("/dashboard");
        } else {
          toast.success("Welcome! Let's complete your setup.");
          navigate("/onboarding");
        }
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
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
      const { error } = await supabase.auth.signUp({
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
      
      // After signup, check onboarding status and redirect
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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setLoading(false);
  };

  const switchMode = (newMode: AuthMode) => {
    resetForm();
    setMode(newMode);
  };

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

        {/* Sign In Form */}
        {mode === "signin" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
              <p className="text-muted-foreground">
                Sign in to continue your creative journey
              </p>
            </div>

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
                <Input
                  id="password"
                  type="password"
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

              <Button
                type="submit"
                className="w-full bg-gradient-hero hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
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
                onClick={() => switchMode("signup")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                disabled={loading}
              >
                Don't have an account?{" "}
                <span className="font-semibold">Sign up</span>
              </button>
            </div>
          </>
        )}

        {/* Sign Up Form */}
        {mode === "signup" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Create Account</h1>
              <p className="text-muted-foreground">
                Start creating amazing content today
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
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                  className="bg-background border-border"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
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
                    <span className="animate-spin">⏳</span>
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
                    <span className="animate-spin">⏳</span>
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
      </Card>
    </div>
  );
}
