import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LoginNotificationRequest {
  email: string;
  deviceName: string;
  browser: string;
  os: string;
  timestamp: string;
  location?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      deviceName, 
      browser, 
      os, 
      timestamp, 
      location 
    }: LoginNotificationRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Sign-in Alert</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center;">
                    <div style="display: inline-block; padding: 12px; background: linear-gradient(135deg, #FF7B00, #E91E63); border-radius: 12px;">
                      <span style="font-size: 24px;">⚡</span>
                    </div>
                    <h1 style="margin: 20px 0 10px; color: #ffffff; font-size: 24px; font-weight: 600;">
                      New Sign-in Detected
                    </h1>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                      We noticed a new sign-in to your FlashFusion account
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 20px 40px;">
                    <table role="presentation" style="width: 100%; background-color: #334155; border-radius: 8px; padding: 20px;">
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Device</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${deviceName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Browser</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${browser} on ${os}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 20px; border-bottom: 1px solid #475569;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Time</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${formattedTime}</p>
                        </td>
                      </tr>
                      ${location ? `
                      <tr>
                        <td style="padding: 12px 20px;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Location</p>
                          <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px; font-weight: 500;">${location}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
                
                <!-- Warning -->
                <tr>
                  <td style="padding: 0 40px 20px;">
                    <table role="presentation" style="width: 100%; background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 16px;">
                      <tr>
                        <td style="padding: 0 16px;">
                          <p style="margin: 0; color: #fbbf24; font-size: 14px;">
                            <strong>Wasn't you?</strong> If you didn't sign in, please secure your account immediately by changing your password and enabling two-factor authentication.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Button -->
                <tr>
                  <td style="padding: 0 40px 40px; text-align: center;">
                    <a href="${Deno.env.get("SITE_URL") || "https://flashfusion.co"}/security" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #FF7B00, #E91E63); color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 14px;">
                      Review Security Settings
                    </a>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #0f172a; text-align: center;">
                    <p style="margin: 0; color: #64748b; font-size: 12px;">
                      This is an automated security alert from FlashFusion.
                      <br>
                      You received this email because a new device signed into your account.
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
        subject: "New Sign-in to Your FlashFusion Account",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await res.json();
    console.log("Login notification sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in login-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
