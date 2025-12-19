import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger, Tracer, metrics, reportError, trackRequest } from '../_shared/observability.ts';
import {
  corsPreflightResponse,
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  errorResponse,
  getAuthToken,
  getRequestId,
  parseJsonBody,
} from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/ratelimit.ts';

const FUNCTION_NAME = 'library-install';

interface InstallRequest {
  org_id: string;
  slug: string;
  version?: string;
}

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  const logger = new Logger(FUNCTION_NAME, { requestId });
  const tracer = new Tracer(requestId);
  const { logRequest, logResponse } = trackRequest(logger, req, FUNCTION_NAME);

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  logRequest();

  try {
    // Auth check
    const authToken = getAuthToken(req);
    if (!authToken) {
      logResponse(401);
      return unauthorizedResponse('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify JWT
    const authSpanId = tracer.startSpan('auth.verify');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);

    if (authError || !user) {
      tracer.endSpan(authSpanId, 'error');
      logger.warn('Authentication failed', { error: authError?.message });
      logResponse(401);
      return unauthorizedResponse('Invalid authentication token');
    }
    tracer.endSpan(authSpanId, 'ok');
    logger.info('User authenticated', { userId: user.id });

    // Rate limiting - 50 installs per hour
    const rateLimit = await checkRateLimit(user.id, 'library_install', 50, 3600000);
    if (!rateLimit.allowed) {
      logger.warn('Rate limit exceeded', { userId: user.id });
      logResponse(429);
      return errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Parse body
    const body = await parseJsonBody<InstallRequest>(req);
    if (!body) {
      logResponse(400);
      return badRequestResponse('Invalid JSON body');
    }

    const { org_id, slug, version } = body;

    // Validate required fields
    if (!org_id || !slug) {
      logResponse(400);
      return badRequestResponse('Missing required fields: org_id, slug');
    }

    // Verify user is member of org
    const memberSpanId = tracer.startSpan('db.check_membership');
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('org_id', org_id)
      .eq('user_id', user.id)
      .single();
    tracer.endSpan(memberSpanId, member ? 'ok' : 'error');

    if (!member) {
      logger.warn('User not member of organization', { userId: user.id, orgId: org_id });
      logResponse(403);
      return forbiddenResponse('Not a member of organization');
    }

    // Get library item
    const itemSpanId = tracer.startSpan('db.fetch_library_item');
    let query = supabase
      .from('library_items')
      .select('*')
      .eq('slug', slug);

    if (version) {
      query = query.eq('version', version);
    }

    const { data: item, error: itemError } = await query.single();
    tracer.endSpan(itemSpanId, itemError ? 'error' : 'ok');

    if (itemError || !item) {
      logger.warn('Library item not found', { slug, version });
      logResponse(404);
      return notFoundResponse('Library item not found');
    }

    // Check for existing installation
    const { data: existingInstall } = await supabase
      .from('library_installs')
      .select('*')
      .eq('org_id', org_id)
      .eq('item_id', item.id)
      .single();

    let backupSnapshot = null;

    if (existingInstall) {
      // Create backup of existing installation
      if (item.kind === 'template') {
        const { data: existingTemplates } = await supabase
          .from('templates')
          .select('*')
          .eq('org_id', org_id)
          .ilike('name', `%${item.name}%`);
        backupSnapshot = existingTemplates;
      }

      // Idempotent: if same version, do nothing
      if (existingInstall.version === item.version) {
        logger.info('Item already installed at same version', { slug, version: item.version });
        logResponse(200);
        return successResponse({
          success: true,
          message: 'Already installed',
          item_id: item.id,
          version: item.version,
        });
      }
    }

    // Install based on kind
    const installSpanId = tracer.startSpan('db.install_item', { kind: item.kind });

    if (item.kind === 'template') {
      const payload = item.payload as Record<string, unknown>;
      const templates = Array.isArray(payload.templates) ? payload.templates : [payload];

      for (const template of templates) {
        const tpl = template as Record<string, unknown>;
        await supabase
          .from('templates')
          .upsert({
            org_id,
            name: tpl.name as string,
            type: (tpl.type as string) || 'image',
            content: tpl.content,
            is_public: false,
            thumbnail_url: (tpl.thumbnail_url as string) || item.thumbnail_url,
          });
      }
    } else if (item.kind === 'assistant') {
      logger.info('Installing assistant configuration', { name: item.name });
    }

    tracer.endSpan(installSpanId, 'ok');

    // Record installation
    const { error: installError } = await supabase
      .from('library_installs')
      .upsert({
        org_id,
        item_id: item.id,
        version: item.version,
        installed_by: user.id,
        backup_snapshot: backupSnapshot,
        installed_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,item_id',
      });

    if (installError) {
      logger.error('Failed to record installation', installError);
      logResponse(500);
      return errorResponse('Failed to record installation', 500);
    }

    // Audit log
    await supabase.from('audit_log').insert({
      org_id,
      user_id: user.id,
      action: 'library_install',
      resource_type: 'library_item',
      resource_id: item.id,
      metadata: {
        slug: item.slug,
        version: item.version,
        kind: item.kind,
        had_backup: !!backupSnapshot,
        request_id: requestId,
      },
    });

    metrics.counter(`${FUNCTION_NAME}.success`);
    logger.info('Library item installed', { slug, version: item.version });
    logResponse(200);

    return successResponse({
      success: true,
      message: `Installed ${item.name} v${item.version}`,
      item_id: item.id,
      version: item.version,
      had_previous_version: !!existingInstall,
    });

  } catch (error) {
    logger.error('Library install error', error as Error);
    reportError(error as Error, { function: FUNCTION_NAME });
    metrics.counter(`${FUNCTION_NAME}.error`);
    logResponse(500);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
