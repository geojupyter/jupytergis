import path from 'path';

import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test,
} from '@jupyterlab/galata';
import { Locator } from '@playwright/test';

async function openLayerBrowser(
  page: IJupyterLabPageFixture,
): Promise<Locator> {
  const layerBrowser = page.locator('#jupytergis\\:\\:layerBrowser');

  if (!(await layerBrowser.isVisible())) {
    await page
      .getByTitle(
        'Open the layer browser dialog to browse and add available layers to the current JupyterGIS document.',
      )
      .click();
    await page.waitForCondition(async () => await layerBrowser.isVisible());
  }
  return layerBrowser;
}

async function getGridTiles(page: IJupyterLabPageFixture): Promise<Locator> {
  const layerBrowser = await openLayerBrowser(page);

  const gridTiles = layerBrowser.locator(
    '.jGIS-layer-browser-container .jGIS-layer-browser-grid .jGIS-layer-browser-tile',
  );

  return gridTiles;
}

test.describe('#layerBrowser', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('toolbar should have layer browser icon', async ({ page }) => {
    const toolbarIcon = page.getByTitle(
      'Open the layer browser dialog to browse and add available layers to the current JupyterGIS document.',
    );
    await expect(toolbarIcon).toBeVisible();
  });

  test('layer browser should open when clicked', async ({ page }) => {
    const layerBrowser = await openLayerBrowser(page);
    await expect(layerBrowser).toBeVisible();
  });

  test('layer browser should be populated', async ({ page }) => {
    const layerBrowser = await openLayerBrowser(page);

    const gridTiles = layerBrowser.locator(
      '.jGIS-layer-browser-container .jGIS-layer-browser-grid .jGIS-layer-browser-tile',
    );
    const numberOfTiles = await gridTiles.count();

    expect(numberOfTiles).toBeGreaterThan(0);
  });

  test('search bar should filter tiles', async ({ page }) => {
    const gridTiles = await getGridTiles(page);
    await page.getByPlaceholder('Search...').click();
    await page.getByPlaceholder('Search...').fill('mapnik');
    await expect(gridTiles).toHaveCount(2);
  });

  test('category filters should work', async ({ page }) => {
    const gridTiles = await getGridTiles(page);
    await page.getByText('Strava', { exact: true }).click();
    await expect(gridTiles).toHaveCount(6);
  });

  test('clicking category filter twice should clear filter', async ({
    page,
  }) => {
    const gridTiles = await getGridTiles(page);
    const numberOfTiles = await gridTiles.count();
    await page.getByText('WaymarkedTrails', { exact: true }).click();
    await page.getByText('WaymarkedTrails', { exact: true }).click();
    await expect(gridTiles).toHaveCount(numberOfTiles);
  });
});
