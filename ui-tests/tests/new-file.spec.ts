import { expect, test } from '@jupyterlab/galata';

test.describe('#newFile', () => {
  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('New file should open with no errors', async ({ page }) => {
    await page.getByLabel('notebook content').getByText('GIS File').click();

    const tab = page.getByLabel('notebook content');
    const layers = page.getByText('Layers', { exact: true });
    const map = page.locator('.ol-unselectable').first();

    await expect(tab).toBeVisible();
    await expect(layers).toBeVisible();
    await expect(map).toBeAttached();
  });
});
