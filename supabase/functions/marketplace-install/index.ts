import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, trackRequest, metrics } from '../_shared/observability.ts';
import { corsPreflightResponse, successResponse, errorResponse, getAuthToken } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const FUNCTION_NAME = 'marketplace-install';
const MAX_PACK_SIZE = 5 * 1024 * 1024; // 5MB

interface InstallRequest {
  packId: string;
  orgId: string;
  secrets?: Record<string, string>;
}

Deno.serve(async (req) => {
  const logger = new Logger(FUNCTION_NAME);
  const { logRequest, logResponse } = trackRequest(logger, req, FUNCTION_NAME);
  const requestId = logger.getRequestId();

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  logRequest();

  try {
    const { packId, orgId, secrets }: InstallRequest = await req.json();

    if (!packId || !orgId) {
      logResponse(400);
      return errorResponse('Missing packId or orgId', 400, requestId);
    }

    const authToken = getAuthToken(req);
    if (!authToken) {
      logResponse(401);
      return errorResponse('Missing authorization header', 401, requestId);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${authToken}` } },
    });

    // Fetch pack
    logger.info('Fetching pack', { packId });
    const { data: pack, error: packError } = await supabase
      .from('marketplace_items')
      .select('*')
      .eq('id', packId)
      .single();

    if (packError || !pack) {
      logger.warn('Pack not found', { packId });
      logResponse(404);
      return errorResponse('Pack not found', 404, requestId);
    }

    // Verify user
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      logResponse(401);
      return errorResponse('Unauthorized', 401, requestId);
    }

    const user = authData.user;

    // Rate limiting - 30 installs per hour
    const rateLimit = await checkRateLimit(user.id, 'marketplace_install', 30, 3600000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429, requestId);
    }

    // Verify org membership
    const { data: member } = await supabase
      .from('members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      logResponse(403);
      return errorResponse('Insufficient permissions', 403, requestId);
    }

    // Check pack size
    const packSize = JSON.stringify(pack.content).length;
    if (packSize > MAX_PACK_SIZE) {
      logResponse(413);
      return errorResponse(`Pack exceeds maximum size of 5MB`, 413, requestId);
    }

    // Check secrets for integrations
    const packContent = pack.content as Record<string, unknown>;
    if (pack.type === 'integration' && packContent.requiredSecrets) {
      const requiredSecrets = packContent.requiredSecrets as string[];
      const missingSecrets = requiredSecrets.filter((key: string) => !secrets?.[key]);
      if (missingSecrets.length > 0) {
        logResponse(200);
        return successResponse({ status: 'needs_config', requiredSecrets, message: `Please provide: ${missingSecrets.join(', ')}` });
      }
    }

    // Install based on type
    const installedResources: Record<string, string[]> = {};

    switch (pack.type) {
      case 'template': {
        const { data: template, error } = await supabase.from('templates').insert({
          org_id: orgId, name: pack.name, type: (packContent.type as string) || 'image',
          content: pack.content, thumbnail_url: pack.thumbnail_url, is_public: false,
        }).select().single();
        if (error) throw new Error(`Failed to install template: ${error.message}`);
        installedResources.templates = [template.id];
        break;
      }
      case 'preset': {
        const { data: brandKit, error } = await supabase.from('brand_kits').insert({
          org_id: orgId, name: pack.name, colors: (packContent.colors as unknown[]) || [],
          fonts: (packContent.fonts as unknown[]) || [], logo_url: (packContent.logoUrl as string) || null,
        }).select().single();
        if (error) throw new Error(`Failed to install preset: ${error.message}`);
        installedResources.presets = [brandKit.id];
        break;
      }
      case 'integration':
        installedResources.integrations = ['integration-' + packId];
        break;
      case 'workflow':
        installedResources.workflows = ['workflow-' + packId];
        break;
      default:
        logResponse(400);
        return errorResponse(`Unknown pack type: ${pack.type}`, 400, requestId);
    }

    metrics.counter(`${FUNCTION_NAME}.success`);
    logger.info('Pack installed', { packId, orgId });
    logResponse(200);

    return successResponse({ status: 'installed', installedResources, message: `${pack.name} installed successfully!` });

  } catch (error) {
    logger.error('Install error', error as Error);
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500, requestId);
  }
});
