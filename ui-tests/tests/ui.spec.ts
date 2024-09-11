import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

test.use({ autoGoto: false });

test.describe('UI Test', () => {
  const fileList = ['test.jGIS', 'buildings.qgz'];

  test.describe('File operations', () => {
    test.beforeAll(async ({ request }) => {
      const content = galata.newContentsHelper(request);
      await content.deleteDirectory('/testDir');
      await content.uploadDirectory(
        path.resolve(__dirname, './gis-files'),
        '/testDir'
      );
    });
    let errors = 0;
    test.beforeEach(async ({ page }) => {
      const unrelatedErrors = [
        // This error is related to plotly dependency, installed with qgis.
        "@jupyter-widgets/base doesn't exist in shared scope default"
      ];
      page.setViewportSize({ width: 1920, height: 1080 });
      page.on('console', message => {
        if (message.type() === 'error') {
          for (let pattern of unrelatedErrors) {
            if (message.text().includes(pattern)) {
              return;
            }
          }
          console.log('CONSOLE ERROR', message);
          errors += 1;
        }
      });
    });

    test.afterEach(async ({ page }) => {
      errors = 0;
    });

    for (const file of fileList) {
      test(`Should be able to render ${file} without error`, async ({
        page
      }) => {
        await page.goto();
        const fullPath = `testDir/${file}`;
        await page.notebook.openByPath(fullPath);
        await page.notebook.activate(fullPath);
        await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });
        await page.waitForTimeout(1000);
        if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
          await page.getByRole('button', { name: 'Ok' }).click();
        }
        await page
          .getByRole('tablist', { name: 'main sidebar' })
          .getByRole('tab', { name: 'JupyterGIS Control Panel' })
          .click();
        await page
          .getByRole('tablist', { name: 'alternate sidebar' })
          .getByRole('tab', { name: 'JupyterGIS Control Panel' })
          .click();
        await page.waitForTimeout(1000);
        expect(errors).toBe(0);

        await expect(page.locator('.ol-unselectable').first()).toBeAttached();
      });
    }
  });
});
