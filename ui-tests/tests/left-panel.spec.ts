import {
  expect,
  test,
  galata,
  IJupyterLabPageFixture
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

async function openLayersTree(page: IJupyterLabPageFixture): Promise<Locator> {
  const sidePanel = await openLeftPanel(page);
  const layersTree = sidePanel.locator('.jp-gis-layerPanel');
  if (!(await layersTree.isVisible())) {
    const layerTitle = sidePanel.getByTitle('Layer tree');
    await layerTitle.click();
    await page.waitForCondition(async () => await layersTree.isVisible());
  }
  return layersTree;
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
      const layersTree = await openLayersTree(page);
      await expect(layersTree).toBeEmpty();
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
      const layersTree = await openLayersTree(page);
      await expect(layersTree).not.toBeEmpty();
    });

    test('raster layer should have icons', async ({ page }) => {
      const layersTree = await openLayersTree(page);
      const layerIcons = layersTree.locator(
        '.jp-gis-layer .jp-gis-layerIcon svg'
      );

      expect(await layerIcons.first().screenshot()).toMatchSnapshot(
        'raster-layer-icon.png'
      );
    });

    test('should navigate in nested groups', async ({ page }) => {
      const layersTree = await openLayersTree(page);
      const layerEntries = layersTree.locator('.jp-gis-layerItem');

      await expect(layerEntries).toHaveCount(2);
      await expect(layerEntries.first()).toHaveClass(/jp-gis-layer/);
      await expect(layerEntries.last()).toHaveClass(/jp-gis-layersGroup/);

      // Open the first level group
      await layerEntries.last().click();
      await expect(layerEntries).toHaveCount(4);

      // Open the second level group
      await layerEntries.last().click();
      await expect(layerEntries).toHaveCount(5);
    });

    test('clicking a layer should select it', async ({ page }) => {
      const layersTree = await openLayersTree(page);
      const layersGroup = layersTree.locator('.jp-gis-layersGroup');
      const layer = layersTree.locator('.jp-gis-layer');

      // Open the first level group
      await layersGroup.last().click();

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
      const layersTree = await openLayersTree(page);
      const hideLayerButton = layersTree.getByTitle('Hide layer');
      const showLayerButton = layersTree.getByTitle('Show layer');

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

    test('should hide the top layer', async ({ page }) => {
      const notHiddenScreenshot = 'top-layer-not-hidden.png';
      const layersTree = await openLayersTree(page);
      const layersGroup = layersTree.locator('.jp-gis-layersGroup');
      const main = page.locator('.jGIS-Mainview');

      // Open the first level group
      await layersGroup.last().click();
      await page.waitForCondition(
        async () => (await layersGroup.count()) === 2
      );
      // Open the second level group
      await layersGroup.last().click();

      // Wait for the layer to be hidden.
      expect(await main.screenshot()).toMatchSnapshot({
        name: notHiddenScreenshot,
        maxDiffPixelRatio: 0.01
      });

      const hideLayerButton = layersTree.getByTitle('Hide layer');

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
      const showLayerButton = layersTree.getByTitle('Show layer');
      await showLayerButton.last().click();
    });
  });
});
