import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { checkDistributedRateLimit } from '../_shared/ratelimit-redis.ts';
import {
  corsPreflightResponse,
  rateLimitResponse,
} from '../_shared/http.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LockoutNotificationRequest {
  email: string;
  failedAttempts: number;
  lockoutMinutes: number;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const { 
      email, 
      failedAttempts,
      lockoutMinutes,
      timestamp, 
      ipAddress,
      userAgent,
    }: LockoutNotificationRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting - 3 lockout notifications per email per hour
    const rateLimit = await checkDistributedRateLimit(email, 'lockout_notification', 3, 3600000);
    if (!rateLimit.allowed) {
      console.warn("Rate limit exceeded for lockout notifications", { email });
      return rateLimitResponse(
        "Too many lockout notifications. Please try again later.",
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formattedTime = new Date(timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Parse user agent for device info
    const deviceInfo = userAgent ? parseUserAgent(userAgent) : 'Unknown device';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Temporarily Locked</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <div style="display: inline-block; padding: 12px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 12px;">
                      <span style="font-size: 24px;">🔒</span>
                    </div>
                    <h1 style="margin: 20px 0 10px; color: #ffffff; font-size: 24px; font-weight: 600;">
                      Account Temporarily Locked
                    </h1>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                      Your FlashFusion account has been temporarily locked due to multiple failed login attempts
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 20px 40px;">
                    <table role="presentation" style="width: 100%; background-color: #334155; border-radius: 8px;">
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Failed Attempts</p>
                          <p style="margin: 4px 0 0; color: #ef4444; font-size: 14px; font-weight: 600;">${failedAttempts} consecutive failed login attempts</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Lockout Duration</p>
                          <p style="margin: 4px 0 0; color: #fbbf24; font-size: 14px; font-weight: 500;">${lockoutMinutes} minutes</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Time</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${formattedTime}</p>
                        </td>
                      </tr>
                      ${ipAddress ? `
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">IP Address</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${ipAddress}</p>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 20px;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Device</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${deviceInfo}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Warning -->
                <tr>
                  <td style="padding: 0 40px 20px;">
                    <table role="presentation" style="width: 100%; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;">
                      <tr>
                        <td style="padding: 16px;">
                          <p style="margin: 0; color: #fca5a5; font-size: 14px;">
                            <strong>Not you?</strong> If you didn't attempt to log in, someone may be trying to access your account. We recommend resetting your password immediately.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Buttons -->
                <tr>
                  <td style="padding: 0 40px 40px; text-align: center;">
                    <a href="${Deno.env.get("SITE_URL") || "https://flashfusion.co"}/auth?mode=forgot-password" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #FF7B00, #E91E63); color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 14px; margin-right: 12px;">
                      Reset Password
                    </a>
                    <a href="${Deno.env.get("SITE_URL") || "https://flashfusion.co"}/security" 
                       style="display: inline-block; padding: 14px 32px; background: transparent; border: 1px solid #475569; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 14px;">
                      Security Settings
                    </a>
                  </td>
                </tr>
                
                <!-- Info -->
                <tr>
                  <td style="padding: 0 40px 20px;">
                    <table role="presentation" style="width: 100%; background-color: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px;">
                      <tr>
                        <td style="padding: 16px;">
                          <p style="margin: 0; color: #93c5fd; font-size: 14px;">
                            <strong>What happens now?</strong> Your account will automatically unlock after ${lockoutMinutes} minutes. You can also reset your password to regain access immediately.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #0f172a; text-align: center;">
                    <p style="margin: 0; color: #64748b; font-size: 12px;">
                      This is an automated security alert from FlashFusion.
                      <br>
                      You received this because multiple failed login attempts were detected on your account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FlashFusion Security <security@resend.dev>",
        to: [email],
        subject: "⚠️ Your FlashFusion Account Has Been Temporarily Locked",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await res.json();
    console.log("Lockout notification sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in account-lockout-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Parse user agent string for basic device info
function parseUserAgent(ua: string): string {
  const browser = ua.includes('Chrome') ? 'Chrome' :
                  ua.includes('Firefox') ? 'Firefox' :
                  ua.includes('Safari') ? 'Safari' :
                  ua.includes('Edge') ? 'Edge' : 'Unknown browser';
  
  const os = ua.includes('Windows') ? 'Windows' :
             ua.includes('Mac') ? 'macOS' :
             ua.includes('Linux') ? 'Linux' :
             ua.includes('Android') ? 'Android' :
             ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : 'Unknown OS';
  
  return `${browser} on ${os}`;
}

serve(handler);
