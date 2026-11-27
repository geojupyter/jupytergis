import { expect, test } from '@jupyterlab/galata';

test.describe('#newFile', () => {
  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('New file should open with no errors', async ({ page }) => {
    await page.getByText('GIS Project').click();
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const layers = page.getByText('Layers', { exact: true });
    const map = page.locator('.ol-unselectable').first();

    await expect(layers).toBeVisible();
    await expect(map).toBeAttached();
  });
});
