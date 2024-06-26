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

    test('should have layer panel with content', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      await expect(layerTree).not.toBeEmpty();
    });

    test('raster layer should have icons', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerItemsIcon = layerTree.locator(
        '.jp-gis-layerItem .jp-gis-layerIcon svg'
      );

      expect(await layerItemsIcon.first().screenshot()).toMatchSnapshot(
        'raster-layer-icon.png'
      );
    });

    test('should navigate in nested groups', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerEntries = layerTree.locator('.jp-gis-layerEntry');

      await expect(layerEntries).toHaveCount(2);
      await expect(layerEntries.first()).toHaveClass(/jp-gis-layerItem/);
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
      const layerItems = layerTree.locator('.jp-gis-layerItem');

      // Open the first level group
      await layerGroup.last().click();

      await expect(layerItems.first()).not.toHaveClass(/jp-mod-selected/);
      expect(await layerItems.first().screenshot()).toMatchSnapshot(
        'layer-not-selected.png'
      );

      await layerItems.first().hover();
      expect(await layerItems.first().screenshot()).toMatchSnapshot(
        'layer-hover.png'
      );

      await layerItems.first().click();
      await layerItems.last().hover();
      await expect(layerItems.first()).toHaveClass(/jp-mod-selected/);
      expect(await layerItems.first().screenshot()).toMatchSnapshot(
        'layer-selected.png'
      );

      await layerItems.last().click();
      await expect(layerItems.first()).not.toHaveClass(/jp-mod-selected/);
      await expect(layerItems.last()).toHaveClass(/jp-mod-selected/);
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
    });
  });
});
