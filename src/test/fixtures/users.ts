/**
 * User test fixtures
 * Reusable mock data for user-related tests
 */

import type { User, Session } from '@supabase/supabase-js';

/**
 * Mock user factory
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? 'user-123-test';
  return {
    id,
    app_metadata: {},
    user_metadata: {
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
    email: 'test@example.com',
    email_confirmed_at: '2024-01-01T00:00:00.000Z',
    phone: null,
    confirmed_at: '2024-01-01T00:00:00.000Z',
    last_sign_in_at: '2024-01-15T00:00:00.000Z',
    role: 'authenticated',
    ...overrides,
  };
}

/**
 * Mock session factory
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  const user = createMockUser(overrides.user);
  return {
    access_token: 'mock-access-token-xyz',
    refresh_token: 'mock-refresh-token-xyz',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
    ...overrides,
  };
}

/**
 * Predefined user fixtures
 */
export const users = {
  /** Standard authenticated user */
  authenticated: createMockUser({
    id: 'user-auth-001',
    email: 'authenticated@example.com',
    user_metadata: { full_name: 'Auth User' },
  }),

  /** Admin user with elevated privileges */
  admin: createMockUser({
    id: 'user-admin-001',
    email: 'admin@example.com',
    user_metadata: { full_name: 'Admin User', role: 'admin' },
  }),

  /** Organization owner */
  owner: createMockUser({
    id: 'user-owner-001',
    email: 'owner@example.com',
    user_metadata: { full_name: 'Owner User' },
  }),

  /** New user without completed onboarding */
  newUser: createMockUser({
    id: 'user-new-001',
    email: 'newuser@example.com',
    user_metadata: { full_name: 'New User', onboarding_completed: false },
  }),

  /** User with unverified email */
  unverified: createMockUser({
    id: 'user-unverified-001',
    email: 'unverified@example.com',
    email_confirmed_at: undefined,
    confirmed_at: undefined,
  }),
};

/**
 * Predefined session fixtures
 */
export const sessions = {
  /** Valid session with standard user */
  valid: createMockSession({ user: users.authenticated }),

  /** Admin session */
  admin: createMockSession({ user: users.admin }),

  /** Owner session */
  owner: createMockSession({ user: users.owner }),

  /** Expired session */
  expired: createMockSession({
    user: users.authenticated,
    expires_at: Math.floor(Date.now() / 1000) - 3600,
  }),
};

/**
 * Organization membership fixtures
 */
export interface MockMembership {
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'member' | 'viewer';
  created_at: string;
}

export function createMockMembership(
  overrides: Partial<MockMembership> = {}
): MockMembership {
  return {
    org_id: 'org-test-001',
    user_id: 'user-123-test',
    role: 'member',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const memberships = {
  owner: createMockMembership({ role: 'owner', user_id: users.owner.id }),
  admin: createMockMembership({ role: 'admin', user_id: users.admin.id }),
  member: createMockMembership({ role: 'member', user_id: users.authenticated.id }),
  viewer: createMockMembership({ role: 'viewer' }),
};
