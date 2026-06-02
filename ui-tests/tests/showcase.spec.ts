import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

/**
 * Showcase snapshots — wide-screen, visually rich renders used in documentation.
 * These are not regression tests; they capture the UI at its best.
 */
test.use({ autoGoto: false });

test.describe('Showcase', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.uploadFile(
      path.resolve(__dirname, '../../examples/macrostrat.jGIS'),
      'showcase/macrostrat.jGIS',
    );
  });

  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Macrostrat geology overlay', async ({ page }) => {
    await page.goto();
    await page.notebook.openByPath('showcase/macrostrat.jGIS');
    await page.notebook.activate('showcase/macrostrat.jGIS');

    // Wait for the spinner to disappear (tiles loaded)
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    // Dismiss any dialog (e.g. missing file warnings)
    const okBtn = page.getByRole('button', { name: 'Ok' });
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    const main = page.locator('.jp-MainAreaWidget:not(.lm-mod-hidden)');
    await main.waitFor({ state: 'visible' });

    // Allow tiles to finish rendering
    await page.waitForTimeout(8000);

    expect(await main.screenshot({ type: 'jpeg', quality: 80 })).toMatchSnapshot({
      name: 'showcase-macrostrat-geology.jpg',
      maxDiffPixelRatio: 0.02,
    });
  });
});
