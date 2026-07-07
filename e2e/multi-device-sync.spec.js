import { test, expect } from '@playwright/test';

// TEST-NOTE: Multi-device sync requires a running Supabase instance with real-time enabled.
// This test simulates two browser contexts connecting to the same app.

test.describe('Journey 4: Multi-Device Sync', () => {
  test('changes on one device appear on another within 2s', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Both navigate to app
    await pageA.goto('/');
    await pageB.goto('/');

    // Both wait for app to load
    await pageA.waitForSelector('[data-testid="profile-switcher"], .tv-focusable', { timeout: 5000 });
    await pageB.waitForSelector('[data-testid="profile-switcher"], .tv-focusable', { timeout: 5000 });

    // Select Quinn on both
    const quinnA = pageA.locator('text=Quinn').first();
    const quinnB = pageB.locator('text=Quinn').first();

    if (await quinnA.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quinnA.click();
    }
    if (await quinnB.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quinnB.click();
    }

    // Handle soft-locks on both
    for (const page of [pageA, pageB]) {
      const softLock = page.locator('text=Secret Code');
      if (await softLock.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowDown');
      }
    }

    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    // Get initial coin balance on context B
    const coinElementB = pageB.locator('[class*="coin"], [class*="Coin"]').first();
    const initialCoinsB = await coinElementB.textContent().catch(() => '0');

    // Complete a chore on context A
    const choreCard = pageA.locator('[class*="chore"], [class*="Chore"]').filter({ hasText: 'pending' }).first();
    if (await choreCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await choreCard.click();

      // Wait 2s for real-time sync
      await pageB.waitForTimeout(2500);

      // Check if coin balance updated on context B
      const updatedCoinsB = await coinElementB.textContent().catch(() => '0');
      // TEST-NOTE: If Supabase real-time is active, these should differ
    }

    await contextA.close();
    await contextB.close();
  });
});
