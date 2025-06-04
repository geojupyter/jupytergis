import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test,
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

async function getOpenLayerIds(
  page: IJupyterLabPageFixture,
): Promise<string[]> {
  return await page.evaluate(() => {
    const olMap = Object.values(window.jupytergisMaps)[0];
    return olMap
      .getLayers()
      .getArray()
      .map(layer => layer.getProperties()['id']) as string[];
  });
}

async function getOpenLayerVisibility(
  page: IJupyterLabPageFixture,
): Promise<boolean[]> {
  return await page.evaluate(() => {
    const olMap = Object.values(window.jupytergisMaps)[0];
    return olMap
      .getLayers()
      .getArray()
      .map(layer => layer.getVisible()) as boolean[];
  });
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

test.describe('#layerPanel', () => {
  test.describe('without GIS document', () => {
    test('should have empty layer panel', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      await expect(layerTree).toBeEmpty();
    });
  });

  test.describe('with GIS document', () => {
    test.beforeAll(async ({ request }) => {
      const content = galata.newContentsHelper(request);
      await content.deleteDirectory('/testDir');
      await content.uploadDirectory(
        path.resolve(__dirname, './gis-files'),
        '/testDir',
      );
    });
    test.beforeEach(async ({ page }) => {
      await page.filebrowser.open('testDir/panel-test.jGIS');
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
      await page.activity.closeAll();
      await expect(layerTree).toBeEmpty();
    });

    test('raster layer should have icons', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerIcons = layerTree.locator(
        '.jp-gis-layer .jp-gis-layerIcon svg',
      );
      const visToggleIcon = layerIcons.nth(0);
      const rasterIcon = layerIcons.nth(1);

      await expect(visToggleIcon).toHaveAttribute(
        'data-icon',
        'jupytergis::visibility',
      );
      await expect(rasterIcon).toHaveAttribute(
        'data-icon',
        'jupytergis::raster',
      );
    });

    test('should navigate in nested groups', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerEntries = layerTree.locator('.jp-gis-layerItem');
      const layerGroups = layerTree.locator('.jp-gis-layerGroup');

      await expect(layerEntries).toHaveCount(2);
      await expect(layerEntries.first()).toHaveClass(/jp-gis-layerGroup/);
      await expect(layerEntries.last()).toHaveClass(/jp-gis-layer/);

      // Open the first level group
      await layerGroups.first().click();
      await expect(layerEntries).toHaveCount(4);

      // Open the second level group
      await layerGroups.last().click();
      await expect(layerEntries).toHaveCount(5);
    });

    test('clicking a layer should select it', async ({ page }) => {
      const layerTree = await openLayerTree(page);
      const layerGroup = layerTree.locator('.jp-gis-layerGroup');
      const layer = layerTree.locator('.jp-gis-layer');

      // Open the first level group
      await layerGroup.last().click();
      await expect(layer.first()).not.toHaveClass(/jp-mod-selected/);

      await layer.first().click();
      await expect(layer.first()).toHaveClass(/jp-mod-selected/);

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

      await hideLayerButton.click();
      await expect(hideLayerButton).toHaveCount(0);
      await expect(showLayerButton).toHaveCount(1);

      await showLayerButton.click();
      await expect(hideLayerButton).toHaveCount(1);
      await expect(showLayerButton).toHaveCount(0);
    });

    test('should hide the last layer', async ({ page }) => {
      const layerTree = await openLayerTree(page);

      // Wait for the map to be loaded;
      await page.waitForCondition(
        async () => (await getOpenLayerIds(page)).length === 3,
      );

      // Wait for the map to be displayed.
      let layerVisibility = await getOpenLayerVisibility(page);
      layerVisibility.forEach(visible => expect(visible).toBeTruthy());

      const hideLayerButton = layerTree.getByTitle('Hide layer');

      // Hide the last layer
      await hideLayerButton.last().click();

      layerVisibility = await getOpenLayerVisibility(page);

      expect(layerVisibility[0]).toBeFalsy();

      // Restore the visibility of the layer.
      const showLayerButton = layerTree.getByTitle('Show layer');
      await showLayerButton.last().click();
    });

    test('drag indicator should move', async ({ page }) => {
      const dragIndicatorId = 'jp-drag-indicator';
      const layerTree = await openLayerTree(page);
      const layerPanel = layerTree.locator('#jp-gis-layer-tree');
      const layers = layerTree.locator('.jp-gis-layer');
      const layerItems = layerTree.locator('.jp-gis-layerItem');
      const layerGroup = layerTree.locator('.jp-gis-layerGroup');
      const dragIndicator = layerTree.locator(`#${dragIndicatorId}`);

      // Open the first level group
      await layerGroup.last().click();
      await page.waitForCondition(async () => (await layerGroup.count()) === 2);
      // Open the second level group
      await layerGroup.last().click();
      await page.waitForCondition(async () => (await layerItems.count()) === 5);

      const topLayerBox = await layers.nth(1).boundingBox();
      const firstItemBox = await layerItems.first().boundingBox();

      await page.mouse.move(topLayerBox!.x + 10, topLayerBox!.y + 10);
      await page.mouse.down();
      await page.mouse.move(firstItemBox!.x + 10, firstItemBox!.y + 10);
      // We need to force hover
      await layerItems.first().hover({ position: { x: 10, y: 10 } });

      await expect(dragIndicator).toBeVisible();

      let children = await layerPanel.evaluate(div => div.children);
      expect(children[0].id === dragIndicatorId);

      await page.mouse.move(
        firstItemBox!.x + 10,
        firstItemBox!.y + firstItemBox!.height - 10,
      );
      // We need to force hover
      await layerItems
        .first()
        .hover({ position: { x: 10, y: firstItemBox!.height - 10 } });

      children = await layerPanel.evaluate(div => div.children);
      expect(children[1].id === dragIndicatorId);
    });

    test('should move the top raster layer using drag and drop', async ({
      page,
    }) => {
      const layerTree = await openLayerTree(page);
      const layers = layerTree.locator('.jp-gis-layer');
      const layerGroup = layerTree.locator('.jp-gis-layerGroup');

      // Wait for the map to be loaded;
      await page.waitForCondition(
        async () => (await getOpenLayerIds(page)).length === 3,
      );

      const layerIds = await getOpenLayerIds(page);

      // Open the first level group
      await layerGroup.last().click();
      await page.waitForCondition(async () => (await layerGroup.count()) === 2);

      const topLayerBox = await layers.first().boundingBox();
      const lowLayerBox = await layers.last().boundingBox();
      await page.mouse.move(topLayerBox!.x + 10, topLayerBox!.y + 10);
      await page.mouse.down();
      await page.mouse.move(
        lowLayerBox!.x + 10,
        lowLayerBox!.y + lowLayerBox!.height + 10,
      );
      await page.mouse.up();

      const newLayerIds = await getOpenLayerIds(page);

      // expect 2 layers to be inverted
      expect(newLayerIds[0]).toBe(layerIds[1]);
      expect(newLayerIds[1]).toBe(layerIds[0]);
    });
  });
});
