/**
 * Asset test fixtures
 * Reusable mock data for content assets
 */

export type AssetType = 'image' | 'video' | 'audio' | 'text' | 'template';
export type AssetStatus = 'draft' | 'processing' | 'ready' | 'failed' | 'archived';

export interface MockAsset {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  url: string | null;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  provenance: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mock asset factory
 */
export function createMockAsset(overrides: Partial<MockAsset> = {}): MockAsset {
  const id = overrides.id ?? `asset-${Date.now()}`;
  return {
    id,
    org_id: 'org-test-001',
    user_id: 'user-123-test',
    name: 'Test Asset',
    type: 'image',
    status: 'ready',
    url: `https://storage.example.com/assets/${id}.jpg`,
    thumbnail_url: `https://storage.example.com/thumbnails/${id}.jpg`,
    file_size: 1024 * 500, // 500KB
    mime_type: 'image/jpeg',
    metadata: {
      width: 1920,
      height: 1080,
      format: 'jpeg',
    },
    provenance: {
      model: 'flux.schnell',
      provider: 'lovable-ai',
      prompt_hash: 'abc123',
      generated_at: new Date().toISOString(),
    },
    created_at: '2024-01-15T10:00:00.000Z',
    updated_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * Predefined asset fixtures
 */
export const assets = {
  /** Standard image asset */
  image: createMockAsset({
    id: 'asset-img-001',
    name: 'Product Hero Image',
    type: 'image',
    status: 'ready',
    mime_type: 'image/png',
    metadata: { width: 1200, height: 630, format: 'png' },
  }),

  /** Video asset */
  video: createMockAsset({
    id: 'asset-vid-001',
    name: 'Product Demo Video',
    type: 'video',
    status: 'ready',
    mime_type: 'video/mp4',
    file_size: 1024 * 1024 * 50, // 50MB
    metadata: { width: 1920, height: 1080, duration: 30, fps: 30 },
  }),

  /** Audio asset */
  audio: createMockAsset({
    id: 'asset-aud-001',
    name: 'Background Music',
    type: 'audio',
    status: 'ready',
    mime_type: 'audio/mpeg',
    file_size: 1024 * 1024 * 5, // 5MB
    metadata: { duration: 180, bitrate: 320 },
  }),

  /** Text/copy asset */
  text: createMockAsset({
    id: 'asset-txt-001',
    name: 'Campaign Copy',
    type: 'text',
    status: 'ready',
    url: null,
    thumbnail_url: null,
    file_size: null,
    mime_type: 'text/plain',
    metadata: { wordCount: 150, language: 'en' },
  }),

  /** Template asset */
  template: createMockAsset({
    id: 'asset-tpl-001',
    name: 'Instagram Carousel Template',
    type: 'template',
    status: 'ready',
    mime_type: 'application/json',
    metadata: { slides: 5, platform: 'instagram' },
  }),

  /** Processing asset */
  processing: createMockAsset({
    id: 'asset-proc-001',
    name: 'Rendering Video',
    type: 'video',
    status: 'processing',
    url: null,
    thumbnail_url: null,
  }),

  /** Failed asset */
  failed: createMockAsset({
    id: 'asset-fail-001',
    name: 'Failed Generation',
    type: 'image',
    status: 'failed',
    url: null,
    thumbnail_url: null,
    metadata: { error: 'Content policy violation' },
  }),

  /** Draft asset */
  draft: createMockAsset({
    id: 'asset-draft-001',
    name: 'Work in Progress',
    type: 'image',
    status: 'draft',
    url: null,
    thumbnail_url: null,
  }),
};

/**
 * Create a batch of assets for list testing
 */
export function createMockAssetList(count: number = 10): MockAsset[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAsset({
      id: `asset-list-${i + 1}`,
      name: `Asset ${i + 1}`,
      type: i % 3 === 0 ? 'video' : i % 2 === 0 ? 'text' : 'image',
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    })
  );
}
