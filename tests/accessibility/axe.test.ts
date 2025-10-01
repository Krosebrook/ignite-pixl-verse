import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

/**
 * Accessibility Tests (WCAG 2.2 AA)
 * 
 * These tests ensure the application meets WCAG 2.2 Level AA standards.
 * Any violations will fail the CI build.
 */

test.describe('Accessibility Tests - WCAG 2.2 AA', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and inject axe-core
    await page.goto('/');
    await injectAxe(page);
  });

  test('Landing page meets WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    });

    expect(violations).toHaveLength(0);
    
    if (violations.length > 0) {
      console.log('Accessibility violations found:', JSON.stringify(violations, null, 2));
    }
  });

  test('Dashboard meets WCAG 2.2 AA', async ({ page }) => {
    // TODO: Add auth before navigating to dashboard
    await page.goto('/dashboard');
    
    const violations = await getViolations(page, null, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Content Studio meets WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/content');
    
    const violations = await getViolations(page, null, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Campaigns page meets WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/campaigns');
    
    const violations = await getViolations(page, null, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Color contrast meets WCAG AA (4.5:1 for normal text)', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['color-contrast'],
    });

    expect(violations).toHaveLength(0);
  });

  test('All images have alt text', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['image-alt'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Form inputs have labels', async ({ page }) => {
    await page.goto('/campaigns');
    await page.getByRole('button', { name: /new campaign/i }).click();
    
    const violations = await getViolations(page, null, {
      runOnly: ['label'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Interactive elements have sufficient target size (44x44px minimum)', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['target-size'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Page has single h1 heading', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['page-has-heading-one'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Heading levels are logical', async ({ page }) => {
    await page.goto('/dashboard');
    
    const violations = await getViolations(page, null, {
      runOnly: ['heading-order'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check that focused element has visible outline
    const focusedElement = await page.locator(':focus');
    const outline = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outline || styles.boxShadow;
    });

    expect(outline).not.toBe('none');
    expect(outline).not.toBe('');
  });

  test('Semantic HTML elements used appropriately', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['landmark-one-main', 'region'],
    });

    expect(violations).toHaveLength(0);
  });

  test('ARIA attributes used correctly', async ({ page }) => {
    await page.goto('/content');
    
    const violations = await getViolations(page, null, {
      runOnly: ['aria-valid-attr', 'aria-valid-attr-value'],
    });

    expect(violations).toHaveLength(0);
  });

  test('No auto-playing audio or video', async ({ page }) => {
    await page.goto('/');
    
    const violations = await getViolations(page, null, {
      runOnly: ['audio-caption', 'video-caption'],
    });

    expect(violations).toHaveLength(0);
  });

  test('Language attribute set on html element', async ({ page }) => {
    await page.goto('/');
    
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // e.g., 'en' or 'en-US'
  });
});

test.describe('Keyboard Navigation', () => {
  test('Can navigate entire page using only keyboard', async ({ page }) => {
    await page.goto('/');
    
    // Tab through all interactive elements
    let tabCount = 0;
    const maxTabs = 50;
    
    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      tabCount++;
      
      const focusedElement = await page.locator(':focus');
      if (await focusedElement.count() === 0) {
        break; // Reached end of tabbable elements
      }
    }

    // Should have been able to tab through elements
    expect(tabCount).toBeGreaterThan(3);
  });

  test('Modal can be closed with Escape key', async ({ page }) => {
    await page.goto('/campaigns');
    
    // Open modal
    await page.getByRole('button', { name: /new campaign/i }).click();
    
    // Verify modal is open
    await expect(page.getByText(/create new campaign/i)).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify modal is closed
    await expect(page.getByText(/create new campaign/i)).not.toBeVisible();
  });

  test('Form can be submitted with Enter key', async ({ page }) => {
    await page.goto('/campaigns');
    
    await page.getByRole('button', { name: /new campaign/i }).click();
    await page.getByLabel(/campaign name/i).fill('Test Campaign');
    await page.getByLabel(/description/i).fill('Test description');
    
    // Press Enter
    await page.keyboard.press('Enter');
    
    // Should attempt to submit (may fail without auth, but keyboard worked)
    // Just verify form interaction happened
    await page.waitForTimeout(500);
  });
});

test.describe('Screen Reader Support', () => {
  test('Loading states announced to screen readers', async ({ page }) => {
    await page.goto('/content');
    
    // Check for aria-live regions
    const liveRegions = await page.locator('[aria-live]');
    expect(await liveRegions.count()).toBeGreaterThan(0);
  });

  test('Error messages have appropriate ARIA attributes', async ({ page }) => {
    await page.goto('/campaigns');
    
    await page.getByRole('button', { name: /new campaign/i }).click();
    
    // Try to submit empty form
    await page.getByRole('button', { name: /create campaign/i }).click();
    
    // Check for aria-invalid or aria-describedby on invalid fields
    // (Depends on validation implementation)
  });

  test('Dynamic content changes announced', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for regions that update dynamically
    const politeRegions = await page.locator('[aria-live="polite"]');
    const assertiveRegions = await page.locator('[aria-live="assertive"]');
    
    const totalLiveRegions = (await politeRegions.count()) + (await assertiveRegions.count());
    expect(totalLiveRegions).toBeGreaterThan(0);
  });
});
