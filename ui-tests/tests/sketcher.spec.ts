import { expect, test, galata } from '@jupyterlab/galata';
import path from 'path';

test.use({ autoGoto: false });

test.describe('Sketcher test', () => {
  let errors = 0;
  test.beforeEach(async ({ page, request }) => {
    page.setViewportSize({ width: 1920, height: 1080 });
    page.on('console', message => {
      if (message.type() === 'error') {
        errors += 1;
      }
    });

    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/examples');
    await content.uploadDirectory(
      path.resolve(__dirname, '../../examples'),
      '/examples'
    );
  });

  test.afterEach(async ({ page }) => {
    errors = 0;
  });

  test(`Should open the sketcher dialog`, async ({ page }) => {
    await page.goto();

    const fileName = 'test.jcad';
    const fullPath = `examples/${fileName}`;
    await page.notebook.openByPath(fullPath);
    await page.notebook.activate(fullPath);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    await page.waitForTimeout(1000);
    if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
      await page.getByRole('button', { name: 'Ok' }).click();
    }
    // Close the property panel
    await page
      .getByRole('tablist', { name: 'alternate sidebar' })
      .getByRole('tab', { name: 'JupyterGIS Control Panel' })
      .click();

    await page.getByTitle('New Sketch').click();
    const dialog = await page.$('.lm-Widget.lm-Panel.jp-Dialog-content');
    if (dialog) {
      expect(await dialog.screenshot()).toMatchSnapshot({
        name: `Sketcher-Display-${fileName}.png`,
        maxDiffPixelRatio: 0.01
      });
    }
  });

  test(`Should draw a circle`, async ({ page }) => {
    await page.goto();

    const fileName = 'test.jcad';
    const fullPath = `examples/${fileName}`;
    await page.notebook.openByPath(fullPath);
    await page.notebook.activate(fullPath);
    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    await page.waitForTimeout(1000);
    if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
      await page.getByRole('button', { name: 'Ok' }).click();
    }
    // Close the property panel
    await page
      .getByRole('tablist', { name: 'alternate sidebar' })
      .getByRole('tab', { name: 'JupyterGIS Control Panel' })
      .click();

    await page.getByTitle('New Sketch').click();
    await page.getByRole('button', { name: 'CIRCLE' }).click();
    await page
      .locator('canvas')
      .nth(1)
      .click({
        position: {
          x: 455,
          y: 209
        }
      });
    await page
      .locator('canvas')
      .nth(1)
      .click({
        position: {
          x: 455,
          y: 335
        }
      });
    const dialog = await page.$('.lm-Widget.lm-Panel.jp-Dialog-content');
    if (dialog) {
      expect(await dialog.screenshot()).toMatchSnapshot({
        name: `Sketcher-Circle-${fileName}.png`,
        maxDiffPixelRatio: 0.01
      });
    }
  });
});
