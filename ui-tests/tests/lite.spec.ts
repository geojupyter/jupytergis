import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

test.use({ autoGoto: false });

test.describe('UI Test', () => {
  const fileList = ['test.jGIS', 'shapefile.jGIS'];

  test.describe('File operations', () => {
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
        browser
      }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`lab/index.html?path=${file}`, {
          waitUntil: 'domcontentloaded'
        });

        await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

        if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
          await page.getByRole('button', { name: 'Ok' }).click();
        }

        const main = await page.waitForSelector('.jp-MainAreaWidget', {
          state: 'visible'
        });

        await page.waitForTimeout(10000);

        expect(errors).toBe(0);
        if (main) {
          expect(await main.screenshot()).toMatchSnapshot({
            name: `Render-${file}.png`,
            maxDiffPixelRatio: 0.01
          });
        }
      });
    }
  });

  test('Should open jgis.ipynb and execute it', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('lab/index.html?path=jgis.ipynb', {
      waitUntil: 'domcontentloaded'
    });

    const Notebook = await page.waitForSelector('.jp-Notebook', {
      state: 'visible'
    });
    await Notebook.click();

    await page.keyboard.press('Control+Enter');

    await page.locator('.jp-InputArea-prompt >> text="[1]:"').first().waitFor();

    const outputErrors = await page.$$('.jp-OutputArea-error');
    expect(outputErrors.length).toBe(0);

    const jgisWidget = await page.waitForSelector(
      '.jupytergis-notebook-widget',
      {
        state: 'visible'
      }
    );

    await page.waitForTimeout(20000);

    expect(await jgisWidget.screenshot()).toMatchSnapshot({
      name: 'Render-notebook.png',
      maxDiffPixelRatio: 0.01
    });
  });
});
