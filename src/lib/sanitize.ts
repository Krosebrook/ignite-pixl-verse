/**
 * DOM sanitization utilities using DOMPurify
 * Prevents XSS attacks from user-generated content
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify with strict defaults
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
    'span', 'div', 'img'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'], // Allow target="_blank" for links
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

// Stricter config for plain text only
const TEXT_ONLY_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
};

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param dirty - Untrusted HTML content
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(dirty, DOMPURIFY_CONFIG);
}

/**
 * Strips all HTML tags and returns plain text
 * @param dirty - Untrusted content
 * @returns Plain text string
 */
export function sanitizeToText(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(dirty, TEXT_ONLY_CONFIG);
}

/**
 * Sanitizes a URL to prevent javascript: and data: URIs
 * @param url - Untrusted URL
 * @returns Safe URL or empty string
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
  ];
  
  if (dangerousProtocols.some(proto => trimmed.startsWith(proto))) {
    return '';
  }
  
  // Validate URL structure
  try {
    const parsed = new URL(url, window.location.origin);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return '';
    }
    return url;
  } catch {
    // Allow relative URLs
    if (url.startsWith('/') || url.startsWith('#')) {
      return url;
    }
    return '';
  }
}

/**
 * Sanitizes user input for storage in database
 * Removes HTML, trims whitespace, and limits length
 * @param input - Untrusted user input
 * @param maxLength - Maximum allowed length (default 10000)
 * @returns Sanitized string
 */
export function sanitizeForStorage(input: string, maxLength = 10000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Strip all HTML
  const text = sanitizeToText(input);
  
  // Trim whitespace
  const trimmed = text.trim();
  
  // Limit length
  return trimmed.slice(0, maxLength);
}

/**
 * Sanitizes JSON content by recursively sanitizing all string values
 * @param obj - Object with potentially unsafe string values
 * @returns Object with sanitized string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeForStorage(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeForStorage(item) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) : 
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Escapes special characters for safe inclusion in HTML attributes
 * @param value - Untrusted attribute value
 * @returns Escaped string
 */
export function escapeAttribute(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Re-export DOMPurify for advanced usage
export { DOMPurify };
