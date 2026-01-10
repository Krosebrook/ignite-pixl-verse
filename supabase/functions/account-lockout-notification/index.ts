import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkDistributedRateLimit } from '../_shared/ratelimit-redis.ts';
import {
  corsPreflightResponse,
  rateLimitResponse,
} from '../_shared/http.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LockoutNotificationRequest {
  email: string;
  phoneNumber?: string;
  failedAttempts: number;
  lockoutMinutes: number;
  lockoutLevel?: number;
  isProgressive?: boolean;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  notificationMethod?: 'email' | 'sms' | 'both';
}

// Send email notification via Resend
async function sendEmailNotification(
  email: string,
  data: {
    failedAttempts: number;
    lockoutMinutes: number;
    lockoutLevel: number;
    isProgressive: boolean;
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return false;
  }

  const formattedTime = new Date(data.timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const deviceInfo = data.userAgent ? parseUserAgent(data.userAgent) : 'Unknown device';
  const lockoutLabel = data.lockoutMinutes >= 60 
    ? `${data.lockoutMinutes / 60} hour${data.lockoutMinutes >= 120 ? 's' : ''}`
    : `${data.lockoutMinutes} minutes`;

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
                        <p style="margin: 4px 0 0; color: #ef4444; font-size: 14px; font-weight: 600;">${data.failedAttempts} consecutive failed login attempts</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Lockout Duration</p>
                        <p style="margin: 4px 0 0; color: #fbbf24; font-size: 14px; font-weight: 500;">${lockoutLabel}</p>
                      </td>
                    </tr>
                    ${data.isProgressive ? `
                    <tr>
                      <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Lockout Level</p>
                        <p style="margin: 4px 0 0; color: #f97316; font-size: 14px; font-weight: 500;">Level ${data.lockoutLevel} of 3 (duration increases with each lockout)</p>
                      </td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Time</p>
                        <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${formattedTime}</p>
                      </td>
                    </tr>
                    ${data.ipAddress ? `
                    <tr>
                      <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">IP Address</p>
                        <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${data.ipAddress}</p>
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
                          <strong>What happens now?</strong> Your account will automatically unlock after ${lockoutLabel}. You can also reset your password to regain access immediately.
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

  try {
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
      return false;
    }

    console.log("Email notification sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send email notification:", error);
    return false;
  }
}

// Send SMS notification via Twilio
async function sendSmsNotification(
  phoneNumber: string,
  data: {
    lockoutMinutes: number;
    lockoutLevel: number;
    isProgressive: boolean;
  }
): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("Twilio credentials not configured");
    return false;
  }

  const lockoutLabel = data.lockoutMinutes >= 60 
    ? `${data.lockoutMinutes / 60} hour${data.lockoutMinutes >= 120 ? 's' : ''}`
    : `${data.lockoutMinutes} minutes`;

  const message = data.isProgressive
    ? `⚠️ FlashFusion Security Alert: Your account has been locked for ${lockoutLabel} due to failed login attempts (Level ${data.lockoutLevel}/3). If this wasn't you, reset your password immediately.`
    : `⚠️ FlashFusion Security Alert: Your account has been locked for ${lockoutLabel} due to failed login attempts. If this wasn't you, reset your password immediately.`;

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        To: phoneNumber,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Twilio API error:", error);
      return false;
    }

    console.log("SMS notification sent successfully");
    return true;
  } catch (error) {
    console.error("Failed to send SMS notification:", error);
    return false;
  }
}

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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const { 
      email, 
      phoneNumber,
      failedAttempts,
      lockoutMinutes,
      lockoutLevel = 1,
      isProgressive = false,
      timestamp, 
      ipAddress,
      userAgent,
      notificationMethod = 'email',
    }: LockoutNotificationRequest = await req.json();

    if (!email && !phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Email or phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting - 3 lockout notifications per identifier per hour
    const rateLimitKey = email || phoneNumber || 'unknown';
    const rateLimit = await checkDistributedRateLimit(rateLimitKey, 'lockout_notification', 3, 3600000);
    if (!rateLimit.allowed) {
      console.warn("Rate limit exceeded for lockout notifications", { email, phoneNumber });
      return rateLimitResponse(
        "Too many lockout notifications. Please try again later.",
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      );
    }

    // Check user's notification preferences if we have their email
    if (email) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("security_alerts_enabled")
        .eq("user_id", email)
        .maybeSingle();
      
      if (prefs?.security_alerts_enabled === false) {
        return new Response(
          JSON.stringify({ message: "Security notifications disabled by user" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const results: { email?: boolean; sms?: boolean } = {};

    // Send email notification
    if ((notificationMethod === 'email' || notificationMethod === 'both') && email) {
      results.email = await sendEmailNotification(email, {
        failedAttempts,
        lockoutMinutes,
        lockoutLevel,
        isProgressive,
        timestamp,
        ipAddress,
        userAgent,
      });
    }

    // Send SMS notification
    if ((notificationMethod === 'sms' || notificationMethod === 'both') && phoneNumber) {
      results.sms = await sendSmsNotification(phoneNumber, {
        lockoutMinutes,
        lockoutLevel,
        isProgressive,
      });
    }

    // Check if any notification was sent
    if (!results.email && !results.sms) {
      if (!RESEND_API_KEY && !TWILIO_ACCOUNT_SID) {
        console.warn("No notification services configured");
        return new Response(
          JSON.stringify({ error: "Notification services not configured", configured: { email: !!RESEND_API_KEY, sms: !!TWILIO_ACCOUNT_SID } }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log("Lockout notification completed:", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in account-lockout-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
