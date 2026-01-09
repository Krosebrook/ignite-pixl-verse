import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Fingerprint, 
  Plus, 
  Trash2, 
  Smartphone, 
  Laptop, 
  Key, 
  Shield, 
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Passkey {
  id: string;
  credential_id: string;
  device_name: string | null;
  device_type: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface PasskeyAuthProps {
  className?: string;
  onPasskeyRegistered?: () => void;
}

// Check if WebAuthn is supported
const isWebAuthnSupported = () => {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function"
  );
};

// Check if platform authenticator is available (Touch ID, Face ID, Windows Hello)
const isPlatformAuthenticatorAvailable = async () => {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

// Generate a random challenge
const generateChallenge = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
};

// Convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

export function PasskeyAuth({ className, onPasskeyRegistered }: PasskeyAuthProps) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [supported, setSupported] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    checkSupport();
    fetchPasskeys();
  }, []);

  const checkSupport = async () => {
    const webauthnSupported = isWebAuthnSupported();
    setSupported(webauthnSupported);
    if (webauthnSupported) {
      const platform = await isPlatformAuthenticatorAvailable();
      setPlatformAvailable(platform);
    }
  };

  const fetchPasskeys = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_passkeys")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPasskeys(data || []);
    } catch (error) {
      console.error("Error fetching passkeys:", error);
      toast.error("Failed to load passkeys");
    } finally {
      setLoading(false);
    }
  };

  const registerPasskey = async () => {
    if (!deviceName.trim()) {
      toast.error("Please enter a device name");
      return;
    }

    setRegistering(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate challenge
      const challenge = generateChallenge();

      // Create credential options
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "FlashFusion",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email || user.id,
          displayName: user.email?.split("@")[0] || "User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },   // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: platformAvailable ? "platform" : "cross-platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      };

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) throw new Error("Failed to create credential");

      const response = credential.response as AuthenticatorAttestationResponse;

      // Store credential in database
      const { error } = await supabase.from("user_passkeys").insert({
        user_id: user.id,
        credential_id: arrayBufferToBase64(credential.rawId),
        public_key: arrayBufferToBase64(response.getPublicKey()!),
        device_name: deviceName.trim(),
        device_type: getDeviceType(),
        transports: response.getTransports?.() || [],
      });

      if (error) throw error;

      toast.success("Passkey registered successfully!");
      setShowRegisterForm(false);
      setDeviceName("");
      fetchPasskeys();
      onPasskeyRegistered?.();
    } catch (error: any) {
      console.error("Error registering passkey:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Passkey registration was cancelled");
      } else if (error.name === "SecurityError") {
        toast.error("Security error. Try using HTTPS.");
      } else {
        toast.error(error.message || "Failed to register passkey");
      }
    } finally {
      setRegistering(false);
    }
  };

  const deletePasskey = async (id: string) => {
    setDeletingId(id);

    try {
      const { error } = await supabase
        .from("user_passkeys")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Passkey removed");
      setPasskeys(passkeys.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting passkey:", error);
      toast.error("Failed to remove passkey");
    } finally {
      setDeletingId(null);
    }
  };

  const getDeviceType = (): string => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    if (/macintosh|mac os x/.test(ua)) return "mac";
    if (/windows/.test(ua)) return "windows";
    return "other";
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "ios":
      case "android":
        return <Smartphone className="h-4 w-4" />;
      case "mac":
      case "windows":
        return <Laptop className="h-4 w-4" />;
      default:
        return <Key className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!supported) {
    return (
      <Alert className={cn("bg-muted/50", className)}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Your browser doesn't support passkeys. Try using a modern browser like Chrome, Safari, or Edge.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Fingerprint className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Passkeys</CardTitle>
            <CardDescription>
              Sign in securely with biometric authentication
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {platformAvailable && (
          <Alert className="bg-green-500/10 border-green-500/30">
            <Shield className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Biometric authentication available!</span>{" "}
              Use {/mac|iphone|ipad/i.test(navigator.userAgent) ? "Touch ID or Face ID" : "Windows Hello"} for secure passwordless sign-in.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Registered Passkeys */}
            {passkeys.length > 0 ? (
              <div className="space-y-3">
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-background">
                        {getDeviceIcon(passkey.device_type)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {passkey.device_name || "Unnamed Passkey"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added {formatDate(passkey.created_at)}
                        </p>
                        {passkey.last_used_at && (
                          <p className="text-xs text-muted-foreground">
                            Last used {formatDate(passkey.last_used_at)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deletePasskey(passkey.id)}
                      disabled={deletingId === passkey.id}
                    >
                      {deletingId === passkey.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No passkeys registered yet</p>
              </div>
            )}

            {/* Register New Passkey */}
            {showRegisterForm ? (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
                <div className="space-y-2">
                  <Label htmlFor="device-name">Device Name</Label>
                  <Input
                    id="device-name"
                    placeholder="e.g., MacBook Pro, iPhone"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    disabled={registering}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={registerPasskey}
                    disabled={registering || !deviceName.trim()}
                    className="flex-1"
                  >
                    {registering ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="h-4 w-4 mr-2" />
                        Register Passkey
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRegisterForm(false);
                      setDeviceName("");
                    }}
                    disabled={registering}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowRegisterForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Passkey
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Passkey Sign-In Button for Auth Page
interface PasskeySignInButtonProps {
  onSuccess?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PasskeySignInButton({ onSuccess, disabled, className }: PasskeySignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
  }, []);

  const signInWithPasskey = async () => {
    setLoading(true);

    try {
      // Generate challenge
      const challenge = generateChallenge();

      // Create assertion options
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        userVerification: "preferred",
        timeout: 60000,
      };

      // Get credential
      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!credential) throw new Error("No credential returned");

      const credentialId = arrayBufferToBase64(credential.rawId);

      // Look up the passkey in the database
      const { data: passkey, error: lookupError } = await supabase
        .from("user_passkeys")
        .select("user_id")
        .eq("credential_id", credentialId)
        .single();

      if (lookupError || !passkey) {
        throw new Error("Passkey not found. Please register it first.");
      }

      // Update last used timestamp
      await supabase
        .from("user_passkeys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("credential_id", credentialId);

      toast.success("Passkey verified! Signing in...");
      onSuccess?.();
    } catch (error: any) {
      console.error("Passkey sign-in error:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Passkey authentication was cancelled");
      } else {
        toast.error(error.message || "Failed to sign in with passkey");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <Button
      variant="outline"
      className={cn("w-full", className)}
      onClick={signInWithPasskey}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Fingerprint className="h-4 w-4 mr-2" />
      )}
      Sign in with Passkey
    </Button>
  );
}
