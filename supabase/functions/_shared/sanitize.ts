/**
 * Server-side input sanitization for Deno Edge Functions
 * Mirrors client-side DOMPurify logic for defense in depth
 */

// Dangerous HTML patterns to strip
const DANGEROUS_TAGS = [
  'script', 'style', 'iframe', 'object', 'embed', 'form', 
  'input', 'button', 'textarea', 'select', 'link', 'meta',
  'base', 'applet', 'frame', 'frameset', 'layer', 'ilayer'
];

// Dangerous attributes that could execute JavaScript
const DANGEROUS_ATTRS = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 
  'onblur', 'onsubmit', 'onreset', 'onchange', 'oninput',
  'onkeydown', 'onkeyup', 'onkeypress', 'onmousedown', 'onmouseup',
  'ondblclick', 'oncontextmenu', 'ondrag', 'ondrop', 'onpaste',
  'onanimationend', 'onanimationstart', 'ontransitionend'
];

// Dangerous URL protocols
const DANGEROUS_PROTOCOLS = [
  'javascript:', 'data:', 'vbscript:', 'file:', 'about:'
];

// Prompt injection patterns for AI content
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /jailbreak/i,
  /forget\s+(everything|all|your|previous)/i,
  /you\s+are\s+now/i,
  /new\s+instructions/i,
  /disregard\s+(all|previous)/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /role\s*:\s*(system|admin|developer)/i,
  /\[\[.*\]\]/i, // Double bracket injection attempts
  /{{.*}}/i, // Template injection attempts
];

// XSS patterns to detect malicious content
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*["']?\s*javascript/gi,
  /<\s*img[^>]+src\s*=\s*["']?\s*javascript/gi,
  /<\s*a[^>]+href\s*=\s*["']?\s*javascript/gi,
  /&#x?[0-9a-f]+;/gi, // Encoded characters (could hide malicious content)
  /\\u[0-9a-f]{4}/gi, // Unicode escapes
];

/**
 * Strips HTML tags from input (server-side equivalent of DOMPurify)
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove all HTML tags
  let result = input.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Strip the decoded tags again (double encoding protection)
  result = result.replace(/<[^>]*>/g, '');
  
  return result;
}

/**
 * Sanitizes text input for database storage
 * - Removes HTML tags
 * - Trims whitespace
 * - Limits length
 * - Blocks XSS patterns
 */
export function sanitizeForStorage(input: string, maxLength = 10000): string {
  if (!input || typeof input !== 'string') return '';
  
  // Strip HTML
  let sanitized = stripHtml(input);
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  return sanitized.slice(0, maxLength);
}

/**
 * Validates and sanitizes URLs
 * Blocks dangerous protocols like javascript:, data:, etc.
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (trimmed.startsWith(proto)) {
      return '';
    }
  }
  
  // Validate URL structure
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return '';
    }
    return url.trim();
  } catch {
    // Allow relative URLs starting with / or #
    if (url.trim().startsWith('/') || url.trim().startsWith('#')) {
      return url.trim();
    }
    return '';
  }
}

/**
 * Checks if content contains potential XSS attacks
 */
export function containsXss(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if content contains potential prompt injection
 */
export function containsPromptInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validates input doesn't contain dangerous content
 * Returns validation result with specific error
 */
export function validateInput(
  input: string, 
  options: { 
    maxLength?: number; 
    minLength?: number;
    checkXss?: boolean;
    checkPromptInjection?: boolean;
    fieldName?: string;
  } = {}
): { valid: boolean; error?: string; sanitized?: string } {
  const { 
    maxLength = 10000, 
    minLength = 0, 
    checkXss = true, 
    checkPromptInjection = false,
    fieldName = 'Input'
  } = options;
  
  if (!input || typeof input !== 'string') {
    if (minLength > 0) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: '' };
  }
  
  // Check length constraints
  if (input.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (input.length > maxLength) {
    return { valid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }
  
  // Check for XSS
  if (checkXss && containsXss(input)) {
    return { valid: false, error: `${fieldName} contains potentially malicious content` };
  }
  
  // Check for prompt injection
  if (checkPromptInjection && containsPromptInjection(input)) {
    return { valid: false, error: `${fieldName} contains blocked patterns` };
  }
  
  // Return sanitized version
  return { 
    valid: true, 
    sanitized: sanitizeForStorage(input, maxLength) 
  };
}

/**
 * Recursively sanitizes all string values in an object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T, 
  maxStringLength = 10000
): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeForStorage(value, maxStringLength);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') {
          return sanitizeForStorage(item, maxStringLength);
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item as Record<string, unknown>, maxStringLength);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, maxStringLength);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Escapes special characters for safe inclusion in HTML attributes
 */
export function escapeAttribute(value: string): string {
  if (!value || typeof value !== 'string') return '';
  
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // Basic email validation pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim()) && email.length <= 254;
}

/**
 * Validates UUID format
 */
export function isValidUuid(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
}
