/**
 * Application constants and configuration
 * Centralized location for all app-wide constants
 */

// Platform configuration
export const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', color: 'hsl(340, 82%, 52%)', maxLength: 2200 },
  { id: 'twitter', name: 'Twitter/X', color: 'hsl(203, 89%, 53%)', maxLength: 280 },
  { id: 'facebook', name: 'Facebook', color: 'hsl(220, 46%, 48%)', maxLength: 63206 },
  { id: 'linkedin', name: 'LinkedIn', color: 'hsl(201, 100%, 35%)', maxLength: 3000 },
  { id: 'tiktok', name: 'TikTok', color: 'hsl(0, 0%, 0%)', maxLength: 2200 },
  { id: 'youtube', name: 'YouTube', color: 'hsl(0, 100%, 50%)', maxLength: 5000 },
] as const;

export type PlatformId = typeof PLATFORMS[number]['id'];

// Campaign objectives
export const CAMPAIGN_OBJECTIVES = [
  { id: 'awareness', label: 'Brand Awareness', description: 'Increase brand visibility and recognition' },
  { id: 'engagement', label: 'Engagement', description: 'Drive likes, comments, and shares' },
  { id: 'conversion', label: 'Conversions', description: 'Generate leads and sales' },
  { id: 'traffic', label: 'Website Traffic', description: 'Drive visitors to your website' },
] as const;

export type CampaignObjectiveId = typeof CAMPAIGN_OBJECTIVES[number]['id'];

// Goal types for campaigns
export const GOAL_TYPES = [
  { id: 'impressions', label: 'Impressions', icon: 'Eye', unit: '' },
  { id: 'clicks', label: 'Clicks', icon: 'MousePointer', unit: '' },
  { id: 'conversions', label: 'Conversions', icon: 'Target', unit: '' },
  { id: 'engagement', label: 'Engagement Rate', icon: 'Heart', unit: '%' },
  { id: 'reach', label: 'Reach', icon: 'Users', unit: '' },
  { id: 'followers', label: 'New Followers', icon: 'UserPlus', unit: '' },
] as const;

export type GoalTypeId = typeof GOAL_TYPES[number]['id'];

// Quality tiers for content generation
export const QUALITY_TIERS = {
  starter: { 
    label: 'Starter', 
    maxLayers: 5, 
    maxDuration: 120, 
    resolution: '720p',
    description: 'Basic quality for quick content'
  },
  pro: { 
    label: 'Pro', 
    maxLayers: 15, 
    maxDuration: 300, 
    resolution: '4K',
    description: 'Professional quality for brands'
  },
  enterprise: { 
    label: 'Enterprise', 
    maxLayers: 999, 
    maxDuration: 600, 
    resolution: '8K',
    description: 'Maximum quality, unlimited layers'
  },
} as const;

export type QualityTier = keyof typeof QUALITY_TIERS;

// Content types
export const CONTENT_TYPES = ['text', 'image', 'video', 'audio'] as const;
export type ContentType = typeof CONTENT_TYPES[number];

// Schedule frequencies
export const SCHEDULE_FREQUENCIES = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Custom' },
] as const;

export type ScheduleFrequency = typeof SCHEDULE_FREQUENCIES[number]['id'];

// Timezones (common ones)
export const TIMEZONES = [
  { id: 'America/New_York', label: 'Eastern Time (ET)' },
  { id: 'America/Chicago', label: 'Central Time (CT)' },
  { id: 'America/Denver', label: 'Mountain Time (MT)' },
  { id: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { id: 'Europe/London', label: 'London (GMT)' },
  { id: 'Europe/Paris', label: 'Paris (CET)' },
  { id: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { id: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { id: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { id: 'UTC', label: 'UTC' },
] as const;

// API rate limits
export const RATE_LIMITS = {
  contentGeneration: { limit: 100, windowMs: 3600000 }, // 100 per hour
  youtubeGeneration: { limit: 20, windowMs: 3600000 },  // 20 per hour
  tiktokGeneration: { limit: 30, windowMs: 3600000 },   // 30 per hour
  schedule: { limit: 200, windowMs: 3600000 },          // 200 per hour
} as const;

// Validation limits
export const VALIDATION = {
  prompt: { min: 10, max: 4000 },
  tiktokPrompt: { min: 10, max: 2000 },
  campaignName: { min: 3, max: 100 },
  description: { max: 1000 },
  maxAssets: 50,
  maxPlatforms: 6,
  maxGoals: 10,
  maxLayers: 20,
} as const;

// Status colors for consistent styling
export const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  draft: 'bg-muted text-muted-foreground border-border',
  paused: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
} as const;

export type StatusType = keyof typeof STATUS_STYLES;
