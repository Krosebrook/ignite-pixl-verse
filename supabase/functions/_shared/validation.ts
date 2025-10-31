// Shared validation schemas for edge functions
// Uses Zod for runtime type checking and input validation

export const LayerTypeSchema = {
  parse: (val: string) => {
    const validTypes = [
      'background', 'foreground', 'text', 'logo', 'transition',
      'effect', 'audio', 'subtitle', 'watermark', 'cta_button',
      'animation', 'particle_effect', 'color_grade', 'light_leak',
      'lens_flare', 'motion_graphics', 'lower_third', 'end_screen',
      'intro_sequence', 'outro_sequence'
    ];
    if (!validTypes.includes(val)) {
      throw new Error(`Invalid layer type: ${val}`);
    }
    return val;
  }
};

export const PositionSchema = {
  parse: (val: any) => {
    if (typeof val !== 'object' || val === null) {
      throw new Error('Position must be an object');
    }
    if (val.x !== undefined && (typeof val.x !== 'number' || val.x < 0 || val.x > 1)) {
      throw new Error('Position x must be between 0 and 1');
    }
    if (val.y !== undefined && (typeof val.y !== 'number' || val.y < 0 || val.y > 1)) {
      throw new Error('Position y must be between 0 and 1');
    }
    if (typeof val.z_index !== 'number' || val.z_index < 0 || val.z_index > 999) {
      throw new Error('Position z_index must be between 0 and 999');
    }
    return val;
  }
};

export const LayerSchema = {
  parse: (val: any) => {
    if (typeof val !== 'object' || val === null) {
      throw new Error('Layer must be an object');
    }
    LayerTypeSchema.parse(val.type);
    if (typeof val.content !== 'string' || val.content.length > 10000) {
      throw new Error('Layer content must be a string under 10KB');
    }
    PositionSchema.parse(val.position);
    return val;
  }
};

export const QualityTierSchema = {
  parse: (val: string) => {
    const validTiers = ['starter', 'pro', 'enterprise'];
    if (!validTiers.includes(val)) {
      throw new Error(`Invalid quality tier: ${val}`);
    }
    return val;
  }
};

export const YouTubeRequestSchema = {
  parse: (val: any) => {
    if (!val.org_id || typeof val.org_id !== 'string') {
      throw new Error('org_id is required and must be a UUID');
    }
    if (!val.prompt || typeof val.prompt !== 'string' || val.prompt.length < 10 || val.prompt.length > 4000) {
      throw new Error('prompt must be between 10 and 4000 characters');
    }
    if (/<script|javascript:|onerror=/i.test(val.prompt)) {
      throw new Error('Prompt contains unsafe content');
    }
    QualityTierSchema.parse(val.quality_tier);
    if (typeof val.duration_seconds !== 'number' || val.duration_seconds < 5 || val.duration_seconds > 600) {
      throw new Error('duration_seconds must be between 5 and 600');
    }
    if (!Array.isArray(val.layers) || val.layers.length > 20) {
      throw new Error('layers must be an array with max 20 items');
    }
    val.layers.forEach((layer: any) => LayerSchema.parse(layer));
    return val;
  }
};

export const TikTokRequestSchema = {
  parse: (val: any) => {
    if (!val.org_id || typeof val.org_id !== 'string') {
      throw new Error('org_id is required and must be a UUID');
    }
    if (!val.prompt || typeof val.prompt !== 'string' || val.prompt.length < 10 || val.prompt.length > 2000) {
      throw new Error('prompt must be between 10 and 2000 characters');
    }
    QualityTierSchema.parse(val.quality_tier);
    if (typeof val.duration_seconds !== 'number' || val.duration_seconds < 5 || val.duration_seconds > 60) {
      throw new Error('duration_seconds must be between 5 and 60 for TikTok');
    }
    if (!Array.isArray(val.layers) || val.layers.length > 20) {
      throw new Error('layers must be an array with max 20 items');
    }
    val.layers.forEach((layer: any) => LayerSchema.parse(layer));
    return val;
  }
};

export const TIER_LIMITS = {
  starter: { max_layers: 5, max_duration: 120, max_resolution: '720p' },
  pro: { max_layers: 15, max_duration: 300, max_resolution: '4k' },
  enterprise: { max_layers: 999, max_duration: 600, max_resolution: '8k' }
} as const;
