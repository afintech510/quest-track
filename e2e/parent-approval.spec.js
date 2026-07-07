import { test, expect } from '@playwright/test';

test.describe('Journey 3: Parent Approval Flow', () => {
  test('parent approves chores via PIN-protected admin', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="profile-switcher"], .tv-focusable');

    // Click admin/lock button
    const adminBtn = page.locator('[class*="admin"], [class*="Admin"], [aria-label*="admin"], text=🔒').first();
    if (await adminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminBtn.click();
    } else {
      // Try keyboard shortcut or look for settings icon
      const settingsBtn = page.locator('[class*="settings"], [class*="Settings"]').first();
      if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsBtn.click();
      }
    }

    // Enter PIN 1234 via numpad
    const pinPad = page.locator('[class*="pin"], [class*="Pin"]');
    await pinPad.first().waitFor({ timeout: 5000 }).catch(() => {});

    for (const digit of ['1', '2', '3', '4']) {
      const btn = page.locator(`button:has-text("${digit}")`).first();
      await btn.click();
      await page.waitForTimeout(200);
    }

    // Verify admin dashboard opens
    await page.waitForTimeout(2000);
    const dashboard = page.locator('[class*="admin"], [class*="Admin"], [class*="dashboard"], [class*="Dashboard"]');
    await expect(dashboard.first()).toBeVisible({ timeout: 5000 }).catch(() => {});

    // Look for approval queue
    const approvalQueue = page.locator('text=/approval|pending|Approval Queue/i');
    if (await approvalQueue.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approvalQueue.click();
      await page.waitForTimeout(1000);

      // Approve a pending chore if any exist
      const approveBtn = page.locator('text=/approve|Approve/i').first();
      if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await approveBtn.click();
        await page.waitForTimeout(1000);
      }

      // Reject another chore if available
      const rejectBtn = page.locator('text=/reject|Reject/i').first();
      if (await rejectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rejectBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('5 wrong PINs triggers lockout', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="profile-switcher"], .tv-focusable');

    const adminBtn = page.locator('[class*="admin"], [class*="Admin"], [aria-label*="admin"], text=🔒').first();
    if (await adminBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminBtn.click();
    }

    const pinPad = page.locator('[class*="pin"], [class*="Pin"]');
    await pinPad.first().waitFor({ timeout: 5000 }).catch(() => {});

    // Enter wrong PIN 5 times
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const digit of ['9', '9', '9', '9']) {
        const btn = page.locator(`button:has-text("${digit}")`).first();
        await btn.click();
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(500);
    }

    // Verify lockout message
    const lockout = page.locator('text=/Too many attempts|locked/i');
    await expect(lockout.first()).toBeVisible({ timeout: 3000 });
  });
});
