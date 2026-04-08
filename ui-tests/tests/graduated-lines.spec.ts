import { galata, test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import path from 'path';

const FILENAME = 'graduated-lines-test.jGIS';

test.describe('#graduatedLines', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open(`testDir/${FILENAME}`);
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('graduated symbology renders on line layer', async ({ page }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Wait for the map and vector layer to render
    await new Promise(_ => setTimeout(_, 2000));

    expect(await main.screenshot()).toMatchSnapshot({
      name: 'graduated-lines-render.png',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('graduated symbology dialog shows correct state for line layer', async ({
    page,
  }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Open the symbology dialog for the graduated line layer
    await page
      .getByText('Roads (Graduated)', { exact: true })
      .click({ button: 'right' });
    await page.getByText('Edit Symbology').click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    // Verify render type is set to Graduated
    const renderTypeSelect = dialog.locator('#render-type-select');
    await expect(renderTypeSelect).toHaveValue('Graduated');

    // Verify the attribute is set to speed_limit
    const attributeSelect = dialog.locator('select[name="vector-value-select"]');
    await expect(attributeSelect).toHaveValue('speed_limit');

    // Verify the "match fill" (strokeFollowsFill) checkbox is checked
    const matchFillCheckbox = dialog
      .locator('label')
      .filter({ hasText: 'match fill' })
      .locator('input[type="checkbox"]');
    await expect(matchFillCheckbox).toBeChecked();

    expect(await dialog.screenshot()).toMatchSnapshot({
      name: 'graduated-lines-dialog.png',
      maxDiffPixelRatio: 0.02,
    });

    await dialog.getByText('Cancel').click();
  });

  test('applying graduated symbology on line layer uses stroke color', async ({
    page,
  }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Open the symbology dialog
    await page
      .getByText('Roads (Graduated)', { exact: true })
      .click({ button: 'right' });
    await page.getByText('Edit Symbology').click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    // Re-apply graduated symbology by clicking OK (tests the bug fix:
    // stroke-color must use the interpolate expr, not the manual style)
    await dialog.getByText('Ok', { exact: true }).first().click();
    await expect(dialog).not.toBeAttached();

    // Wait for re-render
    await new Promise(_ => setTimeout(_, 1000));

    // The map should still show graduated colors on lines
    expect(await main.screenshot()).toMatchSnapshot({
      name: 'graduated-lines-reapply.png',
      maxDiffPixelRatio: 0.02,
    });
  });
});
