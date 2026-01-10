import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeCssColor,
  sanitizeCssKey,
  sanitizeCssId,
  containsDangerousCssPatterns,
  CSS_DANGEROUS_PATTERNS,
} from '@/lib/cssSanitize';

describe('CSS Sanitization Utilities', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('sanitizeCssColor', () => {
    describe('valid colors', () => {
      it('accepts 3-digit hex colors', () => {
        expect(sanitizeCssColor('#fff')).toBe('#fff');
        expect(sanitizeCssColor('#ABC')).toBe('#ABC');
        expect(sanitizeCssColor('#123')).toBe('#123');
      });

      it('accepts 6-digit hex colors', () => {
        expect(sanitizeCssColor('#ffffff')).toBe('#ffffff');
        expect(sanitizeCssColor('#AABBCC')).toBe('#AABBCC');
        expect(sanitizeCssColor('#FF7B00')).toBe('#FF7B00');
      });

      it('accepts 4-digit hex colors with alpha', () => {
        expect(sanitizeCssColor('#fffa')).toBe('#fffa');
        expect(sanitizeCssColor('#1234')).toBe('#1234');
      });

      it('accepts 8-digit hex colors with alpha', () => {
        expect(sanitizeCssColor('#ffffffff')).toBe('#ffffffff');
        expect(sanitizeCssColor('#12345678')).toBe('#12345678');
      });

      it('accepts rgb colors', () => {
        expect(sanitizeCssColor('rgb(255, 255, 255)')).toBe('rgb(255, 255, 255)');
        expect(sanitizeCssColor('rgb(0, 0, 0)')).toBe('rgb(0, 0, 0)');
        expect(sanitizeCssColor('rgb(128,128,128)')).toBe('rgb(128,128,128)');
      });

      it('accepts rgba colors', () => {
        expect(sanitizeCssColor('rgba(255, 255, 255, 0.5)')).toBe('rgba(255, 255, 255, 0.5)');
        expect(sanitizeCssColor('rgba(0, 0, 0, 1)')).toBe('rgba(0, 0, 0, 1)');
        expect(sanitizeCssColor('rgba(128,128,128,0)')).toBe('rgba(128,128,128,0)');
      });

      it('accepts modern rgb syntax with space separator', () => {
        expect(sanitizeCssColor('rgb(255 255 255)')).toBe('rgb(255 255 255)');
        expect(sanitizeCssColor('rgb(255 255 255 / 50%)')).toBe('rgb(255 255 255 / 50%)');
        expect(sanitizeCssColor('rgb(255 255 255 / 0.5)')).toBe('rgb(255 255 255 / 0.5)');
      });

      it('accepts hsl colors', () => {
        expect(sanitizeCssColor('hsl(360, 100%, 50%)')).toBe('hsl(360, 100%, 50%)');
        expect(sanitizeCssColor('hsl(0, 0%, 0%)')).toBe('hsl(0, 0%, 0%)');
        expect(sanitizeCssColor('hsl(180deg, 50%, 50%)')).toBe('hsl(180deg, 50%, 50%)');
      });

      it('accepts hsla colors', () => {
        expect(sanitizeCssColor('hsla(360, 100%, 50%, 0.5)')).toBe('hsla(360, 100%, 50%, 0.5)');
        expect(sanitizeCssColor('hsla(0, 0%, 0%, 1)')).toBe('hsla(0, 0%, 0%, 1)');
      });

      it('accepts modern hsl syntax', () => {
        expect(sanitizeCssColor('hsl(360 100% 50%)')).toBe('hsl(360 100% 50%)');
        expect(sanitizeCssColor('hsl(360 100% 50% / 50%)')).toBe('hsl(360 100% 50% / 50%)');
      });

      it('accepts CSS variables', () => {
        expect(sanitizeCssColor('var(--primary)')).toBe('var(--primary)');
        expect(sanitizeCssColor('var(--color-bg)')).toBe('var(--color-bg)');
        expect(sanitizeCssColor('var(--my-color, #fff)')).toBe('var(--my-color, #fff)');
      });

      it('accepts named colors', () => {
        expect(sanitizeCssColor('red')).toBe('red');
        expect(sanitizeCssColor('blue')).toBe('blue');
        expect(sanitizeCssColor('transparent')).toBe('transparent');
        expect(sanitizeCssColor('currentcolor')).toBe('currentcolor');
        expect(sanitizeCssColor('inherit')).toBe('inherit');
      });

      it('trims whitespace from valid colors', () => {
        expect(sanitizeCssColor('  #fff  ')).toBe('#fff');
        expect(sanitizeCssColor('\t#ffffff\t')).toBe('#ffffff');
      });
    });

    describe('CSS injection attacks', () => {
      it('blocks curly braces (CSS block escape)', () => {
        expect(sanitizeCssColor('red} body { background: red')).toBeNull();
        expect(sanitizeCssColor('#fff } .evil { display: block')).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('blocks semicolons (statement injection)', () => {
        expect(sanitizeCssColor('#fff; background-image: url(evil.jpg)')).toBeNull();
        expect(sanitizeCssColor('red; color: green')).toBeNull();
      });

      it('blocks url() function (resource loading)', () => {
        expect(sanitizeCssColor('url(https://evil.com/track.gif)')).toBeNull();
        expect(sanitizeCssColor('url("javascript:alert(1)")')).toBeNull();
        expect(sanitizeCssColor('url( evil.png )')).toBeNull();
      });

      it('blocks expression() function (IE XSS)', () => {
        expect(sanitizeCssColor('expression(alert(1))')).toBeNull();
        expect(sanitizeCssColor('expression( document.cookie )')).toBeNull();
      });

      it('blocks javascript: protocol', () => {
        expect(sanitizeCssColor('javascript:alert(1)')).toBeNull();
        expect(sanitizeCssColor('JAVASCRIPT:alert(1)')).toBeNull();
      });

      it('blocks data: URIs', () => {
        expect(sanitizeCssColor('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(sanitizeCssColor('DATA:image/svg+xml,...')).toBeNull();
      });

      it('blocks @import statements', () => {
        expect(sanitizeCssColor('@import url(evil.css)')).toBeNull();
        expect(sanitizeCssColor('@IMPORT "evil.css"')).toBeNull();
      });

      it('blocks HTML injection', () => {
        expect(sanitizeCssColor('<script>alert(1)</script>')).toBeNull();
        expect(sanitizeCssColor('#fff"><img src=x onerror=alert(1)>')).toBeNull();
      });

      it('blocks CSS comments (break out attempts)', () => {
        expect(sanitizeCssColor('/* comment */ red')).toBeNull();
        expect(sanitizeCssColor('#fff /* */ } .evil')).toBeNull();
      });

      it('blocks escape sequences', () => {
        expect(sanitizeCssColor('#ff\\ff')).toBeNull();
        expect(sanitizeCssColor('\\3c script\\3e')).toBeNull();
      });

      it('blocks newlines (property escape)', () => {
        expect(sanitizeCssColor('#fff\nbackground: red')).toBeNull();
        expect(sanitizeCssColor('red\r\ncolor: blue')).toBeNull();
      });
    });

    describe('invalid inputs', () => {
      it('rejects null and undefined', () => {
        expect(sanitizeCssColor(null as unknown as string)).toBeNull();
        expect(sanitizeCssColor(undefined as unknown as string)).toBeNull();
      });

      it('rejects empty string', () => {
        expect(sanitizeCssColor('')).toBeNull();
      });

      it('rejects non-string values', () => {
        expect(sanitizeCssColor(123 as unknown as string)).toBeNull();
        expect(sanitizeCssColor({} as unknown as string)).toBeNull();
        expect(sanitizeCssColor([] as unknown as string)).toBeNull();
      });

      it('rejects unknown color formats', () => {
        expect(sanitizeCssColor('notacolor')).toBeNull();
        expect(sanitizeCssColor('rgb(999,999,999)')).toBeNull();
        expect(sanitizeCssColor('#gggggg')).toBeNull();
      });

      it('rejects hex colors with wrong length', () => {
        expect(sanitizeCssColor('#ff')).toBeNull();
        expect(sanitizeCssColor('#fffff')).toBeNull();
        expect(sanitizeCssColor('#fffffffff')).toBeNull();
      });
    });
  });

  describe('sanitizeCssKey', () => {
    describe('valid keys', () => {
      it('accepts alphanumeric keys starting with letter', () => {
        expect(sanitizeCssKey('primary')).toBe('primary');
        expect(sanitizeCssKey('color1')).toBe('color1');
        expect(sanitizeCssKey('myColor2024')).toBe('myColor2024');
      });

      it('accepts keys with hyphens and underscores', () => {
        expect(sanitizeCssKey('primary-color')).toBe('primary-color');
        expect(sanitizeCssKey('color_primary')).toBe('color_primary');
        expect(sanitizeCssKey('my-color_1')).toBe('my-color_1');
      });

      it('accepts single character keys', () => {
        expect(sanitizeCssKey('a')).toBe('a');
        expect(sanitizeCssKey('Z')).toBe('Z');
      });
    });

    describe('invalid keys', () => {
      it('rejects keys starting with numbers', () => {
        expect(sanitizeCssKey('1color')).toBeNull();
        expect(sanitizeCssKey('123')).toBeNull();
      });

      it('rejects keys starting with special characters', () => {
        expect(sanitizeCssKey('-color')).toBeNull();
        expect(sanitizeCssKey('_color')).toBeNull();
        expect(sanitizeCssKey('.color')).toBeNull();
      });

      it('rejects keys with spaces', () => {
        expect(sanitizeCssKey('primary color')).toBeNull();
        expect(sanitizeCssKey('color name')).toBeNull();
      });

      it('rejects keys with special characters', () => {
        expect(sanitizeCssKey('color;injection')).toBeNull();
        expect(sanitizeCssKey('color}evil')).toBeNull();
        expect(sanitizeCssKey('color:value')).toBeNull();
      });

      it('rejects null, undefined, and empty strings', () => {
        expect(sanitizeCssKey(null as unknown as string)).toBeNull();
        expect(sanitizeCssKey(undefined as unknown as string)).toBeNull();
        expect(sanitizeCssKey('')).toBeNull();
      });

      it('rejects non-string values', () => {
        expect(sanitizeCssKey(123 as unknown as string)).toBeNull();
      });
    });
  });

  describe('sanitizeCssId', () => {
    it('returns unchanged valid IDs', () => {
      expect(sanitizeCssId('chart-123')).toBe('chart-123');
      expect(sanitizeCssId('my_chart_id')).toBe('my_chart_id');
      expect(sanitizeCssId('ChartId')).toBe('ChartId');
    });

    it('removes invalid characters', () => {
      expect(sanitizeCssId('chart{evil}')).toBe('chartevil');
      expect(sanitizeCssId('chart;id')).toBe('chartid');
      expect(sanitizeCssId('chart<script>')).toBe('chartscript');
    });

    it('handles special characters that could break selectors', () => {
      expect(sanitizeCssId('id] .evil')).toBe('id.evil');
      expect(sanitizeCssId('id" onclick="')).toBe('idonclick');
    });

    it('returns empty string for null/undefined', () => {
      expect(sanitizeCssId(null as unknown as string)).toBe('');
      expect(sanitizeCssId(undefined as unknown as string)).toBe('');
      expect(sanitizeCssId('')).toBe('');
    });
  });

  describe('containsDangerousCssPatterns', () => {
    it('detects curly braces', () => {
      expect(containsDangerousCssPatterns('body { color: red }')).toBe(true);
    });

    it('detects semicolons', () => {
      expect(containsDangerousCssPatterns('color: red; evil: bad')).toBe(true);
    });

    it('detects url()', () => {
      expect(containsDangerousCssPatterns('url(evil.png)')).toBe(true);
    });

    it('detects expression()', () => {
      expect(containsDangerousCssPatterns('expression(alert(1))')).toBe(true);
    });

    it('detects javascript:', () => {
      expect(containsDangerousCssPatterns('javascript:void(0)')).toBe(true);
    });

    it('detects data:', () => {
      expect(containsDangerousCssPatterns('data:text/html,...')).toBe(true);
    });

    it('detects @import', () => {
      expect(containsDangerousCssPatterns('@import "style.css"')).toBe(true);
    });

    it('detects HTML tags', () => {
      expect(containsDangerousCssPatterns('<script>')).toBe(true);
    });

    it('detects CSS comments', () => {
      expect(containsDangerousCssPatterns('/* comment */')).toBe(true);
    });

    it('detects escape sequences', () => {
      expect(containsDangerousCssPatterns('\\3c')).toBe(true);
    });

    it('detects -moz-binding', () => {
      expect(containsDangerousCssPatterns('-moz-binding: url(evil.xml)')).toBe(true);
    });

    it('detects behavior:', () => {
      expect(containsDangerousCssPatterns('behavior: url(evil.htc)')).toBe(true);
    });

    it('returns false for safe values', () => {
      expect(containsDangerousCssPatterns('#fff')).toBe(false);
      expect(containsDangerousCssPatterns('rgb(255, 255, 255)')).toBe(false);
      expect(containsDangerousCssPatterns('hsl(360, 100%, 50%)')).toBe(false);
      expect(containsDangerousCssPatterns('red')).toBe(false);
    });

    it('returns false for null/undefined/empty', () => {
      expect(containsDangerousCssPatterns(null as unknown as string)).toBe(false);
      expect(containsDangerousCssPatterns(undefined as unknown as string)).toBe(false);
      expect(containsDangerousCssPatterns('')).toBe(false);
    });
  });

  describe('CSS_DANGEROUS_PATTERNS', () => {
    it('contains expected number of patterns', () => {
      expect(CSS_DANGEROUS_PATTERNS.length).toBeGreaterThanOrEqual(12);
    });

    it('all patterns are RegExp instances', () => {
      CSS_DANGEROUS_PATTERNS.forEach(pattern => {
        expect(pattern).toBeInstanceOf(RegExp);
      });
    });
  });
});
