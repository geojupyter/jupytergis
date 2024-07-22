import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test
} from '@jupyterlab/galata';
import { Locator } from '@playwright/test';
import path from 'path';

async function openLeftPanel(page: IJupyterLabPageFixture): Promise<Locator> {
  const sidePanel = page.locator('#jupytergis\\:\\:leftControlPanel');
  if (!(await sidePanel.isVisible())) {
    const panelIcon = page.getByTitle('JupyterGIS Control Panel');
    await panelIcon.first().click();
    await page.waitForCondition(async () => await sidePanel.isVisible());
  }
  return sidePanel;
}

async function openLayerTree(page: IJupyterLabPageFixture): Promise<Locator> {
  const sidePanel = await openLeftPanel(page);
  const layerTree = sidePanel.locator('.jp-gis-layerPanel');
  if (!(await layerTree.isVisible())) {
    const layerTitle = sidePanel.getByTitle('Layer tree');
    await layerTitle.click();
    await page.waitForCondition(async () => await layerTree.isVisible());
  }
  return layerTree;
}

test.describe('#overview', () => {
  test('should have a left panel', async ({ page }) => {
    const panelIcon = page.getByTitle('JupyterGIS Control Panel');
    await expect(panelIcon).toHaveCount(2);

    await panelIcon.first().click();

    const sidePanel = page.locator('#jupytergis\\:\\:leftControlPanel');
    await expect(sidePanel).toBeVisible();

    await expect(sidePanel.getByTitle('Layer tree')).toHaveCount(1);
  });
});

test.describe('#layersPanel', () => {
  test.describe('without GIS document', () => {
    test('should have empty layer panel', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      await expect(layerTree).toBeEmpty();
    });
  });

  test.describe('with GIS document', () => {
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

    test('should have layer panel with content', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      await expect(layerTree).not.toBeEmpty();
    });

    test('should restore empty layer panel', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      await page.waitForTimeout(1000);
      await page.activity.closeAll();
      await expect(layerTree).toBeEmpty();
    });

    test('raster layer should have icons', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerIcons = layerTree.locator(
        '.jp-gis-layer .jp-gis-layerIcon svg'
      );

      expect(await layerIcons.first().screenshot()).toMatchSnapshot(
        'raster-layer-icon.png'
      );
    });

    test('should navigate in nested groups', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerEntries = layerTree.locator('.jp-gis-layerItem');

      await expect(layerEntries).toHaveCount(2);
      await expect(layerEntries.first()).toHaveClass(/jp-gis-layer/);
      await expect(layerEntries.last()).toHaveClass(/jp-gis-layerGroup/);

      // Open the first level group
      await layerEntries.last().click();
      await expect(layerEntries).toHaveCount(4);

      // Open the second level group
      await layerEntries.last().click();
      await expect(layerEntries).toHaveCount(5);
    });

    test('clicking a layer should select it', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerGroup = layerTree.locator('.jp-gis-layerGroup');
      const layer = layerTree.locator('.jp-gis-layer');

      // Open the first level group
      await layerGroup.last().click();

      await expect(layer.first()).not.toHaveClass(/jp-mod-selected/);
      expect(await layer.first().screenshot()).toMatchSnapshot(
        'layer-not-selected.png'
      );

      await layer.first().hover();
      expect(await layer.first().screenshot()).toMatchSnapshot(
        'layer-hover.png'
      );

      await layer.first().click();
      await layer.last().hover();
      await expect(layer.first()).toHaveClass(/jp-mod-selected/);
      expect(await layer.first().screenshot()).toMatchSnapshot(
        'layer-selected.png'
      );

      await layer.last().click();
      await expect(layer.first()).not.toHaveClass(/jp-mod-selected/);
      await expect(layer.last()).toHaveClass(/jp-mod-selected/);
    });

    test('should have visibility icon', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const hideLayerButton = layerTree.getByTitle('Hide layer');
      const showLayerButton = layerTree.getByTitle('Show layer');

      await expect(hideLayerButton).toHaveCount(1);
      await expect(showLayerButton).toHaveCount(0);

      expect(await hideLayerButton.screenshot()).toMatchSnapshot(
        'layer-visible-icon.png'
      );

      await hideLayerButton.click();
      await expect(hideLayerButton).toHaveCount(0);
      await expect(showLayerButton).toHaveCount(1);

      expect(await showLayerButton.screenshot()).toMatchSnapshot(
        'layer-not-visible-icon.png'
      );

      await showLayerButton.click();
      await expect(hideLayerButton).toHaveCount(1);
      await expect(showLayerButton).toHaveCount(0);
    });

    test('should hide the top raster layer', async ({ page }) => {
      const notHiddenScreenshot = 'top-layer-not-hidden.png';
      const layerTree = await openLayerTree(page);
      const layerGroup = layerTree.locator('.jp-gis-layerGroup');
      const main = page.locator('.jGIS-Mainview');

      // Open the first level group
      await layerGroup.last().click();
      await page.waitForCondition(async () => (await layerGroup.count()) === 2);

      // Wait for the map to be displayed.
      expect(await main.screenshot()).toMatchSnapshot({
        name: notHiddenScreenshot,
        maxDiffPixelRatio: 0.01
      });

      const hideLayerButton = layerTree.getByTitle('Hide layer');

      // Hide the last layer (top in z-index).
      await hideLayerButton.last().click();
      // wait for a significant change in the screenshots (1%).
      await page.waitForCondition(async () => {
        try {
          expect(await main.screenshot()).not.toMatchSnapshot({
            name: notHiddenScreenshot,
            maxDiffPixelRatio: 0.1
          });
          return true;
        } catch {
          return false;
        }
      });

      // Wait for the layer to be hidden.
      expect(await main.screenshot()).toMatchSnapshot({
        name: 'top-layer-hidden.png',
        maxDiffPixelRatio: 0.01
      });

      // Restore the visibility of the layer.
      const showLayerButton = layerTree.getByTitle('Show layer');
      await showLayerButton.last().click();
    });
  });
});
