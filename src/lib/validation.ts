/**
 * Client-side validation schemas using Zod
 * Mirrors server-side validation for consistency
 */

import { z } from 'zod';
import { VALIDATION, PLATFORMS, GOAL_TYPES, SCHEDULE_FREQUENCIES } from './constants';

// Blocked patterns for prompt injection prevention
const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /forget\s+(everything|all|your|previous)/i,
  /you\s+are\s+now/i,
  /new\s+instructions/i,
  /disregard\s+(all|previous)/i,
];

// Content safety validation helper
const isSafeContent = (val: string) => !BLOCKED_PATTERNS.some(pattern => pattern.test(val));

// UUID validation
export const uuidSchema = z.string().uuid('Invalid ID format');

// Email validation
export const emailSchema = z.string().email('Invalid email address');

// Prompt validation
export const promptSchema = z.string()
  .min(VALIDATION.prompt.min, `Prompt must be at least ${VALIDATION.prompt.min} characters`)
  .max(VALIDATION.prompt.max, `Prompt must be less than ${VALIDATION.prompt.max} characters`)
  .refine(isSafeContent, { message: 'Content contains potentially unsafe patterns' });

// TikTok prompt validation (shorter limit)
export const tiktokPromptSchema = z.string()
  .min(VALIDATION.tiktokPrompt.min, `Prompt must be at least ${VALIDATION.tiktokPrompt.min} characters`)
  .max(VALIDATION.tiktokPrompt.max, `Prompt must be less than ${VALIDATION.tiktokPrompt.max} characters`)
  .refine(isSafeContent, { message: 'Content contains potentially unsafe patterns' });

// Campaign schema
export const campaignSchema = z.object({
  name: z.string()
    .min(VALIDATION.campaignName.min, `Name must be at least ${VALIDATION.campaignName.min} characters`)
    .max(VALIDATION.campaignName.max, `Name must be less than ${VALIDATION.campaignName.max} characters`),
  description: z.string()
    .max(VALIDATION.description.max, `Description must be less than ${VALIDATION.description.max} characters`)
    .optional(),
  objective: z.string().optional(),
  budget_cents: z.number().int().min(0).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  platforms: z.array(z.enum(PLATFORMS.map(p => p.id) as [string, ...string[]]))
    .max(VALIDATION.maxPlatforms, `Maximum ${VALIDATION.maxPlatforms} platforms allowed`),
  assets: z.array(uuidSchema)
    .max(VALIDATION.maxAssets, `Maximum ${VALIDATION.maxAssets} assets allowed`),
  segments: z.array(uuidSchema).optional(),
});

// Schedule config schema
export const scheduleConfigSchema = z.object({
  frequency: z.enum(SCHEDULE_FREQUENCIES.map(f => f.id) as [string, ...string[]]),
  times: z.array(z.string()).min(1, 'At least one time slot required'),
  days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  timezone: z.string().default('UTC'),
});

// Goal schema
export const goalSchema = z.object({
  goal_type: z.enum(GOAL_TYPES.map(g => g.id) as [string, ...string[]]),
  target_value: z.number().int().positive('Target must be a positive number'),
  deadline: z.string().optional(),
});

// Segment criteria schema
export const segmentCriteriaSchema = z.object({
  age_min: z.number().int().min(13).max(120).optional(),
  age_max: z.number().int().min(13).max(120).optional(),
  locations: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
});

// Segment schema
export const segmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  criteria: segmentCriteriaSchema,
});

// Layer schema for content generation
export const layerSchema = z.object({
  type: z.string(),
  content: z.string()
    .max(10000, 'Content must be less than 10KB')
    .refine(
      val => !/<script|javascript:|onerror=|onload=/i.test(val),
      'Content contains potentially malicious code'
    ),
  position: z.object({
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
    z_index: z.number().int().min(0).max(999),
  }),
});

// Content generation request schema
export const contentGenerationSchema = z.object({
  type: z.enum(['text', 'image']),
  prompt: promptSchema,
  org_id: uuidSchema,
  name: z.string().max(200).optional(),
});

// Video generation request schema
export const videoGenerationSchema = z.object({
  org_id: uuidSchema,
  prompt: promptSchema,
  quality_tier: z.enum(['starter', 'pro', 'enterprise']),
  duration_seconds: z.number().int().min(5).max(600),
  layers: z.array(layerSchema).max(VALIDATION.maxLayers),
  name: z.string().max(200).optional(),
});

// Type exports
export type CampaignFormData = z.infer<typeof campaignSchema>;
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;
export type GoalFormData = z.infer<typeof goalSchema>;
export type SegmentFormData = z.infer<typeof segmentSchema>;
export type ContentGenerationRequest = z.infer<typeof contentGenerationSchema>;
export type VideoGenerationRequest = z.infer<typeof videoGenerationSchema>;

/**
 * Validates data against a schema and returns typed result
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Formats Zod errors for display
 */
export function formatZodErrors(errors: z.ZodError): string[] {
  return errors.errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates and sanitizes a URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
