/**
 * CSS Sanitization utilities to prevent CSS injection attacks
 * Used for sanitizing user-provided values before injecting into CSS
 */

/**
 * Validates and sanitizes a CSS color value to prevent CSS injection attacks.
 * Only allows valid CSS color formats: hex, rgb, rgba, hsl, hsla, and named colors.
 * @param color - The color value to validate
 * @returns The sanitized color or null if invalid
 */
export function sanitizeCssColor(color: string): string | null {
  if (!color || typeof color !== 'string') {
    return null;
  }

  const trimmed = color.trim();
  
  // Block any values containing dangerous CSS injection patterns
  const dangerousPatterns = [
    /[{}]/,                    // CSS block delimiters
    /;/,                       // Statement terminators
    /url\s*\(/i,               // URL functions (can load external resources)
    /expression\s*\(/i,        // IE expression (deprecated but dangerous)
    /javascript:/i,            // JavaScript protocol
    /data:/i,                  // Data URIs
    /@import/i,                // CSS imports
    /<|>/,                     // HTML injection
    /\/\*/,                    // CSS comments (can break out)
    /\\/,                      // Escape sequences
    /\n|\r/,                   // Newlines (can break out of property)
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn(`[cssSanitize] Blocked potentially malicious color value: ${trimmed.substring(0, 50)}`);
      return null;
    }
  }

  // Valid CSS color patterns
  const validPatterns = [
    // Hex colors: #RGB, #RRGGBB, #RGBA, #RRGGBBAA
    /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
    // RGB/RGBA: rgb(255, 255, 255) or rgba(255, 255, 255, 0.5)
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/i,
    // Modern RGB: rgb(255 255 255 / 50%)
    /^rgba?\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*(\/\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i,
    // HSL/HSLA: hsl(360, 100%, 50%) or hsla(360, 100%, 50%, 0.5)
    /^hsla?\(\s*\d{1,3}(deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+))?\s*\)$/i,
    // Modern HSL: hsl(360 100% 50% / 50%)
    /^hsla?\(\s*\d{1,3}(deg)?\s+\d{1,3}%\s+\d{1,3}%\s*(\/\s*(0|1|0?\.\d+|\d{1,3}%))?\s*\)$/i,
    // CSS variable reference: var(--color-name) or var(--color-name, fallback)
    /^var\(\s*--[a-z][a-z0-9-]*\s*(,\s*[^)]+)?\s*\)$/i,
    // Named colors (limited set of common safe names)
    /^(transparent|currentcolor|inherit|initial|unset)$/i,
    // Common named colors
    /^(red|blue|green|yellow|orange|purple|pink|white|black|gray|grey|cyan|magenta|lime|navy|teal|aqua|maroon|olive|silver|fuchsia)$/i,
  ];

  for (const pattern of validPatterns) {
    if (pattern.test(trimmed)) {
      return trimmed;
    }
  }

  // If no valid pattern matched, reject the color
  console.warn(`[cssSanitize] Invalid color format rejected: ${trimmed.substring(0, 50)}`);
  return null;
}

/**
 * Sanitizes a CSS selector key to prevent injection via property names.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * @param key - The key to validate
 * @returns The sanitized key or null if invalid
 */
export function sanitizeCssKey(key: string): string | null {
  if (!key || typeof key !== 'string') {
    return null;
  }
  
  // Only allow safe characters in CSS custom property names
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) {
    console.warn(`[cssSanitize] Invalid key rejected: ${key.substring(0, 50)}`);
    return null;
  }
  
  return key;
}

/**
 * Sanitizes a CSS selector ID to prevent selector injection.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * @param id - The ID to sanitize
 * @returns The sanitized ID
 */
export function sanitizeCssId(id: string): string {
  if (!id || typeof id !== 'string') {
    return '';
  }
  
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Comprehensive list of dangerous patterns for CSS injection detection
 */
export const CSS_DANGEROUS_PATTERNS = [
  /[{}]/,                    // CSS block delimiters
  /;/,                       // Statement terminators
  /url\s*\(/i,               // URL functions
  /expression\s*\(/i,        // IE expression
  /javascript:/i,            // JavaScript protocol
  /data:/i,                  // Data URIs
  /@import/i,                // CSS imports
  /<|>/,                     // HTML injection
  /\/\*/,                    // CSS comments
  /\\/,                      // Escape sequences
  /\n|\r/,                   // Newlines
  /-moz-binding/i,           // Firefox XBL binding
  /behavior\s*:/i,           // IE behavior
];

/**
 * Checks if a string contains any dangerous CSS injection patterns
 * @param value - The value to check
 * @returns true if dangerous patterns are found
 */
export function containsDangerousCssPatterns(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  return CSS_DANGEROUS_PATTERNS.some(pattern => pattern.test(value));
}
