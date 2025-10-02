import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests
 * 
 * Captures screenshots and compares against baseline
 * Detects unintended UI changes
 */

test.describe('Visual Regression: Landing & Marketing', () => {
  test('landing page hero section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for fonts and images
    await page.waitForTimeout(1000);

    // Screenshot hero
    await expect(page.locator('header, main section:first-of-type')).toHaveScreenshot('landing-hero.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('pricing section', async ({ page }) => {
    await page.goto('/#pricing');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.locator('[data-testid="pricing-section"]')).toHaveScreenshot('pricing-section.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression: Dashboard', () => {
  test('dashboard metrics grid', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const metricsGrid = page.locator('[data-testid="metrics-grid"]');
    await expect(metricsGrid).toHaveScreenshot('dashboard-metrics.png', {
      maxDiffPixels: 200,
      threshold: 0.2,
    });
  });

  test('empty state rendering', async ({ page }) => {
    // Navigate to a section with no data
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    const emptyState = page.locator('[data-testid="empty-state"]');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toHaveScreenshot('empty-state.png');
    }
  });
});

test.describe('Visual Regression: Content Studio', () => {
  test('text generation interface', async ({ page }) => {
    await page.goto('/content');
    await page.getByRole('tab', { name: /text/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="text-generator"]')).toHaveScreenshot('content-text-tab.png', {
      maxDiffPixels: 150,
    });
  });

  test('image generation interface', async ({ page }) => {
    await page.goto('/content');
    await page.getByRole('tab', { name: /image/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="image-generator"]')).toHaveScreenshot('content-image-tab.png', {
      maxDiffPixels: 150,
    });
  });
});

test.describe('Visual Regression: UI Components', () => {
  test('button variants', async ({ page }) => {
    await page.goto('/dashboard');
    
    const buttons = page.locator('button').first();
    await expect(buttons).toHaveScreenshot('button-default.png');
  });

  test('card component', async ({ page }) => {
    await page.goto('/dashboard');
    
    const card = page.locator('[data-testid="metric-tile"]').first();
    await expect(card).toHaveScreenshot('metric-card.png', {
      maxDiffPixels: 100,
    });
  });

  test('navigation menu', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('nav, aside').first();
    await expect(nav).toHaveScreenshot('navigation.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression: Responsive', () => {
  test('mobile dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('mobile-dashboard.png', {
      fullPage: true,
      maxDiffPixels: 300,
    });
  });

  test('tablet content studio', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/content');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('tablet-content.png', {
      fullPage: true,
      maxDiffPixels: 300,
    });
  });
});

test.describe('Visual Regression: Dark Mode', () => {
  test('dashboard in dark mode', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Toggle dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      maxDiffPixels: 500,
      threshold: 0.3,
    });
  });

  test('content studio in dark mode', async ({ page }) => {
    await page.goto('/content');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('content-dark.png', {
      maxDiffPixels: 500,
      threshold: 0.3,
    });
  });
});
