import { galata, test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import path from 'path';

test.describe('#filters', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/filter-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('filters should apply and be removed', async ({ page }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    /// Open Layer
    await page.getByText('Custom GeoJSON Layer', { exact: true }).click();

    // Add first filter
    await page.getByRole('button', { name: 'Add' }).click();
    await page.locator('#jp-gis-feature-select-0').selectOption('mag');
    await page.locator('#jp-gis-operator-select-0').selectOption('>');
    await page.locator('#jp-gis-value-select-0').selectOption('2.73');
    await page.getByRole('button', { name: 'Submit' }).click();

    // Add second filter
    await page.getByRole('button', { name: 'Add' }).click();
    await page.locator('#jp-gis-feature-select-1').selectOption('felt');
    await page.locator('#jp-gis-operator-select-1').selectOption('>');
    await page.locator('#jp-gis-value-select-1').selectOption('10');
    await page.getByRole('button', { name: 'Submit' }).click();

    expect(await main.screenshot()).toMatchSnapshot({
      name: 'two-filter.png',
      maxDiffPixelRatio: 0.01,
    });

    // Remove filter
    await page.locator('#jp-gis-remove-filter-1').click();

    expect(await main.screenshot()).toMatchSnapshot({
      name: 'one-filter.png',
      maxDiffPixelRatio: 0.01,
    });

    // Clear filters
    await page.getByRole('button', { name: 'Clear' }).click();

    expect(await main.screenshot()).toMatchSnapshot({
      name: 'no-filter.png',
      maxDiffPixelRatio: 0.01,
    });
  });
});
