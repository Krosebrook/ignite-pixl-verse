import { supabase } from "@/integrations/supabase/client";

interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: string;
  deviceName: string;
}

export function parseUserAgent(): DeviceInfo {
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';
  
  const deviceName = `${browser} on ${os}`;
  
  return { browser, os, deviceType, deviceName };
}

export type SecurityEventType = 
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'passkey_added'
  | 'passkey_removed'
  | 'session_revoked'
  | 'account_locked'
  | 'account_unlocked'
  | 'suspicious_activity'
  | 'email_verification';

export type SecurityEventCategory = 'security' | 'auth' | 'account';

interface LogSecurityEventParams {
  userId: string;
  eventType: SecurityEventType;
  eventCategory?: SecurityEventCategory;
  success?: boolean;
  failureReason?: string;
  riskScore?: number;
  metadata?: Record<string, unknown>;
}

export async function logSecurityEvent({
  userId,
  eventType,
  eventCategory = 'security',
  success = true,
  failureReason,
  riskScore = 0,
  metadata = {},
}: LogSecurityEventParams): Promise<boolean> {
  try {
    const deviceInfo = parseUserAgent();
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/security-activity/log`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          user_id: userId,
          event_type: eventType,
          event_category: eventCategory,
          user_agent: navigator.userAgent,
          device_type: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          success,
          failure_reason: failureReason,
          risk_score: riskScore,
          metadata: {
            ...metadata,
            device_name: deviceInfo.deviceName,
          },
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Failed to log security event:', error);
    return false;
  }
}

interface CheckIpRateLimitResult {
  allowed: boolean;
  remaining: number;
  blocked_until: string | null;
  attempt_count: number;
  block_reason?: string;
}

export async function checkIpRateLimit(
  ipAddress: string,
  action: string,
  maxAttempts: number = 10,
  windowMinutes: number = 15,
  blockMinutes: number = 30
): Promise<CheckIpRateLimitResult> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/security-activity/check-ip-limit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          ip_address: ipAddress,
          action,
          max_attempts: maxAttempts,
          window_minutes: windowMinutes,
          block_minutes: blockMinutes,
        }),
      }
    );

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to check IP rate limit:', error);
    // Fail open to not block legitimate users
    return {
      allowed: true,
      remaining: maxAttempts,
      blocked_until: null,
      attempt_count: 0,
    };
  }
}

export async function resetIpRateLimit(
  ipAddress: string,
  action: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/security-activity/reset-ip-limit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          ip_address: ipAddress,
          action,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Failed to reset IP rate limit:', error);
    return false;
  }
}

// Helper to calculate risk score based on various factors
export function calculateRiskScore(factors: {
  isNewDevice?: boolean;
  failedAttempts?: number;
  isSuspiciousLocation?: boolean;
  isUnusualTime?: boolean;
  hasRecentPasswordReset?: boolean;
}): number {
  let score = 0;
  
  if (factors.isNewDevice) score += 20;
  if (factors.failedAttempts) score += Math.min(factors.failedAttempts * 10, 40);
  if (factors.isSuspiciousLocation) score += 30;
  if (factors.isUnusualTime) score += 10;
  if (factors.hasRecentPasswordReset) score += 15;
  
  return Math.min(score, 100);
}
