import { expect, test } from '@jupyterlab/galata';

/**
 * Showcase snapshots — wide-screen, visually rich renders used in documentation.
 * These are not regression tests; they capture the UI at its best.
 */
test.use({ autoGoto: false });

test.describe('Showcase', () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Macrostrat geology overlay', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    await page.goto('lab/index.html?path=macrostrat.jGIS', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the spinner to disappear (tiles loaded)
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    // Dismiss any dialog (e.g. missing file warnings)
    const okBtn = page.getByRole('button', { name: 'Ok' });
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    const main = await page.waitForSelector('.jp-MainAreaWidget', {
      state: 'visible',
    });

    // Allow tiles to finish rendering
    await page.waitForTimeout(8000);

    expect(await main.screenshot()).toMatchSnapshot({
      name: 'showcase-macrostrat-geology.png',
      maxDiffPixelRatio: 0.02,
    });
  });
});
