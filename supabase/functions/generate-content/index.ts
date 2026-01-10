import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Import shared utilities
import { checkRateLimit } from "../_shared/ratelimit.ts";
import { CircuitBreaker } from "../_shared/circuit-breaker.ts";
import { withRetry, isRetryableError } from "../_shared/retry.ts";
import { Logger, Tracer, metrics, reportError, trackRequest } from "../_shared/observability.ts";
import {
  corsPreflightResponse,
  successResponse,
  createdResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  rateLimitResponse,
  serviceUnavailableResponse,
  errorResponse,
  getAuthToken,
  getIdempotencyKey,
  getRequestId,
  parseJsonBody,
  defaultHeaders,
} from "../_shared/http.ts";
import { validateInput, sanitizeForStorage, containsPromptInjection } from "../_shared/sanitize.ts";

const FUNCTION_NAME = "generate-content";

// Circuit breaker for AI API calls
const aiCircuitBreaker = new CircuitBreaker("lovable-ai", {
  failureThreshold: 3,
  resetTimeoutMs: 60000,
  successThreshold: 2,
});

interface GenerateRequest {
  type: "text" | "image";
  prompt: string;
  org_id: string;
  name?: string;
}

// Content safety validation patterns (legacy - still used as secondary check)
const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /forget\s+(everything|all|your|previous)/i,
  /you\s+are\s+now/i,
  /new\s+instructions/i,
  /disregard\s+(all|previous)/i,
];

function validatePrompt(prompt: string): { valid: boolean; error?: string; sanitized?: string } {
  // Use the new shared sanitization module for primary validation
  const validation = validateInput(prompt, {
    maxLength: 4000,
    minLength: 10,
    checkPromptInjection: true,
    checkXss: true,
    fieldName: 'Prompt'
  });
  
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }
  
  // Secondary check with legacy patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return { valid: false, error: "Prompt contains potentially unsafe content" };
    }
  }
  
  return { valid: true, sanitized: sanitizeForStorage(prompt, 4000) };
}

async function generatePromptHash(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return `sha256:${hashArray.map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

serve(async (req) => {
  const requestId = getRequestId(req);
  const logger = new Logger(FUNCTION_NAME, { requestId });
  const tracer = new Tracer(requestId);
  const { logRequest, logResponse } = trackRequest(logger, req, FUNCTION_NAME);
  const startTime = performance.now();

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
    const body = await parseJsonBody<GenerateRequest>(req);
    if (!body) {
      const response = badRequestResponse("Invalid JSON body");
      logResponse(400);
      return response;
    }

    // Validate required fields
    if (!body.type || !body.prompt || !body.org_id) {
      const response = badRequestResponse("Missing required fields: type, prompt, org_id");
      logResponse(400);
      return response;
    }

    if (!["text", "image"].includes(body.type)) {
      const response = badRequestResponse("Invalid type. Must be 'text' or 'image'");
      logResponse(400);
      return response;
    }

    // Validate prompt using server-side sanitization
    const promptValidation = validatePrompt(body.prompt);
    if (!promptValidation.valid) {
      logger.warn("Prompt validation failed", { userId: user.id, error: promptValidation.error });
      const response = badRequestResponse(promptValidation.error!, requestId);
      logResponse(400);
      return response;
    }
    
    // Use sanitized prompt for all operations
    const sanitizedPrompt = promptValidation.sanitized || sanitizeForStorage(body.prompt, 4000);
    const sanitizedName = body.name ? sanitizeForStorage(body.name, 200) : undefined;

    // Rate limiting
    const rateLimitSpanId = tracer.startSpan("ratelimit.check");
    const rateLimit = await checkRateLimit(user.id, "content_generation", 100, 3600000);
    tracer.endSpan(rateLimitSpanId, rateLimit.allowed ? "ok" : "error");

    if (!rateLimit.allowed) {
      logger.warn("Rate limit exceeded", { userId: user.id, resetAt: rateLimit.resetAt });
      metrics.counter("rate_limit.exceeded", 1, { function: FUNCTION_NAME });
      const response = rateLimitResponse("Rate limit exceeded. Please try again later.");
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

    // Check idempotency
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const idempotencySpanId = tracer.startSpan("db.check_idempotency");
      const { data: existing } = await supabase
        .from("assets")
        .select("*")
        .eq("org_id", body.org_id)
        .contains("metadata", { idempotency_key: idempotencyKey })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      tracer.endSpan(idempotencySpanId, "ok");

      if (existing) {
        logger.info("Returning cached asset for idempotency key", { idempotencyKey, assetId: existing.id });
        const response = successResponse(existing, { "X-Idempotent-Replay": "true" });
        logResponse(200);
        return response;
      }
    }

    // Check circuit breaker
    const circuitStatus = await aiCircuitBreaker.canExecute();
    if (!circuitStatus.allowed) {
      logger.warn("Circuit breaker open", { retryAfter: circuitStatus.retryAfter });
      metrics.counter("circuit_breaker.open", 1, { service: "lovable-ai" });
      const response = serviceUnavailableResponse(
        "AI service temporarily unavailable. Please try again later.",
        circuitStatus.retryAfter
      );
      logResponse(503);
      return response;
    }

    // Generate content with retry and circuit breaker
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const promptHash = await generatePromptHash(sanitizedPrompt);
    const timestamp = new Date().toISOString();
    const model = body.type === "text" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-image-preview";

    let contentData: Record<string, unknown> | null = null;
    let contentUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    const generateSpanId = tracer.startSpan("ai.generate", { type: body.type, model });
    
    try {
      const aiResponse = await withRetry(
        async () => {
          const requestBody = body.type === "text"
            ? {
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: "You are a professional content creator. Generate high-quality, engaging content based on user prompts. Be creative, concise, and compelling.",
                  },
                  { role: "user", content: sanitizedPrompt },
                ],
              }
            : {
                model: "google/gemini-2.5-flash-image-preview",
                messages: [{ role: "user", content: sanitizedPrompt }],
                modalities: ["image", "text"],
              };

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            logger.error("AI API error", new Error(errorText), { status: response.status });
            
            // Handle specific error codes
            if (response.status === 429) {
              const error = new Error("Rate limit exceeded");
              (error as any).status = 429;
              throw error;
            }
            if (response.status === 402) {
              const error = new Error("Payment required");
              (error as any).status = 402;
              throw error;
            }
            
            throw new Error(`AI API error: ${response.status} - ${errorText}`);
          }

          return response.json();
        },
        {
          maxRetries: 2,
          baseDelayMs: 1000,
          retryableErrors: (error) => isRetryableError(error) || (error as any).status === 429,
          onRetry: (attempt, error, delay) => {
            logger.warn("Retrying AI API call", { attempt, error: error.message, nextDelayMs: delay });
            metrics.counter("ai.retry", 1, { attempt: String(attempt) });
          },
        }
      );

      // Process response
      if (body.type === "text") {
        contentData = { text: aiResponse.choices[0]?.message?.content };
      } else {
        const imageUrl = aiResponse.choices[0]?.message?.images?.[0]?.image_url?.url;
        if (!imageUrl) {
          throw new Error("No image generated");
        }
        contentUrl = imageUrl;
        thumbnailUrl = imageUrl;
      }

      await aiCircuitBreaker.recordSuccess();
      tracer.endSpan(generateSpanId, "ok");
      metrics.counter("ai.success", 1, { type: body.type });
      
    } catch (error) {
      await aiCircuitBreaker.recordFailure(error as Error);
      tracer.endSpan(generateSpanId, "error", error as Error);
      metrics.counter("ai.failure", 1, { type: body.type });

      const err = error as any;
      if (err.status === 429) {
        const response = rateLimitResponse("AI rate limit exceeded, please try again later");
        logResponse(429);
        return response;
      }
      if (err.status === 402) {
        const response = errorResponse("Payment required, please add funds to your workspace", 402);
        logResponse(402);
        return response;
      }
      
      throw error;
    }

    // Create asset with sanitized data
    const insertSpanId = tracer.startSpan("db.insert_asset");
    const assetName = sanitizedName || `${body.type === "text" ? "Text" : "Image"} - ${new Date().toLocaleDateString()}`;
    
    const { data: asset, error: insertError } = await supabase
      .from("assets")
      .insert({
        org_id: body.org_id,
        user_id: user.id,
        type: body.type,
        name: assetName,
        content_url: contentUrl,
        content_data: contentData,
        thumbnail_url: thumbnailUrl,
        license: "all-rights-reserved",
        human_edited: false,
        provenance: {
          model,
          provider: "lovable-ai",
          prompt_hash: promptHash,
          timestamp,
          sanitized: true,
        },
        metadata: {
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          user_agent: req.headers.get("user-agent") || "unknown",
          prompt_length: sanitizedPrompt.length,
          request_id: requestId,
          sanitized: true,
        },
      })
      .select()
      .single();

    if (insertError) {
      tracer.endSpan(insertSpanId, "error", insertError);
      throw insertError;
    }
    
    tracer.endSpan(insertSpanId, "ok");
    logger.info("Asset created", { assetId: asset.id, type: body.type });
    metrics.counter("asset.created", 1, { type: body.type });

    const response = createdResponse(asset, { "X-Request-Id": requestId });
    logResponse(201);
    return response;

  } catch (error) {
    const err = error as Error;
    logger.error("Unhandled error", err);
    reportError(err, { requestId, function: FUNCTION_NAME });
    metrics.counter("error.unhandled", 1, { function: FUNCTION_NAME });
    
    const response = errorResponse(err.message || "Internal server error", 500);
    logResponse(500);
    return response;
  }
});
