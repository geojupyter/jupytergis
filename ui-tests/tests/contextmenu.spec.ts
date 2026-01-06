import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

test.describe('context menu', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/context-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('right click on layer should open layer menu', async ({ page }) => {
    await page
      .getByLabel('Layers', { exact: true })
      .getByText('Open Topo Map')
      .click({ button: 'right' });

    const text = page.getByRole('menu').getByText('Remove Layer');
    await expect(text).toBeVisible();
  });

  test('right click on group should open group menu', async ({ page }) => {
    await page.getByText('level 1 group').click({ button: 'right' });

    const text = page.getByRole('menu').getByText('Remove Group');
    await expect(text).toBeVisible();
  });

  test('hover should display submenu', async ({ page }) => {
    await page
      .getByLabel('Layers', { exact: true })
      .getByText('Open Topo Map')
      .click({ button: 'right' });

    await page.getByText('Move Selected Layers to Group').hover();

    const submenu = page.locator('#jp-gis-contextmenu-movelayer');

    const firstItem = page.getByText('Move to Root');
    await expect(firstItem).toBeVisible();
    await expect(submenu).toBeVisible();
  });

  test('move layer to new group', async ({ page }) => {
    const layer = await page
      .getByLabel('Layers', { exact: true })
      .getByText('Open Topo Map');

    layer.click({ button: 'right' });

    await page.getByText('Move Selected Layers to Group').hover();
    await page
      .locator('#jp-gis-contextmenu-movelayer')
      .getByText('Move Selected Layers to New Group')
      .click();
    await page
      .getByLabel('Layers', { exact: true })
      .getByRole('textbox')
      .fill('new group');
    await page
      .getByLabel('Layers', { exact: true })
      .getByRole('textbox')
      .press('Enter');

    await expect(page.getByText('new group', { exact: true })).toHaveCount(1);
  });

  test('clicking remove layer should remove the layer from the tree', async ({
    page,
  }) => {
    // Create new layer first
    await page.getByLabel('Layers', { exact: true }).click({
      button: 'right',
    });
    await page.getByText('Add Layer').hover();
    await page.getByText('Add Raster Layer', { exact: true }).hover();
    await page.getByText('New Raster Tile Layer', { exact: true }).click();

    await page
      .locator('input#root_url')
      .type(
        'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}.pbf',
      );

    await page.getByRole('dialog').getByRole('button', { name: 'Ok' }).click();

    const layerTitle = 'Custom Raster Tile Layer';
    expect(page.getByText(layerTitle)).toBeVisible();

    await page.getByText(layerTitle).click({
      button: 'right',
    });

    await page.getByRole('menu').getByText('Remove Layer').click();

    expect(page.getByText(layerTitle)).not.toBeVisible();
  });

  test('clicking remove group should remove the group from the tree', async ({
    page,
  }) => {
    const firstItem = page
      .getByLabel('Layers', { exact: true })
      .getByText('level 1 group');

    await page
      .getByLabel('Layers', { exact: true })
      .getByText('level 1 group')
      .click({ button: 'right' });

    await page.getByRole('menu').getByText('Remove Group').click();
    await expect(firstItem).not.toBeVisible();
  });

  test('pressing F2 should start rename for layer', async ({ page }) => {
    const layersPanel = page.getByLabel('Layers', { exact: true });
    const layerName = 'Open Topo Map';
    const layerText = layersPanel.getByText(layerName);

    // Find the parent layer item container (which gets the selected class)
    // Structure: div.jp-gis-layerItem > div.jp-gis-layerTitle > span.jp-gis-layerText
    const layerItem = layerText.locator(
      'xpath=ancestor::div[contains(@class, "jp-gis-layerItem")]',
    );

    // Select the layer
    await layerText.click();
    await page.waitForTimeout(1000);
    await expect(layerItem).toHaveClass(/jp-mod-selected/);

    // Start rename with F2
    await layerText.press('F2');

    // Wait for the textbox to appear and be focused
    const textbox = layersPanel.getByRole('textbox');
    await expect(textbox).toBeVisible();
    await expect(textbox).toBeFocused();

    // Enter new name
    await textbox.fill('test name');
    await textbox.press('Enter');

    // Wait for rename to complete and verify new name appears
    await expect(layersPanel.getByText('test name')).toBeVisible();
    await expect(layersPanel.getByText(layerName)).not.toBeVisible();

    // Reset: rename back to original name
    const renamedText = layersPanel.getByText('test name');
    const renamedItem = renamedText.locator(
      'xpath=ancestor::div[contains(@class, "jp-gis-layerItem")]',
    );
    await renamedText.click();
    await page.waitForTimeout(1000);
    await expect(renamedItem).toHaveClass(/jp-mod-selected/);
    await renamedText.press('F2');

    // Wait for textbox again
    const resetTextbox = layersPanel.getByRole('textbox');
    await expect(resetTextbox).toBeVisible();
    await expect(resetTextbox).toBeFocused();

    // Enter original name
    await resetTextbox.fill(layerName);
    await resetTextbox.press('Enter');

    // Verify original name is restored
    await expect(layersPanel.getByText(layerName)).toBeVisible();
    await expect(layersPanel.getByText('test name')).not.toBeVisible();
  });

  test('pressing F2 should start rename for group', async ({ page }) => {
    await page
      .getByLabel('Layers', { exact: true })
      .getByText('level 1 group')
      .click({ button: 'right' });

    await page.keyboard.press('Escape');
    await page.getByText('level 1 group').press('F2');
    await page.getByRole('textbox').fill('test name');
    await page.getByRole('textbox').press('Enter');

    const newText = page.getByText('test name');

    await expect(newText).toBeVisible();

    await page
      .getByLabel('Layers', { exact: true })
      .getByText('test name')
      .click({ button: 'right' });

    await page.keyboard.press('Escape');
    await page.getByText('test name').press('F2');
    await page.getByRole('textbox').fill('level 1 group');
    await page.getByRole('textbox').press('Enter');

    const restoredText = page.getByText('level 1 group');

    await expect(restoredText).toBeVisible();
  });

  test('move layer to group should move layer', async ({ page }) => {
    await page
      .getByLabel('Layers', { exact: true })
      .getByText('Open Topo Map')
      .click({ button: 'right' });

    await page.getByText('Move Selected Layers to Group').hover();

    await page.getByText('level 2 group').click();
    await page.getByText('level 1 group').click();
    await page.getByText('level 2 group').click();

    const group = page.getByText('level 2 groupOpen Topo MapRegions France');

    await expect(group).toHaveCount(1);
  });
});
