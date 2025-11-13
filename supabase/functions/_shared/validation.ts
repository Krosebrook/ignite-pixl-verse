// Shared validation schemas using Zod for type safety
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Layer type validation using Zod
export const LayerTypeSchema = z.enum([
  'background', 'foreground', 'text', 'logo', 'image', 'video', 
  'audio', 'transition', 'effect', 'subtitle', 'caption', 
  'watermark', 'overlay', 'sticker', 'emoji', 'shape', 
  'chart', 'animation', 'particle', 'gradient', 'cta_button',
  'light_leak', 'lens_flare', 'motion_graphics', 'lower_third',
  'end_screen', 'intro_sequence', 'outro_sequence', 'color_grade',
  'particle_effect'
] as const);

// Position validation using Zod
export const PositionSchema = z.object({
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  z_index: z.number().int().min(0).max(999)
});

// Layer validation using Zod with XSS protection
export const LayerSchema = z.object({
  type: LayerTypeSchema,
  content: z.string()
    .max(10000, 'Content must be less than 10KB')
    .refine(
      val => !/<script|javascript:|onerror=|onload=/i.test(val),
      'Content contains potentially malicious code'
    ),
  position: PositionSchema
});

// Quality tier validation using Zod
export const QualityTierSchema = z.enum(['starter', 'pro', 'enterprise']);

// YouTube request validation using Zod
export const YouTubeRequestSchema = z.object({
  org_id: z.string().uuid('Invalid organization ID'),
  prompt: z.string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(4000, 'Prompt must be less than 4000 characters')
    .refine(
      val => !/<script|javascript:|onerror=/i.test(val),
      'Prompt contains potentially malicious code'
    ),
  quality_tier: QualityTierSchema,
  duration_seconds: z.number()
    .int('Duration must be an integer')
    .min(5, 'Duration must be at least 5 seconds')
    .max(600, 'Duration must be less than 10 minutes'),
  layers: z.array(LayerSchema).max(20, 'Maximum 20 layers allowed'),
  name: z.string().max(200).optional()
});

// TikTok request validation using Zod
export const TikTokRequestSchema = z.object({
  org_id: z.string().uuid('Invalid organization ID'),
  prompt: z.string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt must be less than 2000 characters for TikTok')
    .refine(
      val => !/<script|javascript:|onerror=/i.test(val),
      'Prompt contains potentially malicious code'
    ),
  quality_tier: QualityTierSchema,
  duration_seconds: z.number()
    .int('Duration must be an integer')
    .min(5, 'Duration must be at least 5 seconds')
    .max(60, 'TikTok videos must be less than 60 seconds'),
  layers: z.array(LayerSchema).max(20, 'Maximum 20 layers allowed'),
  effects: z.array(z.any()).optional(),
  name: z.string().max(200).optional()
});

export type YouTubeRequest = z.infer<typeof YouTubeRequestSchema>;
export type TikTokRequest = z.infer<typeof TikTokRequestSchema>;

export const TIER_LIMITS = {
  starter: { max_layers: 5, max_duration: 120, max_resolution: '720p' },
  pro: { max_layers: 15, max_duration: 300, max_resolution: '4k' },
  enterprise: { max_layers: 999, max_duration: 600, max_resolution: '8k' }
} as const;
