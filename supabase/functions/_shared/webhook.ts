/**
 * Webhook notification utilities for admin alerts
 * Supports configurable webhook endpoints for integration failures, security events, etc.
 */

import { Logger } from './observability.ts';

interface WebhookPayload {
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  source: string;
}

interface WebhookResult {
  success: boolean;
  error?: string;
  statusCode?: number;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  accessory?: { type: string; text?: { type: string; text: string }; url?: string };
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  [key: string]: unknown;
}

const SEVERITY_EMOJI: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨',
  critical: '🔥',
};

const SEVERITY_COLOR: Record<string, string> = {
  info: '#36a64f',
  warning: '#ff9800',
  error: '#dc3545',
  critical: '#c41e3a',
};

/**
 * Formats payload for Slack webhook
 */
function formatSlackPayload(payload: WebhookPayload): SlackMessage {
  const emoji = SEVERITY_EMOJI[payload.severity] || '📢';
  const color = SEVERITY_COLOR[payload.severity] || '#808080';
  
  const blocks: SlackMessage['blocks'] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${payload.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: payload.message,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Event Type:*\n${payload.event_type}`,
        },
        {
          type: 'mrkdwn',
          text: `*Severity:*\n${payload.severity.toUpperCase()}`,
        },
        {
          type: 'mrkdwn',
          text: `*Source:*\n${payload.source}`,
        },
        {
          type: 'mrkdwn',
          text: `*Time:*\n${new Date(payload.timestamp).toLocaleString()}`,
        },
      ],
    },
  ];
  
  // Add details if present
  if (payload.details && Object.keys(payload.details).length > 0) {
    const detailsText = Object.entries(payload.details)
      .map(([key, value]) => `• *${key}:* ${JSON.stringify(value)}`)
      .join('\n');
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Details:*\n${detailsText}`,
      },
    });
  }
  
  return {
    text: `${emoji} ${payload.title}: ${payload.message}`,
    blocks,
  };
}

/**
 * Formats payload for Discord webhook
 */
function formatDiscordPayload(payload: WebhookPayload): Record<string, unknown> {
  const emoji = SEVERITY_EMOJI[payload.severity] || '📢';
  const color = parseInt(SEVERITY_COLOR[payload.severity]?.replace('#', '') || '808080', 16);
  
  return {
    content: `${emoji} **${payload.title}**`,
    embeds: [
      {
        title: payload.title,
        description: payload.message,
        color: color,
        fields: [
          { name: 'Event Type', value: payload.event_type, inline: true },
          { name: 'Severity', value: payload.severity.toUpperCase(), inline: true },
          { name: 'Source', value: payload.source, inline: true },
          ...(payload.details ? [{ 
            name: 'Details', 
            value: '```json\n' + JSON.stringify(payload.details, null, 2).slice(0, 1000) + '\n```',
            inline: false 
          }] : []),
        ],
        timestamp: payload.timestamp,
      },
    ],
  };
}

/**
 * Formats payload for generic webhook (JSON)
 */
function formatGenericPayload(payload: WebhookPayload): Record<string, unknown> {
  return {
    ...payload,
    formatted_time: new Date(payload.timestamp).toISOString(),
  };
}

/**
 * Sends a webhook notification to the configured endpoint
 */
export async function sendWebhookNotification(
  payload: Omit<WebhookPayload, 'timestamp'>,
  logger?: Logger
): Promise<WebhookResult> {
  const webhookUrl = Deno.env.get('ADMIN_WEBHOOK_URL');
  const webhookType = Deno.env.get('ADMIN_WEBHOOK_TYPE') || 'generic';
  
  if (!webhookUrl) {
    logger?.warn('No ADMIN_WEBHOOK_URL configured, skipping notification');
    return { success: false, error: 'Webhook URL not configured' };
  }
  
  const fullPayload: WebhookPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };
  
  // Format based on webhook type
  let formattedPayload: Record<string, unknown>;
  switch (webhookType.toLowerCase()) {
    case 'slack':
      formattedPayload = formatSlackPayload(fullPayload);
      break;
    case 'discord':
      formattedPayload = formatDiscordPayload(fullPayload);
      break;
    default:
      formattedPayload = formatGenericPayload(fullPayload);
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formattedPayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger?.error('Webhook notification failed', undefined, { 
        status: response.status, 
        body: errorText.slice(0, 200) 
      });
      return { 
        success: false, 
        error: `HTTP ${response.status}`, 
        statusCode: response.status 
      };
    }
    
    logger?.info('Webhook notification sent', { 
      event: payload.event_type, 
      severity: payload.severity 
    });
    
    return { success: true, statusCode: response.status };
    
  } catch (error) {
    logger?.error('Webhook request failed', error as Error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
}

/**
 * Sends alert for token refresh failure
 */
export async function notifyTokenRefreshFailure(
  provider: string,
  orgId: string,
  error: string,
  logger?: Logger
): Promise<WebhookResult> {
  return sendWebhookNotification({
    event_type: 'integration.token_refresh_failed',
    severity: 'error',
    title: `Integration Token Refresh Failed: ${provider}`,
    message: `The OAuth token for ${provider} integration failed to refresh and requires re-authentication.`,
    details: {
      provider,
      org_id: orgId.slice(0, 8) + '...',
      error,
      action_required: 'User needs to re-authenticate the integration',
    },
    source: 'integrations-refresh',
  }, logger);
}

/**
 * Sends alert for multiple token refresh failures
 */
export async function notifyBatchTokenRefreshFailure(
  failures: Array<{ provider: string; org_id: string; error: string }>,
  logger?: Logger
): Promise<WebhookResult> {
  if (failures.length === 0) {
    return { success: true };
  }
  
  const providers = [...new Set(failures.map(f => f.provider))];
  const affectedOrgs = [...new Set(failures.map(f => f.org_id))].length;
  
  return sendWebhookNotification({
    event_type: 'integration.batch_token_refresh_failed',
    severity: failures.length >= 5 ? 'critical' : 'error',
    title: `${failures.length} Integration Token Refresh(es) Failed`,
    message: `Multiple integration tokens failed to refresh. Affected providers: ${providers.join(', ')}`,
    details: {
      total_failures: failures.length,
      affected_orgs: affectedOrgs,
      providers: providers,
      failures: failures.slice(0, 10).map(f => ({
        provider: f.provider,
        org_id: f.org_id.slice(0, 8) + '...',
        error: f.error.slice(0, 100),
      })),
    },
    source: 'integrations-refresh',
  }, logger);
}

/**
 * Sends alert for security events
 */
export async function notifySecurityEvent(
  eventType: string,
  title: string,
  message: string,
  details: Record<string, unknown>,
  logger?: Logger
): Promise<WebhookResult> {
  return sendWebhookNotification({
    event_type: `security.${eventType}`,
    severity: 'warning',
    title,
    message,
    details,
    source: 'security-monitor',
  }, logger);
}

/**
 * Sends alert for rate limit violations
 */
export async function notifyRateLimitViolation(
  userId: string,
  endpoint: string,
  attempts: number,
  logger?: Logger
): Promise<WebhookResult> {
  return sendWebhookNotification({
    event_type: 'security.rate_limit_violation',
    severity: attempts >= 100 ? 'critical' : 'warning',
    title: 'Rate Limit Violation Detected',
    message: `Excessive rate limit violations detected for endpoint: ${endpoint}`,
    details: {
      user_id: userId.slice(0, 8) + '...',
      endpoint,
      attempts,
      threshold_exceeded: true,
    },
    source: 'rate-limiter',
  }, logger);
}
