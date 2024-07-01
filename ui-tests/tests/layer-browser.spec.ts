import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test
} from '@jupyterlab/galata';
import { Locator } from '@playwright/test';
import path from 'path';

// async function openLayerBrowser(
//   page: IJupyterLabPageFixture
// ): Promise<Locator> {
//   const mainDockPanel = page.locator('#jp-main-dock-panel');
//   if (!(await mainDockPanel.isVisible())) {
//     const panelIcon = page.getByTitle('JupyterGIS Control Panel');
//     await panelIcon.first().click();
//     await page.waitForCondition(async () => await mainDockPanel.isVisible());
//   }
//   return mainDockPanel;
// }

// test.describe('#overview', () => {
//   test('should have a left panel', async ({ page }) => {
//     const panelIcon = page.getByTitle('JupyterGIS Control Panel');
//     await expect(panelIcon).toHaveCount(2);

//     await panelIcon.first().click();

//     const sidePanel = page.locator('#jupytergis\\:\\:leftControlPanel');
//     await expect(sidePanel).toBeVisible();

//     await expect(sidePanel.getByTitle('Layer tree')).toHaveCount(1);
//   });
// });

async function openLayerBrowser(
  page: IJupyterLabPageFixture
): Promise<Locator> {
  const layerBrowser = page.locator('#jupytergis\\:\\:layerBrowser');

  if (!(await layerBrowser.isVisible())) {
    await page.getByTitle('Open Layer Browser').locator('div').click();
    await page.waitForCondition(async () => await layerBrowser.isVisible());
  }
  return layerBrowser;
}

async function getGridTiles(page: IJupyterLabPageFixture): Promise<Locator> {
  const layerBrowser = await openLayerBrowser(page);

  const gridTiles = layerBrowser.locator(
    '.jgis-layer-browser-container .jgis-layer-browser-grid .jgis-layer-browser-tile'
  );

  return gridTiles;
}

test.describe('#layerBrowser', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/examples');
    await content.uploadDirectory(
      path.resolve(__dirname, '../../examples'),
      '/examples'
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('examples/test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('toolbar should have layer browser icon', async ({ page }) => {
    const toolbarIcon = page.getByTitle('Open Layer Browser').locator('div');
    await expect(toolbarIcon).toBeVisible();
  });

  test('layer browser should open when clicked', async ({ page }) => {
    const layerBrowser = await openLayerBrowser(page);
    await expect(layerBrowser).toBeVisible();
  });

  test('layer browser should be populated', async ({ page }) => {
    const layerBrowser = await openLayerBrowser(page);

    const gridTiles = layerBrowser.locator(
      '.jgis-layer-browser-container .jgis-layer-browser-grid .jgis-layer-browser-tile'
    );
    await expect(gridTiles).toHaveCount(32);
  });

  test('search bar should filter tiles', async ({ page }) => {
    const gridTiles = await getGridTiles(page);
    await page.getByPlaceholder('Search...').click();
    await page.getByPlaceholder('Search...').fill('mapnik');
    await expect(gridTiles).toHaveCount(1);
  });

  test('category filters should work', async ({ page }) => {
    const gridTiles = await getGridTiles(page);
    await page.getByText('Strava', { exact: true }).click();
    await expect(gridTiles).toHaveCount(5);
  });

  test('clicking category filter twice should clear filter', async ({
    page
  }) => {
    const gridTiles = await getGridTiles(page);
    await page.getByText('WaymarkedTrails', { exact: true }).click();
    await page.getByText('WaymarkedTrails', { exact: true }).click();
    await expect(gridTiles).toHaveCount(32);
  });

  //   test('raster layer should have icons', async ({ page }) => {
  //     const layersTree = await openLayerBrowser(page);
  //     const layerIcons = layersTree.locator(
  //       '.jp-gis-layer .jp-gis-layerIcon svg'
  //     );

  //     expect(await layerIcons.first().screenshot()).toMatchSnapshot(
  //       'raster-layer-icon.png'
  //     );
  //   });
});
