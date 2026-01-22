/**
 * Campaign test fixtures
 * Reusable mock data for campaigns
 */

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';
export type Platform = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';

export interface MockCampaign {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  platforms: Platform[];
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  goals: Record<string, unknown>;
  segment_ids: string[];
  asset_ids: string[];
  metrics: Record<string, number>;
  created_at: string;
  updated_at: string;
}

/**
 * Mock campaign factory
 */
export function createMockCampaign(overrides: Partial<MockCampaign> = {}): MockCampaign {
  const id = overrides.id ?? `campaign-${Date.now()}`;
  return {
    id,
    org_id: 'org-test-001',
    user_id: 'user-123-test',
    name: 'Test Campaign',
    description: 'A test campaign for unit testing',
    status: 'draft',
    platforms: ['instagram', 'facebook'],
    start_date: '2024-02-01T00:00:00.000Z',
    end_date: '2024-02-28T23:59:59.000Z',
    budget: 5000,
    goals: {
      reach: 100000,
      engagement: 5000,
      conversions: 500,
    },
    segment_ids: ['segment-001', 'segment-002'],
    asset_ids: ['asset-001', 'asset-002', 'asset-003'],
    metrics: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
    },
    created_at: '2024-01-15T10:00:00.000Z',
    updated_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * Predefined campaign fixtures
 */
export const campaigns = {
  /** Draft campaign */
  draft: createMockCampaign({
    id: 'campaign-draft-001',
    name: 'New Product Launch',
    status: 'draft',
    description: 'Launching our new product line',
  }),

  /** Scheduled campaign */
  scheduled: createMockCampaign({
    id: 'campaign-sched-001',
    name: 'Holiday Sale',
    status: 'scheduled',
    start_date: '2024-12-20T00:00:00.000Z',
    end_date: '2024-12-31T23:59:59.000Z',
    platforms: ['instagram', 'facebook', 'twitter'],
  }),

  /** Active campaign with metrics */
  active: createMockCampaign({
    id: 'campaign-active-001',
    name: 'Summer Promotion',
    status: 'active',
    start_date: '2024-06-01T00:00:00.000Z',
    end_date: '2024-08-31T23:59:59.000Z',
    budget: 10000,
    metrics: {
      impressions: 250000,
      clicks: 12500,
      conversions: 1250,
      spend: 4500,
    },
  }),

  /** Paused campaign */
  paused: createMockCampaign({
    id: 'campaign-paused-001',
    name: 'Paused Campaign',
    status: 'paused',
    metrics: {
      impressions: 50000,
      clicks: 2500,
      conversions: 250,
      spend: 1500,
    },
  }),

  /** Completed campaign */
  completed: createMockCampaign({
    id: 'campaign-complete-001',
    name: 'Q1 Brand Awareness',
    status: 'completed',
    start_date: '2024-01-01T00:00:00.000Z',
    end_date: '2024-03-31T23:59:59.000Z',
    budget: 15000,
    metrics: {
      impressions: 500000,
      clicks: 25000,
      conversions: 2500,
      spend: 14850,
    },
  }),

  /** Multi-platform campaign */
  multiPlatform: createMockCampaign({
    id: 'campaign-multi-001',
    name: 'Cross-Platform Campaign',
    platforms: ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok'],
    status: 'active',
  }),

  /** Single platform campaign */
  singlePlatform: createMockCampaign({
    id: 'campaign-single-001',
    name: 'TikTok Only Campaign',
    platforms: ['tiktok'],
    status: 'active',
  }),
};

/**
 * Create a batch of campaigns for list testing
 */
export function createMockCampaignList(count: number = 10): MockCampaign[] {
  const statuses: CampaignStatus[] = ['draft', 'scheduled', 'active', 'completed'];
  return Array.from({ length: count }, (_, i) =>
    createMockCampaign({
      id: `campaign-list-${i + 1}`,
      name: `Campaign ${i + 1}`,
      status: statuses[i % statuses.length],
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    })
  );
}

/**
 * Segment fixtures for campaign targeting
 */
export interface MockSegment {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  estimated_reach: number;
  created_at: string;
}

export function createMockSegment(overrides: Partial<MockSegment> = {}): MockSegment {
  return {
    id: 'segment-test-001',
    org_id: 'org-test-001',
    name: 'Test Segment',
    description: 'A test audience segment',
    criteria: {
      age: { min: 25, max: 45 },
      interests: ['technology', 'innovation'],
      location: ['US', 'CA', 'UK'],
    },
    estimated_reach: 50000,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export const segments = {
  youngAdults: createMockSegment({
    id: 'segment-young-001',
    name: 'Young Adults',
    criteria: { age: { min: 18, max: 30 } },
    estimated_reach: 75000,
  }),
  professionals: createMockSegment({
    id: 'segment-pro-001',
    name: 'Working Professionals',
    criteria: { age: { min: 25, max: 55 }, interests: ['business', 'career'] },
    estimated_reach: 45000,
  }),
  global: createMockSegment({
    id: 'segment-global-001',
    name: 'Global Audience',
    criteria: {},
    estimated_reach: 500000,
  }),
};
