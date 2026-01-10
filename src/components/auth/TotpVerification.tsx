import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { verifyTotpToken } from "@/lib/totp";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TotpVerificationProps {
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
  className?: string;
}

export function TotpVerification({ 
  userId, 
  userEmail, 
  onSuccess, 
  onCancel,
  className 
}: TotpVerificationProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTEMPTS = 5;

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      setError("Too many failed attempts. Please try again later.");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      // Fetch the user's TOTP secret
      const { data: totpData, error: fetchError } = await supabase
        .from('user_totp')
        .select('secret')
        .eq('user_id', userId)
        .eq('verified', true)
        .single();

      if (fetchError || !totpData?.secret) {
        setError("2FA configuration not found. Please contact support.");
        return;
      }

      // Verify the code
      const isValid = verifyTotpToken(totpData.secret, code, userEmail);

      if (isValid) {
        onSuccess();
      } else {
        setAttempts((prev) => prev + 1);
        const remaining = MAX_ATTEMPTS - attempts - 1;
        if (remaining <= 0) {
          setError("Too many failed attempts. Please try again later.");
        } else {
          setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
        }
        setCode("");
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('TOTP verification error:', err);
      setError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6 && !verifying) {
      handleVerify();
    }
  };

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="totp-code">Verification Code</Label>
          <Input
            ref={inputRef}
            id="totp-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className="text-center text-3xl tracking-[0.5em] font-mono h-14"
            disabled={verifying || attempts >= MAX_ATTEMPTS}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleVerify}
            disabled={code.length !== 6 || verifying || attempts >= MAX_ATTEMPTS}
            className="w-full"
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full"
            disabled={verifying}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Open your authenticator app (Google Authenticator, Authy, etc.) to view your verification code.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Check if a user has TOTP enabled
 */
export async function checkTotpEnabled(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_totp')
      .select('verified')
      .eq('user_id', userId)
      .eq('verified', true)
      .maybeSingle();

    if (error) {
      console.error('Error checking TOTP status:', error);
      return false;
    }

    return !!data?.verified;
  } catch (error) {
    console.error('Error checking TOTP status:', error);
    return false;
  }
}
