/**
 * Test fixtures barrel export
 * Centralized access to all test mock data
 */

// User fixtures
export {
  createMockUser,
  createMockSession,
  createMockMembership,
  users,
  sessions,
  memberships,
  type MockMembership,
} from './users';

// Asset fixtures
export {
  createMockAsset,
  createMockAssetList,
  assets,
  type MockAsset,
  type AssetType,
  type AssetStatus,
} from './assets';

// Campaign fixtures
export {
  createMockCampaign,
  createMockCampaignList,
  createMockSegment,
  campaigns,
  segments,
  type MockCampaign,
  type MockSegment,
  type CampaignStatus,
  type Platform,
} from './campaigns';
