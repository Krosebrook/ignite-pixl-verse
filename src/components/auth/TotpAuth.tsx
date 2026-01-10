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
import { 
  generateTotpSecret, 
  generateQrCodeDataUrl, 
  verifyTotpToken 
} from "@/lib/totp";

interface TotpSettings {
  id: string;
  verified: boolean;
  created_at: string;
  verified_at: string | null;
}

interface TotpAuthProps {
  className?: string;
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
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [generatingQr, setGeneratingQr] = useState(false);

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

  const startSetup = async () => {
    setGeneratingQr(true);
    try {
      const secret = generateTotpSecret();
      setSetupSecret(secret);
      setVerificationCode("");
      
      // Generate QR code
      const qrUrl = await generateQrCodeDataUrl(secret, userEmail);
      setQrCodeUrl(qrUrl);
      
      setSetupOpen(true);
    } catch (error) {
      console.error('Error starting TOTP setup:', error);
      toast.error("Failed to generate 2FA setup");
    } finally {
      setGeneratingQr(false);
    }
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

      // Verify the TOTP code using proper algorithm
      if (!verifyTotpToken(setupSecret, verificationCode, userEmail)) {
        toast.error("Invalid verification code. Please check your authenticator app and try again.");
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
      setQrCodeUrl("");
      setSetupSecret("");
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
                <Button onClick={startSetup} disabled={generatingQr} className="w-full gap-2">
                  {generatingQr ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Enable 2FA
                    </>
                  )}
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
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="w-52 h-52 bg-white p-2 rounded-lg shadow-sm">
                      {qrCodeUrl ? (
                        <img 
                          src={qrCodeUrl} 
                          alt="TOTP QR Code" 
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      )}
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
