import {
  expect,
  test,
  galata,
  IJupyterLabPageFixture
} from '@jupyterlab/galata';
import { Locator } from '@playwright/test';
import path from 'path';

const FILENAME = 'empty-france.jGIS';

const openGIS = async (
  page: IJupyterLabPageFixture,
  tmpPath: string,
  filename: string
): Promise<Locator> => {
  const panel = await page.activity.getPanelLocator(filename);
  if (panel !== null && (await panel.count())) {
    return panel;
  }

  await page.filebrowser.open(`/${tmpPath}/${filename}`);
  await page.waitForCondition(
    async () => await page.activity.isTabActive(filename)
  );
  return (await page.activity.getPanelLocator(filename)) as Locator;
};

test.beforeAll(async ({ request }) => {
  const content = galata.newContentsHelper(request);
  await content.deleteDirectory('/examples');
  await content.uploadDirectory(
    path.resolve(__dirname, '../../examples'),
    '/examples'
  );
});

test.describe('#geoJSONLayer', () => {
  test.beforeEach(async ({ request, tmpPath }) => {
    const content = galata.newContentsHelper(request);
    await content.uploadFile(
      path.resolve(__dirname, `./gis-files/${FILENAME}`),
      `/${tmpPath}/${FILENAME}`
    );
  });

  test.afterEach(async ({ page, tmpPath }) => {
    await page.activity.closeAll();
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('Add a GeoJSON layer', async ({ page, tmpPath }) => {
    const panel = await openGIS(page, tmpPath, FILENAME);
    const button = panel?.locator(
      'jp-button[data-command="jupytergis:newGeoJSONLayer"]'
    );
    const main = panel?.locator('.jGIS-Mainview');

    await button?.click();

    const dialog = page.locator('.jGIS-geoJSONLayer-FormDialog');
    await expect(dialog).toBeAttached();

    const fileInput = dialog.getByLabel('path');
    await fileInput.fill('france_regions.json');

    const typeInput = dialog.getByLabel('type');
    typeInput.selectOption('line');

    await dialog.getByText('Ok', { exact: true }).first().click();

    await expect(dialog).not.toBeAttached();

    await new Promise((_) => setTimeout(_, 500));

    expect(await main?.screenshot()).toMatchSnapshot('geoJSON-layer.png', {});
  });
});
