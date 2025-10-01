import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// API request validators matching OpenAPI spec
const generateContentSchema = z.object({
  type: z.enum(['text', 'image']),
  prompt: z.string().min(10).max(4000),
  org_id: z.string().uuid(),
  name: z.string().max(200).optional(),
});

const campaignDraftSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(3).max(200),
  objective: z.string().min(10).max(1000),
  platforms: z.array(z.enum(['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube'])).optional(),
  description: z.string().max(2000).optional(),
});

const scheduleSchema = z.object({
  org_id: z.string().uuid(),
  asset_id: z.string().uuid(),
  platform: z.enum(['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube']),
  scheduled_at: z.string().datetime(),
  campaign_id: z.string().uuid().optional(),
});

describe('API Request Validators', () => {
  describe('generateContentSchema', () => {
    it('validates correct text generation request', () => {
      const validRequest = {
        type: 'text' as const,
        prompt: 'Generate a compelling product description for eco-friendly water bottle',
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Product Description v1',
      };

      expect(() => generateContentSchema.parse(validRequest)).not.toThrow();
    });

    it('validates correct image generation request', () => {
      const validRequest = {
        type: 'image' as const,
        prompt: 'Create a vibrant sunset over mountain landscape',
        org_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => generateContentSchema.parse(validRequest)).not.toThrow();
    });

    it('rejects invalid type', () => {
      const invalidRequest = {
        type: 'video',
        prompt: 'Test prompt that is long enough',
        org_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => generateContentSchema.parse(invalidRequest)).toThrow();
    });

    it('rejects prompt that is too short', () => {
      const invalidRequest = {
        type: 'text' as const,
        prompt: 'Short',
        org_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => generateContentSchema.parse(invalidRequest)).toThrow();
    });

    it('rejects prompt that is too long', () => {
      const invalidRequest = {
        type: 'text' as const,
        prompt: 'a'.repeat(4001),
        org_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => generateContentSchema.parse(invalidRequest)).toThrow();
    });

    it('rejects invalid UUID format', () => {
      const invalidRequest = {
        type: 'text' as const,
        prompt: 'Valid prompt length here',
        org_id: 'not-a-uuid',
      };

      expect(() => generateContentSchema.parse(invalidRequest)).toThrow();
    });

    it('accepts request without optional name field', () => {
      const validRequest = {
        type: 'text' as const,
        prompt: 'Test prompt that is long enough',
        org_id: '550e8400-e29b-41d4-a716-446655440000',
      };

      expect(() => generateContentSchema.parse(validRequest)).not.toThrow();
    });
  });

  describe('campaignDraftSchema', () => {
    it('validates correct campaign draft request', () => {
      const validRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Summer Launch 2025',
        objective: 'Drive 50K impressions and 2K clicks in 30 days for new product line',
        platforms: ['instagram', 'tiktok', 'facebook'] as const,
        description: 'Launch campaign for eco-friendly swimwear targeting Gen Z',
      };

      expect(() => campaignDraftSchema.parse(validRequest)).not.toThrow();
    });

    it('rejects name that is too short', () => {
      const invalidRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Ab',
        objective: 'Test objective that is long enough here',
      };

      expect(() => campaignDraftSchema.parse(invalidRequest)).toThrow();
    });

    it('rejects objective that is too short', () => {
      const invalidRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Valid Name',
        objective: 'Short',
      };

      expect(() => campaignDraftSchema.parse(invalidRequest)).toThrow();
    });

    it('rejects invalid platform names', () => {
      const invalidRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Valid Name',
        objective: 'Valid objective that is long enough',
        platforms: ['instagram', 'myspace'],
      };

      expect(() => campaignDraftSchema.parse(invalidRequest)).toThrow();
    });

    it('accepts request without optional fields', () => {
      const validRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Minimal Campaign',
        objective: 'This is a valid objective string',
      };

      expect(() => campaignDraftSchema.parse(validRequest)).not.toThrow();
    });
  });

  describe('scheduleSchema', () => {
    it('validates correct schedule request', () => {
      const validRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        asset_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        platform: 'instagram' as const,
        scheduled_at: '2025-12-15T14:30:00Z',
        campaign_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      };

      expect(() => scheduleSchema.parse(validRequest)).not.toThrow();
    });

    it('rejects invalid platform', () => {
      const invalidRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        asset_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        platform: 'snapchat',
        scheduled_at: '2025-12-15T14:30:00Z',
      };

      expect(() => scheduleSchema.parse(invalidRequest)).toThrow();
    });

    it('rejects invalid datetime format', () => {
      const invalidRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        asset_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        platform: 'instagram' as const,
        scheduled_at: '12/15/2025',
      };

      expect(() => scheduleSchema.parse(invalidRequest)).toThrow();
    });

    it('accepts request without optional campaign_id', () => {
      const validRequest = {
        org_id: '550e8400-e29b-41d4-a716-446655440000',
        asset_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        platform: 'facebook' as const,
        scheduled_at: '2025-12-15T14:30:00Z',
      };

      expect(() => scheduleSchema.parse(validRequest)).not.toThrow();
    });

    it('validates all supported platforms', () => {
      const platforms = ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok', 'youtube'] as const;

      platforms.forEach((platform) => {
        const request = {
          org_id: '550e8400-e29b-41d4-a716-446655440000',
          asset_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          platform,
          scheduled_at: '2025-12-15T14:30:00Z',
        };

        expect(() => scheduleSchema.parse(request)).not.toThrow();
      });
    });
  });
});
