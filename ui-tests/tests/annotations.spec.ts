import { galata, test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import path from 'path';

test.describe('#annotations', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/annotation-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('Should be able to add an annotation', async ({ page }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    await page.locator('canvas').click({
      button: 'right',
      position: {
        x: 253,
        y: 194,
      },
    });

    await page.getByText('Annotations').click();
    await page.getByText('Add annotation').click();
    await page
      .getByLabel('annotation-test.jGIS')
      .getByPlaceholder('Ctrl+Enter to submit')
      .click();
    await page
      .getByLabel('annotation-test.jGIS')
      .getByPlaceholder('Ctrl+Enter to submit')
      .fill('this is a test');
    await page
      .getByRole('region', { name: 'notebook content' })
      .getByRole('button')
      .nth(1)
      .click();

    // Check map
    await expect(
      page.getByLabel('annotation-test.jGIS').getByRole('paragraph'),
    ).toContainText('this is a test');

    // Check side panel
    await expect(
      page.getByLabel('Annotations', { exact: true }).getByRole('paragraph'),
    ).toContainText('this is a test');

    // Delete
    await page
      .getByRole('region', { name: 'notebook content' })
      .getByRole('button')
      .first()
      .click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(
      page
        .getByLabel('annotation-test.jGIS')
        .locator('div')
        .filter({ hasText: /^AHthis is a test$/ })
        .nth(2),
    ).not.toBeVisible();
  });
});
