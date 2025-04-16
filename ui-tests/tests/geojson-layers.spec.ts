import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test
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

test.describe('#geoJSONLayer', () => {
  test.beforeEach(async ({ request, tmpPath }) => {
    const content = galata.newContentsHelper(request);
    await content.uploadFile(
      path.resolve(__dirname, `./gis-files/${FILENAME}`),
      `/${tmpPath}/${FILENAME}`
    );
    await content.uploadFile(
      path.resolve(__dirname, `./gis-files/france_regions.json`),
      `/${tmpPath}/france_regions.json`
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
    const main = panel?.locator('.jGIS-Mainview');

    await page.getByTestId('new-entry-button').click();
    await page.getByText('Add Vector Layer').hover();
    await page
      .locator('#jp-gis-toolbar-vector-menu')
      .getByText('New GeoJSON layer')
      .click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    const fileInput = dialog.locator('input#root_path');
    await fileInput.fill('france_regions.json');
    await fileInput.blur();

    const typeInput = dialog.locator('select#root_type');
    typeInput.selectOption('line');

    await dialog.getByText('Ok', { exact: true }).first().click();

    await expect(dialog).not.toBeAttached();

    await new Promise(_ => setTimeout(_, 1000));

    expect(await main?.screenshot()).toMatchSnapshot('geoJSON-layer.png', {});
  });
});
