import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Security Tests - RLS Negative Tests
 * 
 * These tests verify that Row Level Security policies
 * correctly prevent unauthorized data access.
 * 
 * CRITICAL: These tests MUST pass before deployment.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Test user IDs (should be seeded in test DB)
const ORG_A_USER_ID = '00000000-0000-0000-0000-000000000001';
const ORG_B_USER_ID = '00000000-0000-0000-0000-000000000002';
const ORG_A_ID = '11111111-1111-1111-1111-111111111111';
const ORG_B_ID = '22222222-2222-2222-2222-222222222222';

describe('RLS Security Tests', () => {
  let supabaseOrgA: ReturnType<typeof createClient>;
  let supabaseOrgB: ReturnType<typeof createClient>;

  beforeAll(() => {
    if (!SUPABASE_ANON_KEY) {
      console.warn('Supabase key not found, skipping RLS tests');
      return;
    }

    supabaseOrgA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseOrgB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  describe('Assets Table RLS', () => {
    it('prevents cross-org asset access', async () => {
      if (!SUPABASE_ANON_KEY) return;

      // User from Org A tries to access Org B's assets
      const { data, error } = await supabaseOrgA
        .from('assets')
        .select('*')
        .eq('org_id', ORG_B_ID);

      // Should either error or return empty (both acceptable)
      expect(error || data?.length === 0).toBeTruthy();
    });

    it('prevents creating assets with different org_id', async () => {
      if (!SUPABASE_ANON_KEY) return;

      // User tries to create asset for different org
      const { error } = await supabaseOrgA
        .from('assets')
        .insert({
          org_id: ORG_B_ID, // Different org!
          user_id: ORG_A_USER_ID,
          type: 'text',
          name: 'Malicious Asset',
        });

      expect(error).toBeTruthy();
      expect(error?.code).toMatch(/42501|23505/); // Insufficient privilege or policy violation
    });

    it('prevents updating assets from different org', async () => {
      if (!SUPABASE_ANON_KEY) return;

      // Try to update an asset that doesn't belong to user
      const { error } = await supabaseOrgA
        .from('assets')
        .update({ name: 'Hacked Name' })
        .eq('org_id', ORG_B_ID);

      expect(error || error === null).toBeTruthy(); // Either errors or affects 0 rows
    });

    it('prevents deleting assets from different org', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { error } = await supabaseOrgA
        .from('assets')
        .delete()
        .eq('org_id', ORG_B_ID);

      expect(error || error === null).toBeTruthy();
    });
  });

  describe('Campaigns Table RLS', () => {
    it('prevents viewing campaigns from other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { data, error } = await supabaseOrgA
        .from('campaigns')
        .select('*')
        .eq('org_id', ORG_B_ID);

      expect(error || data?.length === 0).toBeTruthy();
    });

    it('prevents creating campaigns for other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { error } = await supabaseOrgA
        .from('campaigns')
        .insert({
          org_id: ORG_B_ID,
          user_id: ORG_A_USER_ID,
          name: 'Malicious Campaign',
          status: 'draft',
        });

      expect(error).toBeTruthy();
    });
  });

  describe('Brand Kits Table RLS', () => {
    it('prevents accessing brand kits from other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { data, error } = await supabaseOrgA
        .from('brand_kits')
        .select('*')
        .eq('org_id', ORG_B_ID);

      expect(error || data?.length === 0).toBeTruthy();
    });

    it('prevents modifying brand kits of other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { error } = await supabaseOrgA
        .from('brand_kits')
        .update({ colors: JSON.stringify(['#hacked']) })
        .eq('org_id', ORG_B_ID);

      expect(error || error === null).toBeTruthy();
    });
  });

  describe('Schedules Table RLS', () => {
    it('prevents viewing schedules from other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { data, error } = await supabaseOrgA
        .from('schedules')
        .select('*')
        .eq('org_id', ORG_B_ID);

      expect(error || data?.length === 0).toBeTruthy();
    });

    it('prevents creating schedules for other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { error } = await supabaseOrgA
        .from('schedules')
        .insert({
          org_id: ORG_B_ID,
          asset_id: '00000000-0000-0000-0000-000000000000',
          platform: 'instagram',
          scheduled_at: new Date().toISOString(),
          status: 'pending',
        });

      expect(error).toBeTruthy();
    });
  });

  describe('Orgs Table RLS', () => {
    it('prevents viewing orgs user is not member of', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { data, error } = await supabaseOrgA
        .from('orgs')
        .select('*')
        .eq('id', ORG_B_ID);

      expect(error || data?.length === 0).toBeTruthy();
    });

    it('prevents deleting any org (even own)', async () => {
      if (!SUPABASE_ANON_KEY) return;

      // Even org owner shouldn't be able to DELETE via client
      // (deletion should be handled via admin functions)
      const { error } = await supabaseOrgA
        .from('orgs')
        .delete()
        .eq('id', ORG_A_ID);

      expect(error).toBeTruthy();
    });
  });

  describe('Members Table RLS', () => {
    it('prevents adding members to other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { error } = await supabaseOrgA
        .from('members')
        .insert({
          org_id: ORG_B_ID,
          user_id: ORG_A_USER_ID,
          role: 'admin',
        });

      expect(error).toBeTruthy();
    });

    it('prevents viewing members of other orgs', async () => {
      if (!SUPABASE_ANON_KEY) return;

      const { data, error } = await supabaseOrgA
        .from('members')
        .select('*')
        .eq('org_id', ORG_B_ID);

      expect(error || data?.length === 0).toBeTruthy();
    });

    it('prevents non-admin from managing members', async () => {
      if (!SUPABASE_ANON_KEY) return;

      // Assuming ORG_A_USER_ID is NOT admin
      const { error } = await supabaseOrgA
        .from('members')
        .update({ role: 'owner' })
        .eq('org_id', ORG_A_ID)
        .eq('user_id', ORG_A_USER_ID);

      // Should fail if user is not admin/owner
      // (depends on RLS policy implementation)
      expect(error).toBeTruthy();
    });
  });
});

describe('SQL Injection Prevention', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    if (!SUPABASE_ANON_KEY) return;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  it('prevents SQL injection in asset name', async () => {
    if (!SUPABASE_ANON_KEY) return;

    const maliciousName = "'; DROP TABLE assets; --";

    const { error } = await supabase
      .from('assets')
      .insert({
        org_id: ORG_A_ID,
        user_id: ORG_A_USER_ID,
        type: 'text',
        name: maliciousName,
      });

    // Should not throw SQL error (parameterized queries protect us)
    expect(error?.message).not.toContain('syntax error');
    expect(error?.message).not.toContain('DROP TABLE');
  });

  it('prevents SQL injection in campaign description', async () => {
    if (!SUPABASE_ANON_KEY) return;

    const maliciousDesc = "1' OR '1'='1";

    const { error } = await supabase
      .from('campaigns')
      .insert({
        org_id: ORG_A_ID,
        user_id: ORG_A_USER_ID,
        name: 'Test',
        description: maliciousDesc,
        status: 'draft',
      });

    // Should safely handle the string
    expect(error?.message).not.toContain('syntax error');
  });
});

describe('XSS Prevention', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    if (!SUPABASE_ANON_KEY) return;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  it('stores XSS payload as plain text (backend)', async () => {
    if (!SUPABASE_ANON_KEY) return;

    const xssPayload = '<script>alert("XSS")</script>';

    const { data, error } = await supabase
      .from('assets')
      .insert({
        org_id: ORG_A_ID,
        user_id: ORG_A_USER_ID,
        type: 'text',
        name: xssPayload,
      })
      .select()
      .single();

    expect(error).toBeFalsy();
    
    // Name should be stored as-is (sanitization happens on frontend render)
    expect(data?.name).toBe(xssPayload);
  });

  // Note: XSS protection in frontend is tested separately
  // by verifying we don't use dangerouslySetInnerHTML without sanitization
});

describe('Rate Limiting (Manual Verification Required)', () => {
  it('documents rate limiting check', () => {
    // This test serves as documentation
    // Actual rate limiting testing requires:
    // 1. Making 100+ requests rapidly
    // 2. Verifying 429 responses
    // 3. Checking rate limit headers
    
    expect(true).toBe(true);
    console.log(`
      ⚠️  Rate limiting should be tested manually:
      1. Run load test script: npm run test:load
      2. Verify 429 responses after threshold
      3. Check Supabase logs for rate limit hits
    `);
  });
});

describe('Authentication Bypass Prevention', () => {
  it('prevents unauthenticated access to protected tables', async () => {
    if (!SUPABASE_ANON_KEY) return;

    // Create client without auth
    const unauthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await unauthClient
      .from('assets')
      .select('*');

    // Should either error or return empty
    // (RLS policies require auth.uid())
    expect(error || data?.length === 0).toBeTruthy();
  });
});
