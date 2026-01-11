import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
  orgId: string;
  orgName: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, role, orgId, orgName }: InvitationRequest = await req.json();

    if (!email || !role || !orgId || !orgName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user is admin of the org
    const { data: membership, error: memberError } = await supabaseClient
      .from("members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if user already exists in org
    const { data: existingMember } = await supabaseClient
      .from("members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", (
        await supabaseClient.auth.admin.listUsers()
      ).data.users?.find(u => u.email === email)?.id ?? "")
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ error: "User is already a member" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabaseClient
      .from("invitations")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      return new Response(JSON.stringify({ error: "Invitation already pending for this email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseClient
      .from("invitations")
      .insert({
        org_id: orgId,
        email: email.toLowerCase().trim(),
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Failed to create invitation:", inviteError);
      return new Response(JSON.stringify({ error: "Failed to create invitation" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get inviter's profile
    const { data: inviterProfile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile?.display_name || user.email || "A team member";
    const appUrl = Deno.env.get("APP_URL") || "https://flashfusion.co";
    const inviteLink = `${appUrl}/auth?invite=${invitation.token}`;

    // Send invitation email
    const emailResponse = await resend.emails.send({
      from: "FlashFusion <notifications@resend.dev>",
      to: [email],
      subject: `You've been invited to join ${orgName} on FlashFusion`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #FF7B00; margin: 0;">FlashFusion</h1>
          </div>
          
          <div style="background: linear-gradient(135deg, #0F172A, #1E293B); border-radius: 12px; padding: 32px; color: white;">
            <h2 style="margin-top: 0; color: #FF7B00;">You're Invited! 🎉</h2>
            
            <p style="color: #E5E7EB;">
              <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a <strong>${role}</strong> on FlashFusion.
            </p>
            
            <p style="color: #E5E7EB;">
              FlashFusion is a creative content platform that helps teams generate stunning images, videos, and more using AI.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #FF7B00, #FF9500); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #9CA3AF; font-size: 14px;">
              This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px; color: #6B7280; font-size: 12px;">
            <p>© ${new Date().getFullYear()} FlashFusion. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Invitation email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, invitation }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-invitation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
