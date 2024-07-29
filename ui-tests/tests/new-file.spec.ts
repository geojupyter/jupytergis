import { expect, test } from '@jupyterlab/galata';

test.describe('#newFile', () => {
  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('New file should open with no errors', async ({ page }) => {
    await page
      .getByLabel('notebook content')
      .getByText('New JGIS File')
      .click();

    const tab = page.getByLabel('notebook content');
    const sources = page.getByText('Sources', { exact: true });
    const layers = page.getByText('Layers');
    const map = page.getByLabel('Map');

    await expect(tab).toBeVisible();
    await expect(sources).toBeVisible();
    await expect(layers).toBeVisible();
    await expect(map).toBeVisible();
  });
});
