import { test, expect } from '@playwright/test';

const waitForTableReady = async (page, selector) => {
    await expect(page.locator(selector)).toBeVisible();
    await page.waitForTimeout(100);
};

const openMenuItem = async (page, itemSelector) => {
    await page.locator('#mainMenuBtn').click();
    await expect(page.locator('#mainMenuDropdown')).toBeVisible();
    await page.locator(itemSelector).click();
};

test('happy flow: add brew for new coffee creates coffee type, bean, and brew', async ({ page }) => {
    await page.goto('/index.html?smoke=1&e2eSeed=1');

    await page.waitForFunction(
        () => {
            const report = window.__coffeeDialSmokeReport;
            return !!report && report.commandFlows?.status !== 'pending';
        },
        null,
        { timeout: 30_000 }
    );

    const initialCounts = await page.evaluate(() => window.__coffeeDialApp?.getE2EStateSnapshot?.()?.counts || null);
    expect(initialCounts).toBeTruthy();

    const suffix = Date.now().toString().slice(-6);
    const roaster = `Smoke Roaster ${suffix}`;
    const farmer = `Smoke Farmer ${suffix}`;

    await page.locator('#menuAddBrewBtn').click();
    await expect(page.locator('#brewFormModal')).toBeVisible();
    await expect(page.locator('#coffeeForm')).toBeVisible();

    await page.locator('#savedBeanSelect').selectOption('');
    await page.locator('#roaster').fill(roaster);
    await page.locator('#farmer').fill(farmer);
    await page.locator('#origin').fill('Ethiopia');
    await page.locator('#processing').fill('Natural');
    await page.locator('#variety').fill('Heirloom');
    await page.locator('#roastType').selectOption('Light');
    await page.locator('#method').selectOption('V60');
    await page.locator('#drinkType').selectOption('Filter Coffee');
    await page.locator('#inputWeight').fill('15');
    await page.locator('#inputYield').fill('240');
    await page.locator('#time').fill('165');
    await page.locator('#notes').fill('Smoke test add flow');

    await page.locator('#brewFormModal [data-action-click="submitBrewFormModal(event)"]').click();
    await page.waitForFunction(
        (before) => {
            const counts = window.__coffeeDialApp?.getE2EStateSnapshot?.()?.counts;
            if (!counts) return false;
            return (
                counts.brews === before.brews + 1 &&
                counts.beans === before.beans + 1 &&
                counts.coffeeTypes === before.coffeeTypes + 1
            );
        },
        initialCounts,
        { timeout: 10_000 }
    );

    await openMenuItem(page, '#menuBeansBtn');
    await waitForTableReady(page, '#beansTableBody');
    await expect(page.locator('#beansTableBody tr td').filter({ hasText: farmer }).first()).toBeVisible();
    await page.locator('#beansModal [data-action-click="closeBeans()"]').click();

    await openMenuItem(page, '#menuCoffeesBtn');
    await waitForTableReady(page, '#coffeeTypesTableBody');
    await expect(page.locator('#coffeeTypesTableBody tr td').filter({ hasText: roaster }).first()).toBeVisible();
    await page.locator('#coffeeTypesModal [data-action-click="closeCoffeeTypes()"]').click();

    const finalCounts = await page.evaluate(() => window.__coffeeDialApp?.getE2EStateSnapshot?.()?.counts || null);
    expect(finalCounts).toEqual({
        brews: initialCounts.brews + 1,
        beans: initialCounts.beans + 1,
        coffeeTypes: initialCounts.coffeeTypes + 1
    });
});
