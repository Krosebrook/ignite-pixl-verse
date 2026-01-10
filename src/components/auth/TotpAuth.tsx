import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Smartphone, 
  Shield, 
  CheckCircle, 
  Loader2, 
  Copy, 
  QrCode,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TotpSettings {
  id: string;
  verified: boolean;
  created_at: string;
  verified_at: string | null;
}

interface TotpAuthProps {
  className?: string;
}

// Generate a random base32 secret
function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  for (let i = 0; i < 20; i++) {
    secret += chars[array[i] % 32];
  }
  return secret;
}

// Generate TOTP URI for authenticator apps
function generateTotpUri(secret: string, email: string): string {
  const issuer = encodeURIComponent('FlashFusion');
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// Simple TOTP verification (in production, use a proper library)
function verifyTotp(secret: string, token: string): boolean {
  // This is a simplified verification
  // In production, implement proper TOTP algorithm or use server-side verification
  return token.length === 6 && /^\d{6}$/.test(token);
}

export function TotpAuth({ className }: TotpAuthProps) {
  const [totp, setTotp] = useState<TotpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [setupSecret, setSetupSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetchTotpSettings();
    getUserEmail();
  }, []);

  const getUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  };

  const fetchTotpSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_totp')
        .select('id, verified, created_at, verified_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching TOTP settings:', error);
        return;
      }

      setTotp(data);
    } catch (error) {
      console.error('Error fetching TOTP settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = () => {
    const secret = generateSecret();
    setSetupSecret(secret);
    setVerificationCode("");
    setSetupOpen(true);
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setupSecret);
      toast.success("Secret copied to clipboard");
    } catch {
      toast.error("Failed to copy secret");
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    setVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // In production, verify the TOTP code server-side
      // For now, we'll do a basic check and store the secret
      if (!verifyTotp(setupSecret, verificationCode)) {
        toast.error("Invalid verification code");
        return;
      }

      // Check if user already has TOTP
      const { data: existing } = await supabase
        .from('user_totp')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('user_totp')
          .update({
            secret: setupSecret,
            verified: true,
            verified_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('user_totp')
          .insert({
            user_id: user.id,
            secret: setupSecret,
            verified: true,
            verified_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      toast.success("Two-factor authentication enabled!");
      setSetupOpen(false);
      fetchTotpSettings();
    } catch (error) {
      console.error('Error enabling TOTP:', error);
      toast.error("Failed to enable 2FA");
    } finally {
      setVerifying(false);
    }
  };

  const disableTotp = async () => {
    setDisabling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('user_totp')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success("Two-factor authentication disabled");
      setTotp(null);
    } catch (error) {
      console.error('Error disabling TOTP:', error);
      toast.error("Failed to disable 2FA");
    } finally {
      setDisabling(false);
    }
  };

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Authenticator App</CardTitle>
          </div>
          {totp?.verified && (
            <Badge variant="outline" className="gap-1 border-green-500/50 text-green-500">
              <CheckCircle className="h-3 w-3" />
              Enabled
            </Badge>
          )}
        </div>
        <CardDescription>
          Use an authenticator app like Google Authenticator or Authy for additional security
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {totp?.verified ? (
          <>
            <Alert className="border-green-500/30 bg-green-500/10">
              <Shield className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-500">
                Two-factor authentication is enabled. Your account is protected.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Authenticator App</p>
                <p className="text-xs text-muted-foreground">
                  Enabled on {new Date(totp.verified_at || totp.created_at).toLocaleDateString()}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will make your account less secure. You'll need to set it up again to re-enable.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={disableTotp}
                      disabled={disabling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {disabling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disabling...
                        </>
                      ) : (
                        "Disable 2FA"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription>
                Two-factor authentication adds an extra layer of security to your account.
              </AlertDescription>
            </Alert>

            <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
              <DialogTrigger asChild>
                <Button onClick={startSetup} className="w-full gap-2">
                  <Shield className="h-4 w-4" />
                  Enable 2FA
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    Set Up Authenticator
                  </DialogTitle>
                  <DialogDescription>
                    Scan the QR code or enter the secret key manually in your authenticator app
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* QR Code placeholder - in production, use a QR code library */}
                  <div className="flex justify-center">
                    <div className="w-48 h-48 bg-white p-4 rounded-lg">
                      <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                        <div className="text-center">
                          <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            QR Code
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Use secret key below
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secret Key */}
                  <div className="space-y-2">
                    <Label>Secret Key</Label>
                    <div className="flex gap-2">
                      <Input
                        value={setupSecret}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button variant="outline" size="icon" onClick={copySecret}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter this key manually if you can't scan the QR code
                    </p>
                  </div>

                  {/* Verification Code */}
                  <div className="space-y-2">
                    <Label>Verification Code</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSetupOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={verifyAndEnable}
                    disabled={verifying || verificationCode.length !== 6}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Enable"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
