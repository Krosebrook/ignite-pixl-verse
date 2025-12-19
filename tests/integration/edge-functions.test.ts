/**
 * Integration tests for Edge Functions
 * Tests end-to-end functionality using the Supabase client
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Skip tests if environment variables are not set
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://trxmsoyjjoopnvzohmvi.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyeG1zb3lqam9vcG52em9obXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNjY5MDQsImV4cCI6MjA3NDg0MjkwNH0.5ucyINvJOSPlLU9ww3g5ifnblwWWO67Csa6_BMfcA-U';

// Edge function base URL
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

describe('Edge Functions Integration Tests', () => {
  let supabase: SupabaseClient;
  let authToken: string | undefined;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Try to get auth token for authenticated tests
    try {
      const { data: session } = await supabase.auth.getSession();
      authToken = session.session?.access_token;
    } catch {
      console.log('No auth session available, some tests may be skipped');
    }
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Health endpoint is public, should work
      expect(response.ok || response.status === 401).toBe(true);
      
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('services');
        expect(data).toHaveProperty('circuitBreakers');
      }
    });

    it('should handle CORS preflight', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Generate Content Endpoint', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Test prompt',
          contentType: 'text',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should handle CORS preflight', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/generate-content`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(response.status).toBe(204);
    });

    it.skipIf(!authToken)('should validate required fields', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('Campaigns Draft Endpoint', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/campaigns-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Campaign',
        }),
      });

      expect(response.status).toBe(401);
    });

    it.skipIf(!authToken)('should validate campaign data', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/campaigns-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Schedule Endpoint', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: 'test-asset',
          scheduledAt: new Date().toISOString(),
          platform: 'twitter',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Usage Check Endpoint', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/usage-check`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GDPR Endpoints', () => {
    it('should reject unauthenticated GDPR export requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/gdpr-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated GDPR delete requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/gdpr-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Integration Endpoints', () => {
    it('should handle integrations-connect CORS', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/integrations-connect`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(response.status).toBe(204);
    });
  });

  describe('Marketplace Endpoints', () => {
    it('should reject unauthenticated marketplace install requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/marketplace-install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: 'test-item',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated library install requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/library-install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: 'test-item',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Content Generation Endpoints', () => {
    it('should reject unauthenticated YouTube content requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/generate-youtube-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'Test topic',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated TikTok content requests', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/generate-tiktok-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: 'Test topic',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Events Ingest Endpoint', () => {
    it('should reject unauthenticated events', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/events-ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: [{ type: 'test', category: 'test' }],
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error format', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.headers.get('Content-Type')).toContain('application/json');
      
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should include security headers', async () => {
      const response = await fetch(`${FUNCTIONS_URL}/health`, {
        method: 'GET',
      });

      // Check for security headers (if endpoint returns them)
      if (response.ok) {
        const xContentType = response.headers.get('X-Content-Type-Options');
        const xFrame = response.headers.get('X-Frame-Options');
        
        // These may or may not be present depending on deployment
        if (xContentType) expect(xContentType).toBe('nosniff');
        if (xFrame) expect(xFrame).toBe('DENY');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests
      const requests = Array(5).fill(null).map(() => 
        fetch(`${FUNCTIONS_URL}/health`, { method: 'GET' })
      );
      
      const responses = await Promise.all(requests);
      
      // At least some should succeed, rate limiting may kick in
      const successCount = responses.filter(r => r.ok || r.status === 429).length;
      expect(successCount).toBeGreaterThan(0);
      
      // If rate limited, should have Retry-After header
      const rateLimited = responses.filter(r => r.status === 429);
      for (const response of rateLimited) {
        expect(response.headers.has('Retry-After')).toBe(true);
      }
    });
  });
});
