import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import shared utilities
import { checkRateLimit } from "../_shared/ratelimit.ts";
import { Logger, Tracer, metrics, reportError, trackRequest } from "../_shared/observability.ts";
import {
  corsPreflightResponse,
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  rateLimitResponse,
  errorResponse,
  getAuthToken,
  getIdempotencyKey,
  getRequestId,
  parseJsonBody,
  validateRequiredFields,
} from "../_shared/http.ts";

const FUNCTION_NAME = "schedule";

const VALID_PLATFORMS = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube"];

interface ScheduleRequest {
  org_id: string;
  asset_id: string;
  platform: string;
  scheduled_at: string;
  campaign_id?: string;
}

function validateScheduleRequest(body: ScheduleRequest): { valid: boolean; error?: string } {
  // Validate platform
  if (!VALID_PLATFORMS.includes(body.platform.toLowerCase())) {
    return { valid: false, error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` };
  }

  // Validate scheduled_at is in the future
  const scheduledDate = new Date(body.scheduled_at);
  if (isNaN(scheduledDate.getTime())) {
    return { valid: false, error: "scheduled_at must be a valid date in ISO 8601 format" };
  }
  
  if (scheduledDate <= new Date()) {
    return { valid: false, error: "scheduled_at must be in the future" };
  }

  // Don't allow scheduling more than 1 year in advance
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  if (scheduledDate > maxDate) {
    return { valid: false, error: "scheduled_at cannot be more than 1 year in the future" };
  }

  return { valid: true };
}

serve(async (req) => {
  const requestId = getRequestId(req);
  const logger = new Logger(FUNCTION_NAME, { requestId });
  const tracer = new Tracer(requestId);
  const { logRequest, logResponse } = trackRequest(logger, req, FUNCTION_NAME);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  logRequest();

  try {
    // Validate authorization
    const token = getAuthToken(req);
    if (!token) {
      const response = unauthorizedResponse("Missing authorization header");
      logResponse(401);
      return response;
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const authSpanId = tracer.startSpan("auth.verify");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      tracer.endSpan(authSpanId, "error");
      logger.warn("Authentication failed", { error: authError?.message });
      const response = unauthorizedResponse("Invalid authentication token");
      logResponse(401);
      return response;
    }
    tracer.endSpan(authSpanId, "ok");
    logger.info("User authenticated", { userId: user.id });

    // Parse request body
    const body = await parseJsonBody<ScheduleRequest>(req);
    if (!body) {
      const response = badRequestResponse("Invalid JSON body");
      logResponse(400);
      return response;
    }

    // Validate required fields
    const { valid: hasRequired, missing } = validateRequiredFields(body, ["org_id", "asset_id", "platform", "scheduled_at"]);
    if (!hasRequired) {
      const response = badRequestResponse(`Missing required fields: ${missing.join(", ")}`);
      logResponse(400);
      return response;
    }

    // Validate schedule request
    const validation = validateScheduleRequest(body);
    if (!validation.valid) {
      const response = badRequestResponse(validation.error!);
      logResponse(400);
      return response;
    }

    // Rate limiting - 50 schedules per hour
    const rateLimitSpanId = tracer.startSpan("ratelimit.check");
    const rateLimit = await checkRateLimit(user.id, "schedule_create", 50, 3600000);
    tracer.endSpan(rateLimitSpanId, rateLimit.allowed ? "ok" : "error");

    if (!rateLimit.allowed) {
      logger.warn("Rate limit exceeded", { userId: user.id });
      metrics.counter("rate_limit.exceeded", 1, { function: FUNCTION_NAME });
      const response = rateLimitResponse(
        "Rate limit exceeded. Please try again later.",
        rateLimit.resetAt - Date.now(),
        rateLimit.remaining
      );
      logResponse(429);
      return response;
    }

    // Verify org membership
    const membershipSpanId = tracer.startSpan("db.check_membership");
    const { data: membership, error: memberError } = await supabase
      .from("members")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", body.org_id)
      .single();
    tracer.endSpan(membershipSpanId, memberError ? "error" : "ok");

    if (memberError || !membership) {
      logger.warn("Org membership check failed", { userId: user.id, orgId: body.org_id });
      const response = forbiddenResponse("User not authorized for this organization");
      logResponse(403);
      return response;
    }

    // Verify asset exists and belongs to org
    const assetSpanId = tracer.startSpan("db.check_asset");
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id, name, type, org_id")
      .eq("id", body.asset_id)
      .eq("org_id", body.org_id)
      .single();
    tracer.endSpan(assetSpanId, assetError ? "error" : "ok");

    if (assetError || !asset) {
      logger.warn("Asset not found", { assetId: body.asset_id, orgId: body.org_id });
      const response = notFoundResponse("Asset not found or not authorized");
      logResponse(404);
      return response;
    }

    // If campaign_id provided, verify it belongs to org
    if (body.campaign_id) {
      const campaignSpanId = tracer.startSpan("db.check_campaign");
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", body.campaign_id)
        .eq("org_id", body.org_id)
        .single();
      tracer.endSpan(campaignSpanId, campaignError ? "error" : "ok");

      if (campaignError || !campaign) {
        logger.warn("Campaign not found", { campaignId: body.campaign_id, orgId: body.org_id });
        const response = notFoundResponse("Campaign not found or not authorized");
        logResponse(404);
        return response;
      }
    }

    // Check idempotency
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const idempotencySpanId = tracer.startSpan("db.check_idempotency");
      const { data: existing } = await supabase
        .from("schedules")
        .select("*")
        .eq("org_id", body.org_id)
        .eq("asset_id", body.asset_id)
        .eq("platform", body.platform)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      tracer.endSpan(idempotencySpanId, "ok");

      if (existing) {
        logger.info("Returning cached schedule for idempotency", { scheduleId: existing.id });
        const response = successResponse(existing, { "X-Idempotent-Replay": "true" });
        logResponse(200);
        return response;
      }
    }

    // Create schedule
    const insertSpanId = tracer.startSpan("db.insert_schedule");
    const { data: schedule, error: insertError } = await supabase
      .from("schedules")
      .insert({
        org_id: body.org_id,
        asset_id: body.asset_id,
        campaign_id: body.campaign_id || null,
        platform: body.platform.toLowerCase(),
        scheduled_at: body.scheduled_at,
        status: "pending",
        retries: 0,
        result: null,
      })
      .select()
      .single();

    if (insertError) {
      tracer.endSpan(insertSpanId, "error", insertError);
      throw insertError;
    }
    tracer.endSpan(insertSpanId, "ok");

    logger.info("Schedule created", { 
      scheduleId: schedule.id, 
      platform: body.platform, 
      scheduledAt: body.scheduled_at 
    });
    metrics.counter("schedule.created", 1, { platform: body.platform.toLowerCase() });

    const response = createdResponse(schedule, { "X-Request-Id": requestId });
    logResponse(201);
    return response;

  } catch (error) {
    const err = error as Error;
    logger.error("Schedule function error", err);
    reportError(err, { requestId, function: FUNCTION_NAME });
    metrics.counter("error.unhandled", 1, { function: FUNCTION_NAME });
    
    const response = errorResponse(err.message || "Internal server error", 500);
    logResponse(500);
    return response;
  }
});
