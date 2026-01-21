import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface InvitationInfo {
  token: string;
  email: string | null;
  orgName: string | null;
  role: string | null;
  isValid: boolean;
  error: string | null;
}

export function useInvitationToken() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  const inviteToken = searchParams.get("invite");

  // Validate invitation token on mount - only once per token
  useEffect(() => {
    if (inviteToken && !hasValidated) {
      setHasValidated(true);
      validateToken(inviteToken);
    }
  }, [inviteToken, hasValidated]);

  const validateToken = async (token: string) => {
    setIsLoading(true);
    try {
      // Fetch invitation details without requiring auth
      const { data, error } = await supabase
        .from("invitations")
        .select("email, role, status, expires_at, orgs(name)")
        .eq("token", token)
        .single();

      if (error || !data) {
        setInvitationInfo({
          token,
          email: null,
          orgName: null,
          role: null,
          isValid: false,
          error: "Invalid invitation link",
        });
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setInvitationInfo({
          token,
          email: data.email,
          orgName: (data.orgs as { name: string } | null)?.name || null,
          role: data.role,
          isValid: false,
          error: "This invitation has expired",
        });
        return;
      }

      // Check if already used
      if (data.status !== "pending") {
        setInvitationInfo({
          token,
          email: data.email,
          orgName: (data.orgs as { name: string } | null)?.name || null,
          role: data.role,
          isValid: false,
          error: `This invitation has already been ${data.status}`,
        });
        return;
      }

      setInvitationInfo({
        token,
        email: data.email,
        orgName: (data.orgs as { name: string } | null)?.name || null,
        role: data.role,
        isValid: true,
        error: null,
      });
    } catch (error) {
      console.error("Error validating invitation:", error);
      setInvitationInfo({
        token,
        email: null,
        orgName: null,
        role: null,
        isValid: false,
        error: "Failed to validate invitation",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitation = useCallback(async (): Promise<{
    success: boolean;
    orgId?: string;
    error?: string;
  }> => {
    if (!invitationInfo?.token) {
      return { success: false, error: "No invitation token" };
    }

    setIsAccepting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: "Please sign in first" };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token: invitationInfo.token }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to accept invitation" };
      }

      // Defer URL update to prevent re-render loops
      setTimeout(() => {
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete("invite");
        setSearchParams(newParams, { replace: true });
      }, 100);

      return { success: true, orgId: result.orgId };
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return { success: false, error: "Failed to accept invitation" };
    } finally {
      setIsAccepting(false);
    }
  }, [invitationInfo?.token, setSearchParams]); // Only depend on token, not full object

  const clearInvitation = useCallback(() => {
    searchParams.delete("invite");
    setSearchParams(searchParams, { replace: true });
    setInvitationInfo(null);
  }, [searchParams, setSearchParams]);

  return {
    inviteToken,
    invitationInfo,
    isLoading,
    isAccepting,
    acceptInvitation,
    clearInvitation,
  };
}
