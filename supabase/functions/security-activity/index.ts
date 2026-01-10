import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsPreflightResponse,
  successResponse,
  errorResponse,
  parseJsonBody,
} from '../_shared/http.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LogActivityRequest {
  user_id: string;
  event_type: string;
  event_category?: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  location?: string;
  success?: boolean;
  failure_reason?: string;
  risk_score?: number;
  metadata?: Record<string, unknown>;
}

interface CheckIpRateLimitRequest {
  ip_address: string;
  action: string;
  max_attempts?: number;
  window_minutes?: number;
  block_minutes?: number;
}

interface ResetIpRateLimitRequest {
  ip_address: string;
  action: string;
}

interface VerifyRecaptchaRequest {
  token: string;
  action?: string;
  min_score?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method === "POST") {
      const body = await parseJsonBody<Record<string, unknown>>(req);

      // Log security activity
      if (path === 'log' || path === 'security-activity') {
        const data = body as unknown as LogActivityRequest;
        
        if (!data.user_id || !data.event_type) {
          return errorResponse("user_id and event_type are required", 400);
        }

        const { error } = await supabase
          .from('security_activity_log')
          .insert({
            user_id: data.user_id,
            event_type: data.event_type,
            event_category: data.event_category || 'security',
            ip_address: data.ip_address,
            user_agent: data.user_agent,
            device_type: data.device_type,
            browser: data.browser,
            os: data.os,
            location: data.location,
            success: data.success ?? true,
            failure_reason: data.failure_reason,
            risk_score: data.risk_score || 0,
            metadata: data.metadata || {},
          });

        if (error) {
          console.error("Error logging activity:", error);
          return errorResponse("Failed to log activity", 500);
        }

        return successResponse({ success: true, message: "Activity logged" });
      }

      // Check IP rate limit
      if (path === 'check-ip-limit') {
        const data = body as unknown as CheckIpRateLimitRequest;
        
        if (!data.ip_address || !data.action) {
          return errorResponse("ip_address and action are required", 400);
        }

        const { data: result, error } = await supabase.rpc('check_ip_rate_limit', {
          p_ip_address: data.ip_address,
          p_action: data.action,
          p_max_attempts: data.max_attempts || 10,
          p_window_minutes: data.window_minutes || 15,
          p_block_minutes: data.block_minutes || 30,
        });

        if (error) {
          console.error("Error checking IP rate limit:", error);
          return errorResponse("Failed to check rate limit", 500);
        }

        // If blocked, return 429
        if (!result.allowed) {
          return new Response(
            JSON.stringify(result),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil((new Date(result.blocked_until).getTime() - Date.now()) / 1000)),
                ...corsHeaders,
              },
            }
          );
        }

        return successResponse(result);
      }

      // Reset IP rate limit
      if (path === 'reset-ip-limit') {
        const data = body as unknown as ResetIpRateLimitRequest;
        
        if (!data.ip_address || !data.action) {
          return errorResponse("ip_address and action are required", 400);
        }

        const { error } = await supabase.rpc('reset_ip_rate_limit', {
          p_ip_address: data.ip_address,
          p_action: data.action,
        });

        if (error) {
          console.error("Error resetting IP rate limit:", error);
          return errorResponse("Failed to reset rate limit", 500);
        }

        return successResponse({ success: true, message: "Rate limit reset" });
      }

      // Verify reCAPTCHA v3
      if (path === 'verify-recaptcha') {
        const data = body as unknown as VerifyRecaptchaRequest;
        
        if (!data.token) {
          return errorResponse("token is required", 400);
        }

        const RECAPTCHA_SECRET = Deno.env.get("RECAPTCHA_SECRET_KEY");
        
        if (!RECAPTCHA_SECRET) {
          console.warn("RECAPTCHA_SECRET_KEY not configured, skipping verification");
          return successResponse({ 
            success: true, 
            score: 1.0, 
            action: data.action || 'unknown',
            warning: "reCAPTCHA not configured, verification skipped"
          });
        }

        const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
        const params = new URLSearchParams({
          secret: RECAPTCHA_SECRET,
          response: data.token,
        });

        const response = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        const result = await response.json();
        const minScore = data.min_score || 0.5;

        if (!result.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'reCAPTCHA verification failed',
              error_codes: result['error-codes'],
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        // Check score threshold
        if (result.score < minScore) {
          return new Response(
            JSON.stringify({
              success: false,
              score: result.score,
              action: result.action,
              error: 'reCAPTCHA score too low',
              threshold: minScore,
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        // Optionally verify action matches
        if (data.action && result.action !== data.action) {
          return new Response(
            JSON.stringify({
              success: false,
              expected_action: data.action,
              actual_action: result.action,
              error: 'reCAPTCHA action mismatch',
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

        return successResponse({
          success: true,
          score: result.score,
          action: result.action,
          hostname: result.hostname,
          challenge_ts: result.challenge_ts,
        });
      }
    }

    return errorResponse("Invalid endpoint", 404);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in security-activity function:", error);
    return errorResponse(errorMessage, 500);
  }
};

serve(handler);
