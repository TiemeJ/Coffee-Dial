import { test, expect } from '@playwright/test';

test('seeded command-flow smoke checks pass without skips', async ({ page }) => {
    await page.goto('/index.html?smoke=1&e2eSeed=1');

    await page.waitForFunction(
        () => {
            const report = window.__coffeeDialSmokeReport;
            return !!report && report.commandFlows?.status !== 'pending';
        },
        null,
        { timeout: 30_000 }
    );

    const report = await page.evaluate(() => window.__coffeeDialSmokeReport);
    const commandFlows = report?.commandFlows || {};
    const flows = Array.isArray(commandFlows.flows) ? commandFlows.flows : [];
    const skipped = flows.filter((flow) => flow.status === 'skip');
    const failed = flows.filter((flow) => flow.status === 'fail');

    expect(report?.missingActions || []).toEqual([]);
    expect(report?.missingElements || []).toEqual([]);
    expect(report?.missingRowDataIds || []).toEqual([]);
    expect(failed, `Failed flows: ${JSON.stringify(failed)}`).toEqual([]);
    expect(skipped, `Skipped flows: ${JSON.stringify(skipped)}`).toEqual([]);
    expect(commandFlows?.ok).toBe(true);
    expect(report?.ok).toBe(true);
});
