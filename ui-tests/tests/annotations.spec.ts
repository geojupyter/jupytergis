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

    await page.getByText('Annotations').click();
    await page.evaluate(() => {
      const el = document.querySelector('canvas');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: rect.left + 10,
          clientY: rect.top + 10,
        }),
      );
    });

    await page.getByText('Add annotation').click();
    await page
      .getByLabel('annotation-test.jGIS')
      .getByPlaceholder('Ctrl+Enter to submit')
      .first()
      .click();
    await page
      .getByLabel('annotation-test.jGIS')
      .getByPlaceholder('Ctrl+Enter to submit')
      .first()
      .fill('this is a test');
    await page
      .locator('.jGIS-Annotation-Buttons')
      .locator('button')
      .nth(1)
      .click();

    // Check map
    await expect(
      page.locator('.jGIS-Annotation-Message').first(),
    ).toContainText('this is a test');

    // Check side panel
    await expect(
      page.getByLabel('Annotations', { exact: true }).getByRole('paragraph'),
    ).toContainText('this is a test');

    // Delete
    await page
      .locator('.jGIS-Annotation-Buttons')
      .locator('button')
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
