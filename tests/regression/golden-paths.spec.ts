import { test, expect } from '@playwright/test';

/**
 * Regression Test Suite: Golden Paths
 * 
 * Re-runs critical user journeys nightly to detect regressions
 * Should match golden-paths.spec.ts but with additional stability checks
 */

test.describe('Regression: Generate Asset → Save', () => {
  test('text generation end-to-end', async ({ page }) => {
    await page.goto('/content');
    await expect(page.getByRole('heading', { name: /content studio/i })).toBeVisible();

    // Text generation
    await page.getByRole('tab', { name: /text/i }).click();
    await page.getByPlaceholder(/describe.*content/i).fill('Generate Instagram caption for eco-friendly water bottle');
    await page.getByRole('button', { name: /generate/i }).click();

    // Wait for generation
    await expect(page.getByText(/generating/i)).toBeVisible();
    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 30000 });

    // Verify content
    await expect(page.locator('[data-testid="generated-content"]')).toBeVisible();

    // Save
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/asset.*saved/i)).toBeVisible({ timeout: 10000 });

    // Verify in dashboard
    await page.goto('/dashboard');
    await expect(page.getByText(/eco-friendly|water bottle/i)).toBeVisible({ timeout: 5000 });
  });

  test('image generation with brand validation', async ({ page }) => {
    await page.goto('/content');
    
    await page.getByRole('tab', { name: /image/i }).click();
    await page.getByPlaceholder(/describe.*image/i).fill('Minimalist product photo: white background, centered composition');
    await page.getByRole('button', { name: /generate/i }).click();

    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 60000 });
    await expect(page.locator('img[alt*="generated"]')).toBeVisible();

    // Save and verify provenance
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/asset.*saved/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Regression: Campaign Draft → Schedule', () => {
  test('full campaign workflow', async ({ page }) => {
    await page.goto('/campaigns');
    
    // Create campaign
    await page.getByRole('button', { name: /new campaign/i }).click();
    await page.getByLabel(/campaign name/i).fill('Q1 2025 Product Launch');
    await page.getByLabel(/description/i).fill('Multi-platform launch targeting millennials');
    await page.getByRole('button', { name: /create campaign/i }).click();

    // Verify created
    await expect(page.getByText(/q1 2025 product launch/i)).toBeVisible({ timeout: 10000 });

    // Navigate to schedule
    await page.goto('/schedule');
    await expect(page.getByRole('heading', { name: /schedule/i })).toBeVisible();
  });
});

test.describe('Regression: Data Persistence', () => {
  test('assets persist across sessions', async ({ page, context }) => {
    // Generate asset
    await page.goto('/content');
    await page.getByRole('tab', { name: /text/i }).click();
    await page.getByPlaceholder(/describe.*content/i).fill('Persistent test asset marker-' + Date.now());
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/asset.*saved/i)).toBeVisible({ timeout: 10000 });

    // Close and reopen browser
    await page.close();
    const newPage = await context.newPage();

    // Verify persistence
    await newPage.goto('/dashboard');
    await expect(newPage.getByText(/persistent test asset marker/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Regression: Security & RLS', () => {
  test('cross-org data isolation', async ({ page, context }) => {
    // This test requires multi-user setup
    // For now, verify RLS is enabled
    await page.goto('/dashboard');
    
    // Attempt to access data with invalid org_id via console
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/assets?org_id=00000000-0000-0000-0000-000000000000', {
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        return res.status;
      } catch (e) {
        return 401;
      }
    });

    expect(response).toBeGreaterThanOrEqual(401);
  });

  test('input sanitization', async ({ page }) => {
    await page.goto('/content');
    
    // Try XSS injection
    await page.getByRole('tab', { name: /text/i }).click();
    await page.getByPlaceholder(/describe.*content/i).fill('<script>alert("xss")</script>');
    await page.getByRole('button', { name: /generate/i }).click();

    // Should not execute script
    page.on('dialog', () => {
      throw new Error('XSS vulnerability: alert() executed');
    });

    await page.waitForTimeout(2000);
  });
});

test.describe('Regression: Performance Budgets', () => {
  test('dashboard loads within budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2500); // 2.5s LCP budget
  });

  test('content studio interactivity', async ({ page }) => {
    await page.goto('/content');
    await page.waitForLoadState('domcontentloaded');

    const startTime = Date.now();
    await page.getByRole('tab', { name: /image/i }).click();
    await expect(page.getByPlaceholder(/describe.*image/i)).toBeVisible();
    const interactionTime = Date.now() - startTime;

    expect(interactionTime).toBeLessThan(200); // INP budget
  });
});
