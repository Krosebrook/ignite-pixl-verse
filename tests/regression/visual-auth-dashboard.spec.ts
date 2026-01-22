/**
 * Visual Regression Tests: Auth & Dashboard
 * Screenshot comparison tests for critical user-facing pages
 */

import { test, expect, type Page } from '@playwright/test';

// Helper to wait for page to stabilize
async function waitForStableRender(page: Page, timeout = 2000) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(timeout);
}

test.describe('Visual Regression: Auth Page', () => {
  test.describe('Desktop Views', () => {
    test('sign in form - default state', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      // Full page screenshot
      await expect(page).toHaveScreenshot('auth-signin-desktop.png', {
        fullPage: true,
        maxDiffPixels: 200,
        threshold: 0.2,
      });
    });

    test('sign in form - with password method', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      // Ensure password tab is active
      await page.getByRole('tab', { name: /password/i }).click();
      await page.waitForTimeout(500);

      const authCard = page.locator('.max-w-md').first();
      await expect(authCard).toHaveScreenshot('auth-signin-password-form.png', {
        maxDiffPixels: 150,
      });
    });

    test('sign in form - magic link method', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await page.getByRole('tab', { name: /magic link/i }).click();
      await page.waitForTimeout(500);

      const authCard = page.locator('.max-w-md').first();
      await expect(authCard).toHaveScreenshot('auth-magic-link-form.png', {
        maxDiffPixels: 150,
      });
    });

    test('sign up form - default state', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await page.getByText(/don't have an account/i).click();
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('auth-signup-desktop.png', {
        fullPage: true,
        maxDiffPixels: 200,
      });
    });

    test('sign up form - with password strength indicator', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await page.getByText(/don't have an account/i).click();
      await page.waitForTimeout(300);

      // Type a password to show strength indicator
      const passwordInput = page.locator('input[id="signup-password"]');
      await passwordInput.fill('TestPass123!');
      await page.waitForTimeout(500);

      const authCard = page.locator('.max-w-md').first();
      await expect(authCard).toHaveScreenshot('auth-signup-password-strength.png', {
        maxDiffPixels: 200,
      });
    });

    test('forgot password form', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await page.getByText(/forgot password/i).click();
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('auth-forgot-password.png', {
        fullPage: true,
        maxDiffPixels: 200,
      });
    });

    test('sign in - rate limit warning state', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      // Simulate multiple failed attempts to show warning
      for (let i = 0; i < 3; i++) {
        await page.getByLabel(/email/i).fill('test@example.com');
        await page.getByLabel(/^password$/i).fill('WrongPassword!');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForTimeout(1500);
      }

      // Screenshot with rate limit warning visible
      await expect(page).toHaveScreenshot('auth-rate-limit-warning.png', {
        fullPage: true,
        maxDiffPixels: 300,
        threshold: 0.3,
      });
    });
  });

  test.describe('Mobile Views', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('sign in form - mobile', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await expect(page).toHaveScreenshot('auth-signin-mobile.png', {
        fullPage: true,
        maxDiffPixels: 200,
      });
    });

    test('sign up form - mobile', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await page.getByText(/don't have an account/i).click();
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('auth-signup-mobile.png', {
        fullPage: true,
        maxDiffPixels: 200,
      });
    });
  });

  test.describe('Tablet Views', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('sign in form - tablet', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      await expect(page).toHaveScreenshot('auth-signin-tablet.png', {
        fullPage: true,
        maxDiffPixels: 250,
      });
    });
  });

  test.describe('Dark Mode', () => {
    test('sign in form - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/auth');
      await waitForStableRender(page);

      await expect(page).toHaveScreenshot('auth-signin-dark.png', {
        fullPage: true,
        maxDiffPixels: 300,
        threshold: 0.25,
      });
    });

    test('sign up form - dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/auth');
      await waitForStableRender(page);

      await page.getByText(/don't have an account/i).click();
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('auth-signup-dark.png', {
        fullPage: true,
        maxDiffPixels: 300,
        threshold: 0.25,
      });
    });
  });

  test.describe('Component States', () => {
    test('Google OAuth button', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      const googleButton = page.getByRole('button', { name: /google/i });
      await expect(googleButton).toHaveScreenshot('auth-google-button.png', {
        maxDiffPixels: 50,
      });
    });

    test('input field focus state', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      const emailInput = page.getByLabel(/email/i);
      await emailInput.focus();
      await page.waitForTimeout(200);

      await expect(emailInput).toHaveScreenshot('auth-input-focused.png', {
        maxDiffPixels: 50,
      });
    });

    test('sign in button hover state', async ({ page }) => {
      await page.goto('/auth');
      await waitForStableRender(page);

      const signInButton = page.getByRole('button', { name: /sign in/i });
      await signInButton.hover();
      await page.waitForTimeout(200);

      await expect(signInButton).toHaveScreenshot('auth-button-hover.png', {
        maxDiffPixels: 50,
      });
    });
  });
});

test.describe('Visual Regression: Dashboard Page', () => {
  test.describe('Desktop Views', () => {
    test('dashboard - loading state', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Capture loading state quickly
      await expect(page).toHaveScreenshot('dashboard-loading.png', {
        fullPage: true,
        maxDiffPixels: 500,
        threshold: 0.3,
      });
    });

    test('dashboard - full page', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page, 3000);

      await expect(page).toHaveScreenshot('dashboard-full-desktop.png', {
        fullPage: true,
        maxDiffPixels: 400,
        threshold: 0.2,
      });
    });

    test('dashboard - sidebar navigation', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page);

      const sidebar = page.locator('aside, [data-testid="sidebar"]').first();
      if (await sidebar.isVisible()) {
        await expect(sidebar).toHaveScreenshot('dashboard-sidebar.png', {
          maxDiffPixels: 150,
        });
      }
    });

    test('dashboard - header section', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page);

      const header = page.locator('header, [data-testid="page-header"]').first();
      if (await header.isVisible()) {
        await expect(header).toHaveScreenshot('dashboard-header.png', {
          maxDiffPixels: 150,
        });
      }
    });
  });

  test.describe('Mobile Views', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('dashboard - mobile view', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page, 3000);

      await expect(page).toHaveScreenshot('dashboard-mobile.png', {
        fullPage: true,
        maxDiffPixels: 400,
      });
    });

    test('dashboard - mobile navigation', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page);

      // Look for mobile nav trigger
      const menuButton = page.getByRole('button', { name: /menu|navigation/i });
      if (await menuButton.isVisible()) {
        await menuButton.click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('dashboard-mobile-nav-open.png', {
          fullPage: true,
          maxDiffPixels: 300,
        });
      }
    });
  });

  test.describe('Tablet Views', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('dashboard - tablet view', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page, 3000);

      await expect(page).toHaveScreenshot('dashboard-tablet.png', {
        fullPage: true,
        maxDiffPixels: 400,
      });
    });
  });

  test.describe('Dark Mode', () => {
    test('dashboard - dark mode full page', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/dashboard');
      await waitForStableRender(page, 3000);

      await expect(page).toHaveScreenshot('dashboard-dark-full.png', {
        fullPage: true,
        maxDiffPixels: 500,
        threshold: 0.25,
      });
    });
  });

  test.describe('Wide Screens', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('dashboard - wide screen', async ({ page }) => {
      await page.goto('/dashboard');
      await waitForStableRender(page, 3000);

      await expect(page).toHaveScreenshot('dashboard-wide.png', {
        fullPage: true,
        maxDiffPixels: 500,
      });
    });
  });
});

test.describe('Visual Regression: Shared Components', () => {
  test('logo and branding', async ({ page }) => {
    await page.goto('/auth');
    await waitForStableRender(page);

    const logo = page.locator('[class*="FlashFusion"], [class*="logo"]').first();
    if (await logo.isVisible()) {
      await expect(logo).toHaveScreenshot('branding-logo.png', {
        maxDiffPixels: 30,
      });
    }
  });

  test('background glow effects', async ({ page }) => {
    await page.goto('/auth');
    await waitForStableRender(page);

    // Screenshot the background area
    await expect(page.locator('body')).toHaveScreenshot('background-effects.png', {
      maxDiffPixels: 500,
      threshold: 0.3,
    });
  });
});
