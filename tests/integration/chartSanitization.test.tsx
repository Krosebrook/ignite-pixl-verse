import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  sanitizeCssColor,
  sanitizeCssKey,
  sanitizeCssId,
} from '@/lib/cssSanitize';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  Tooltip: () => null,
  Legend: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

// Import after mocking
import { ChartContainer, ChartConfig } from '@/components/ui/chart';

describe('Chart Component CSS Injection Integration Tests', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('ChartContainer with valid colors', () => {
    it('renders with valid hex colors', () => {
      const config: ChartConfig = {
        primary: { label: 'Primary', color: '#FF7B00' },
        secondary: { label: 'Secondary', color: '#00B4D8' },
      };

      const { container } = render(
        <ChartContainer config={config}>
          <div data-testid="chart-content">Chart</div>
        </ChartContainer>
      );

      // Check that style tag is present
      const styleTag = container.querySelector('style');
      expect(styleTag).toBeTruthy();
      
      // Verify colors are in the style
      const styleContent = styleTag?.innerHTML || '';
      expect(styleContent).toContain('#FF7B00');
      expect(styleContent).toContain('#00B4D8');
    });

    it('renders with valid rgb colors', () => {
      const config: ChartConfig = {
        success: { label: 'Success', color: 'rgb(34, 197, 94)' },
        error: { label: 'Error', color: 'rgba(239, 68, 68, 0.8)' },
      };

      const { container } = render(
        <ChartContainer config={config}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      expect(styleTag).toBeTruthy();
      
      const styleContent = styleTag?.innerHTML || '';
      expect(styleContent).toContain('rgb(34, 197, 94)');
      expect(styleContent).toContain('rgba(239, 68, 68, 0.8)');
    });

    it('renders with valid hsl colors', () => {
      const config: ChartConfig = {
        accent: { label: 'Accent', color: 'hsl(340, 82%, 52%)' },
      };

      const { container } = render(
        <ChartContainer config={config}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      expect(styleContent).toContain('hsl(340, 82%, 52%)');
    });

    it('renders with CSS variables', () => {
      const config: ChartConfig = {
        themed: { label: 'Themed', color: 'var(--primary)' },
      };

      const { container } = render(
        <ChartContainer config={config}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      expect(styleContent).toContain('var(--primary)');
    });

    it('renders with named colors', () => {
      const config: ChartConfig = {
        simple: { label: 'Simple', color: 'red' },
        transparent: { label: 'Transparent', color: 'transparent' },
      };

      const { container } = render(
        <ChartContainer config={config}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      expect(styleContent).toContain('--color-simple: red');
      expect(styleContent).toContain('--color-transparent: transparent');
    });
  });

  describe('ChartContainer blocks malicious inputs', () => {
    it('blocks CSS injection via curly braces', () => {
      const maliciousConfig: ChartConfig = {
        'evil': { label: 'Evil', color: 'red} body { background: red' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      // Malicious color should NOT be in output
      expect(styleContent).not.toContain('body { background');
      expect(styleContent).not.toContain('red}');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('blocks CSS injection via semicolons', () => {
      const maliciousConfig: ChartConfig = {
        'hack': { label: 'Hack', color: '#fff; background-image: url(evil.jpg)' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('background-image');
      expect(styleContent).not.toContain('evil.jpg');
    });

    it('blocks url() function injection', () => {
      const maliciousConfig: ChartConfig = {
        'tracker': { label: 'Tracker', color: 'url(https://evil.com/track.gif)' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('url(');
      expect(styleContent).not.toContain('evil.com');
    });

    it('blocks javascript: protocol injection', () => {
      const maliciousConfig: ChartConfig = {
        'xss': { label: 'XSS', color: 'javascript:alert(1)' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('javascript:');
      expect(styleContent).not.toContain('alert');
    });

    it('blocks expression() function (IE XSS)', () => {
      const maliciousConfig: ChartConfig = {
        'ie-xss': { label: 'IE XSS', color: 'expression(document.cookie)' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('expression');
      expect(styleContent).not.toContain('document.cookie');
    });

    it('blocks data: URI injection', () => {
      const maliciousConfig: ChartConfig = {
        'data-xss': { label: 'Data XSS', color: 'data:text/html,<script>alert(1)</script>' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('data:');
      expect(styleContent).not.toContain('<script>');
    });

    it('blocks @import injection', () => {
      const maliciousConfig: ChartConfig = {
        'import': { label: 'Import', color: '@import url(evil.css)' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('@import');
    });

    it('blocks HTML tag injection', () => {
      const maliciousConfig: ChartConfig = {
        'html': { label: 'HTML', color: '<script>alert(1)</script>' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('<script>');
      expect(styleContent).not.toContain('</script>');
    });

    it('blocks CSS comment injection', () => {
      const maliciousConfig: ChartConfig = {
        'comment': { label: 'Comment', color: '/* */ red' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('/*');
    });

    it('blocks newline injection', () => {
      const maliciousConfig: ChartConfig = {
        'newline': { label: 'Newline', color: '#fff\nbackground: red' },
      };

      const { container } = render(
        <ChartContainer config={maliciousConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      // The property should not contain the injected background
      expect(styleContent).not.toMatch(/--color-newline:.*background/);
    });
  });

  describe('ChartContainer key sanitization', () => {
    it('rejects keys starting with numbers', () => {
      const invalidConfig: ChartConfig = {
        '123color': { label: 'Bad Key', color: '#fff' },
      };

      const { container } = render(
        <ChartContainer config={invalidConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('--color-123color');
    });

    it('rejects keys with special characters', () => {
      const invalidConfig: ChartConfig = {
        'color;injection': { label: 'Injection', color: '#fff' },
      };

      const { container } = render(
        <ChartContainer config={invalidConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).not.toContain('color;injection');
    });

    it('allows valid keys with hyphens and underscores', () => {
      const validConfig: ChartConfig = {
        'primary-color': { label: 'Primary', color: '#FF7B00' },
        'secondary_accent': { label: 'Secondary', color: '#00B4D8' },
      };

      const { container } = render(
        <ChartContainer config={validConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).toContain('--color-primary-color');
      expect(styleContent).toContain('--color-secondary_accent');
    });
  });

  describe('Mixed valid and invalid configurations', () => {
    it('includes valid colors and excludes invalid ones', () => {
      const mixedConfig: ChartConfig = {
        'valid': { label: 'Valid', color: '#00B4D8' },
        'invalid': { label: 'Invalid', color: 'javascript:alert(1)' },
        'alsoValid': { label: 'Also Valid', color: 'rgb(255, 128, 0)' },
      };

      const { container } = render(
        <ChartContainer config={mixedConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      // Valid colors should be present
      expect(styleContent).toContain('#00B4D8');
      expect(styleContent).toContain('rgb(255, 128, 0)');
      
      // Invalid color should not be present
      expect(styleContent).not.toContain('javascript:');
    });
  });

  describe('Theme support', () => {
    it('generates styles for both light and dark themes', () => {
      const themedConfig: ChartConfig = {
        'themed': {
          label: 'Themed',
          theme: {
            light: '#000000',
            dark: '#FFFFFF',
          },
        },
      };

      const { container } = render(
        <ChartContainer config={themedConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).toContain('#000000');
      expect(styleContent).toContain('#FFFFFF');
      expect(styleContent).toContain('.dark');
    });

    it('blocks malicious theme colors', () => {
      const maliciousThemedConfig: ChartConfig = {
        'evilTheme': {
          label: 'Evil Theme',
          theme: {
            light: '#fff',
            dark: 'expression(alert(1))',
          },
        },
      };

      const { container } = render(
        <ChartContainer config={maliciousThemedConfig}>
          <div>Chart</div>
        </ChartContainer>
      );

      const styleTag = container.querySelector('style');
      const styleContent = styleTag?.innerHTML || '';
      
      expect(styleContent).toContain('#fff');
      expect(styleContent).not.toContain('expression');
    });
  });
});

describe('Sanitization Function Edge Cases', () => {
  describe('sanitizeCssColor', () => {
    it('handles extremely long inputs', () => {
      const longInput = 'a'.repeat(10000);
      expect(sanitizeCssColor(longInput)).toBeNull();
    });

    it('handles unicode characters', () => {
      expect(sanitizeCssColor('红色')).toBeNull();
      expect(sanitizeCssColor('#fff🎨')).toBeNull();
    });

    it('handles mixed case protocols', () => {
      expect(sanitizeCssColor('JaVaScRiPt:alert(1)')).toBeNull();
      expect(sanitizeCssColor('DATA:text/html,...')).toBeNull();
    });
  });

  describe('sanitizeCssKey', () => {
    it('handles extremely long keys', () => {
      const longKey = 'a'.repeat(1000);
      expect(sanitizeCssKey(longKey)).toBe(longKey);
    });

    it('handles unicode in keys', () => {
      expect(sanitizeCssKey('color-红色')).toBeNull();
    });
  });

  describe('sanitizeCssId', () => {
    it('preserves valid IDs', () => {
      expect(sanitizeCssId('chart-123-abc')).toBe('chart-123-abc');
      expect(sanitizeCssId('my_chart_id')).toBe('my_chart_id');
    });

    it('strips dangerous characters', () => {
      expect(sanitizeCssId('chart"] .evil')).toBe('chart.evil');
    });
  });
});
