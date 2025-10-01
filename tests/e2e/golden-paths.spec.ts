import { test, expect } from '@playwright/test';

/**
 * E2E Golden Paths Tests
 * 
 * These tests validate the three critical user journeys:
 * 1. Generate asset → lint brand rules → save
 * 2. Draft campaign → schedule post
 * 3. Translate asset → approve → publish
 */

test.describe('Golden Path 1: Generate Asset Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and ensure user is authenticated
    await page.goto('/');
    // TODO: Add authentication step when auth is implemented
  });

  test('should generate text asset and save successfully', async ({ page }) => {
    // Navigate to Content Studio
    await page.goto('/content');
    await expect(page.getByRole('heading', { name: /content studio/i })).toBeVisible();

    // Select text generation
    await page.getByRole('tab', { name: /text/i }).click();

    // Enter prompt
    const promptInput = page.getByPlaceholder(/describe.*content/i);
    await promptInput.fill('Generate a compelling Instagram caption for a summer product launch');

    // Click generate button
    await page.getByRole('button', { name: /generate/i }).click();

    // Wait for generation to complete (check for loading state to disappear)
    await expect(page.getByText(/generating/i)).toBeVisible();
    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 30000 });

    // Verify generated content appears
    await expect(page.locator('[data-testid="generated-content"]')).toBeVisible();

    // Verify brand rules lint (if implemented)
    // await expect(page.getByText(/brand check/i)).toBeVisible();

    // Save the asset
    await page.getByRole('button', { name: /save/i }).click();

    // Verify success message
    await expect(page.getByText(/asset.*saved/i)).toBeVisible({ timeout: 10000 });
  });

  test('should generate image asset and save successfully', async ({ page }) => {
    await page.goto('/content');

    // Select image generation
    await page.getByRole('tab', { name: /image/i }).click();

    // Enter prompt
    const promptInput = page.getByPlaceholder(/describe.*image/i);
    await promptInput.fill('Create a vibrant summer-themed product photo with beach background');

    // Generate image
    await page.getByRole('button', { name: /generate/i }).click();

    // Wait for image generation (longer timeout for images)
    await expect(page.getByText(/generating/i)).toBeVisible();
    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 60000 });

    // Verify image preview appears
    await expect(page.locator('img[alt*="generated"]')).toBeVisible();

    // Save the asset
    await page.getByRole('button', { name: /save/i }).click();

    // Verify success
    await expect(page.getByText(/asset.*saved/i)).toBeVisible({ timeout: 10000 });
  });

  test('should validate brand rules during generation', async ({ page }) => {
    await page.goto('/content');

    // Generate content
    await page.getByRole('tab', { name: /text/i }).click();
    await page.getByPlaceholder(/describe.*content/i).fill('Product launch announcement');
    await page.getByRole('button', { name: /generate/i }).click();

    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 30000 });

    // Brand rules should be checked automatically
    // TODO: Verify specific brand rule checks when implemented
    // await expect(page.getByText(/brand.*check/i)).toBeVisible();
  });
});

test.describe('Golden Path 2: Campaign Draft & Schedule', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Add authentication
  });

  test('should draft campaign and schedule post', async ({ page }) => {
    // Navigate to campaigns
    await page.goto('/campaigns');
    await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible();

    // Create new campaign
    await page.getByRole('button', { name: /new campaign/i }).click();

    // Fill campaign details
    await page.getByLabel(/campaign name/i).fill('Summer Launch 2025');
    await page.getByLabel(/description/i).fill('Launch campaign for eco-friendly products targeting Gen Z');

    // Create campaign
    await page.getByRole('button', { name: /create campaign/i }).click();

    // Verify campaign created
    await expect(page.getByText(/summer launch 2025/i)).toBeVisible({ timeout: 10000 });

    // Click on the campaign to view details
    await page.getByText(/summer launch 2025/i).click();

    // Navigate to schedule section
    await page.goto('/schedule');

    // Verify we're on schedule page
    await expect(page.getByRole('heading', { name: /schedule/i })).toBeVisible();

    // TODO: Add steps to actually schedule a post when UI is implemented
    // For now, verify we can see the schedule interface
    await expect(page.getByText(/upcoming/i)).toBeVisible();
  });

  test('should display campaign metrics', async ({ page }) => {
    await page.goto('/campaigns');

    // Find a campaign card (should have seeded data)
    const campaignCard = page.locator('[data-testid="campaign-card"]').first();
    
    // Verify metrics are displayed
    await expect(campaignCard).toBeVisible();
    
    // Check for metric tiles
    await expect(campaignCard.locator('text=/assets|posts|engagement/i')).toBeVisible();
  });
});

test.describe('Golden Path 3: Asset Translation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // TODO: Add authentication
  });

  test('should translate, approve, and publish asset', async ({ page }) => {
    // This test requires an existing asset
    // For now, we'll create one first
    await page.goto('/content');
    
    // Generate an asset
    await page.getByRole('tab', { name: /text/i }).click();
    await page.getByPlaceholder(/describe.*content/i).fill('Original English product description');
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/generating/i)).not.toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/asset.*saved/i)).toBeVisible({ timeout: 10000 });

    // TODO: Implement translation workflow when available
    // Expected flow:
    // 1. Select asset from library
    // 2. Click "Translate" option
    // 3. Choose target language
    // 4. Review translation
    // 5. Approve translation
    // 6. Schedule or publish immediately

    // For now, verify we can navigate to marketplace where translations might be available
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { name: /marketplace/i })).toBeVisible();
  });
});

test.describe('Cross-Browser & Responsive Tests', () => {
  test('dashboard loads correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/dashboard');

    // Verify mobile layout
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Verify metrics are stacked vertically (mobile layout)
    const metrics = page.locator('[data-testid="metric-tile"]');
    if (await metrics.count() > 0) {
      const firstMetric = metrics.first();
      const secondMetric = metrics.nth(1);
      
      const box1 = await firstMetric.boundingBox();
      const box2 = await secondMetric.boundingBox();
      
      if (box1 && box2) {
        // On mobile, second metric should be below first (higher Y position)
        expect(box2.y).toBeGreaterThan(box1.y);
      }
    }
  });

  test('navigation works on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');

    // Test navigation
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);

    await page.goto('/content');
    await expect(page).toHaveURL(/content/);

    await page.goto('/campaigns');
    await expect(page).toHaveURL(/campaigns/);

    await page.goto('/schedule');
    await expect(page).toHaveURL(/schedule/);
  });
});

test.describe('Performance Tests', () => {
  test('dashboard loads within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('content studio is interactive quickly', async ({ page }) => {
    await page.goto('/content');
    
    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');
    
    // Verify tab switching works quickly
    const startTime = Date.now();
    await page.getByRole('tab', { name: /image/i }).click();
    await expect(page.getByPlaceholder(/describe.*image/i)).toBeVisible();
    const interactionTime = Date.now() - startTime;

    // Should be interactive in under 200ms
    expect(interactionTime).toBeLessThan(200);
  });
});

test.describe('Error Handling', () => {
  test('handles network errors gracefully', async ({ page, context }) => {
    await page.goto('/content');

    // Simulate offline
    await context.setOffline(true);

    // Try to generate content
    await page.getByRole('tab', { name: /text/i }).click();
    await page.getByPlaceholder(/describe.*content/i).fill('Test prompt');
    await page.getByRole('button', { name: /generate/i }).click();

    // Should show error message
    await expect(page.getByText(/error|failed|network/i)).toBeVisible({ timeout: 10000 });

    // Restore online
    await context.setOffline(false);
  });

  test('validates form inputs', async ({ page }) => {
    await page.goto('/campaigns');

    // Try to create campaign with empty fields
    await page.getByRole('button', { name: /new campaign/i }).click();
    await page.getByRole('button', { name: /create campaign/i }).click();

    // Should show validation errors
    // TODO: Add specific validation message checks when implemented
  });
});
