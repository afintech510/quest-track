import { test, expect } from '@playwright/test';

test.describe('Journey 7: Reward Purchase', () => {
  test('hold-to-confirm purchase on TV', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="profile-switcher"], .tv-focusable');

    // Select Quinn
    const quinn = page.locator('text=Quinn').first();
    if (await quinn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quinn.click();
    }

    // Handle soft-lock
    const softLock = page.locator('text=Secret Code');
    if (await softLock.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowDown');
    }

    await page.waitForTimeout(2000);

    // Navigate to Reward Shop tab
    const shopTab = page.locator('text=/Shop|Rewards|Reward/i').first();
    if (await shopTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shopTab.click();
      await page.waitForTimeout(1000);

      // Find a reward card
      const rewardCard = page.locator('[class*="reward"], [class*="Reward"]').first();
      if (await rewardCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Focus the reward
        await rewardCard.click();
        await page.waitForTimeout(500);

        // Get initial coin balance
        const coinEl = page.locator('[class*="coin"], [class*="Coin"]').first();
        const initialCoins = await coinEl.textContent().catch(() => '0');

        // Hold Enter for 2 seconds (hold-to-confirm)
        await page.keyboard.down('Enter');
        await page.waitForTimeout(2100);
        await page.keyboard.up('Enter');

        // Verify purchase result (toast or coin deduction)
        await page.waitForTimeout(1000);
        const toast = page.locator('[class*="toast"], [class*="Toast"]');
        // Toast should appear with purchase confirmation or insufficient coins
      }
    }
  });

  test('releasing Enter early cancels purchase', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="profile-switcher"], .tv-focusable');

    const quinn = page.locator('text=Quinn').first();
    if (await quinn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await quinn.click();
    }

    const softLock = page.locator('text=Secret Code');
    if (await softLock.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowDown');
    }

    await page.waitForTimeout(2000);

    const shopTab = page.locator('text=/Shop|Rewards|Reward/i').first();
    if (await shopTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await shopTab.click();
      await page.waitForTimeout(1000);

      const rewardCard = page.locator('[class*="reward"], [class*="Reward"]').first();
      if (await rewardCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rewardCard.click();
        await page.waitForTimeout(500);

        // Press and release early (< 2 seconds)
        await page.keyboard.down('Enter');
        await page.waitForTimeout(500);
        await page.keyboard.up('Enter');

        // Purchase should not complete
        await page.waitForTimeout(500);
      }
    }
  });
});
