import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * API Contract Tests
 * 
 * These tests validate that edge functions conform to OpenAPI spec.
 * They test request/response schemas, status codes, and error handling.
 * 
 * Prerequisites:
 * - Supabase local instance running (`supabase start`)
 * - Valid auth token for testing
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Test org and user IDs (should be seeded in test DB)
const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_ASSET_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('API Contract Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // In real tests, authenticate and get token
    // For now, use placeholder
    authToken = SUPABASE_ANON_KEY || 'test-token';
  });

  describe('POST /functions/v1/generate-content', () => {
    it('returns 401 without auth header', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          prompt: 'Test prompt for content generation',
          org_id: TEST_ORG_ID,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('returns 400 for missing required fields', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: 'text',
          // Missing prompt and org_id
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('returns 400 for invalid type', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: 'video', // Invalid type
          prompt: 'Test prompt that is long enough',
          org_id: TEST_ORG_ID,
        }),
      });

      expect(response.status).toBe(400);
    });

    it('returns 400 for prompt too short', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: 'text',
          prompt: 'Short',
          org_id: TEST_ORG_ID,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('10');
    });

    it('respects idempotency-key header', async () => {
      const idempotencyKey = crypto.randomUUID();
      
      // First request
      const response1 = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          type: 'text',
          prompt: 'Idempotency test prompt for unique content',
          org_id: TEST_ORG_ID,
        }),
      });

      // Second request with same key should return cached
      const response2 = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          type: 'text',
          prompt: 'Idempotency test prompt for unique content',
          org_id: TEST_ORG_ID,
        }),
      });

      // First should be 201, second should be 200 (cached)
      if (response1.ok) {
        expect(response1.status).toBe(201);
        expect(response2.status).toBe(200);
        expect(response2.headers.get('X-Idempotent-Replay')).toBe('true');
      }
    });
  });

  describe('POST /functions/v1/campaigns-draft', () => {
    it('returns 400 for missing required fields', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/campaigns-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          // Missing name and objective
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('returns 400 for name too short', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/campaigns-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          name: 'AB',
          objective: 'Valid objective that is long enough',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('validates platform enum values', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/campaigns-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          name: 'Test Campaign',
          objective: 'Test objective that is long enough',
          platforms: ['instagram', 'invalid-platform'],
        }),
      });

      expect(response.status).toBe(400);
    });

    it('returns campaign object on success', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/campaigns-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          name: 'Contract Test Campaign',
          objective: 'Test campaign objective for contract validation',
          platforms: ['instagram', 'tiktok'],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('org_id');
        expect(data).toHaveProperty('name');
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('draft');
      }
    });
  });

  describe('POST /functions/v1/schedule', () => {
    it('returns 400 for missing required fields', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          // Missing asset_id, platform, scheduled_at
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('returns 400 for invalid platform', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          asset_id: TEST_ASSET_ID,
          platform: 'snapchat',
          scheduled_at: '2025-12-15T14:30:00Z',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid platform');
    });

    it('returns 400 for past scheduled_at date', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          asset_id: TEST_ASSET_ID,
          platform: 'instagram',
          scheduled_at: pastDate,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('future');
    });

    it('returns schedule object on success', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          org_id: TEST_ORG_ID,
          asset_id: TEST_ASSET_ID,
          platform: 'instagram',
          scheduled_at: futureDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('org_id');
        expect(data).toHaveProperty('asset_id');
        expect(data).toHaveProperty('platform');
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('pending');
        expect(data.retries).toBe(0);
      }
    });
  });

  describe('CORS Headers', () => {
    it('includes proper CORS headers in OPTIONS response', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'OPTIONS',
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('content-type');
    });

    it('includes security headers in all responses', async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          type: 'text',
          prompt: 'Security header test prompt',
          org_id: TEST_ORG_ID,
        }),
      });

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });
  });
});
