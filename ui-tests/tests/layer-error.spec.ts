import { expect, test } from '@jupyterlab/galata';

const GEOTIFF_LAYERS = [
  {
    url: 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/36/Q/WD/2020/7/S2A_36QWD_20200701_0_L2A/TCI.tif',
    name: 'Sentinel TCI',
  },
  {
    url: 'https://maplibre.org/maplibre-gl-js/docs/assets/cog.tif',
    name: 'MapLibre COG',
  },
];

test.describe('#layerError', () => {
  test('switch renderer with two GeoTIFF layers', async ({ page }) => {
    // Create a new GIS document with the default OpenLayers renderer.
    await page.getByText('GIS Project').click();

    await expect(page.getByText('Layers', { exact: true })).toBeVisible();
    await expect(page.locator('.ol-unselectable').first()).toBeAttached();

    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Verify that OpenLayers is the initial renderer.
    const rendererButton = page.locator(
      'button[title="Map renderer: click to change or compare renderers"]',
    );
    await expect(rendererButton).toBeVisible();
    await expect(rendererButton).toContainText('OpenLayers');

    // Add both GeoTIFF layers.
    for (const layer of GEOTIFF_LAYERS) {
      await page.getByTestId('new-entry-button').click();
      await page.getByText('Add Raster Layer').hover();
      await page
        .locator('#jp-gis-toolbar-raster-menu')
        .getByText('GeoTiff', { exact: true })
        .click();

      const dialog = page.locator('.jp-Dialog-content');
      await expect(dialog).toBeAttached();

      const urlInput = dialog.locator('input#root_path');
      await expect(urlInput).toBeVisible();
      await urlInput.fill(layer.url);

      const urlName = dialog
        .getByRole('group')
        .filter({ hasText: 'The name of the layer' })
        .locator('input#root_name');
      await urlName.scrollIntoViewIfNeeded();
      await expect(urlName).toBeVisible();
      await urlName.fill(layer.name);

      await dialog.getByText('Ok', { exact: true }).first().click();
      await expect(dialog).not.toBeAttached();
    }

    // Open the renderer selection dialog.
    await rendererButton.click();

    const rendererDialog = page.locator('.jp-Dialog-content');
    await expect(rendererDialog).toBeVisible();

    // Select MapLibre.
    await rendererDialog.getByText('MapLibre', { exact: true }).check();

    // Apply the renderer selection.
    await rendererDialog
      .locator('.jp-Dialog-buttonLabel[aria-label="Apply"]')
      .click();

    // Verify that MapLibre is now active.
    await expect(rendererButton).toContainText('MapLibre');

    // Close the error dialog displayed for unsupported layers.
    const errorDialog = page.locator('.jp-Dialog-content');
    await expect(errorDialog).toBeVisible();
    await errorDialog
      .locator('.jp-Dialog-buttonLabel[aria-label="Close"]')
      .click();
    await expect(errorDialog).not.toBeAttached();

    // Locate the two layers individually.
    const sentinelLayer = page
      .locator('.jp-gis-layer')
      .filter({ hasText: 'Sentinel TCI' });

    const mapLibreCogLayer = page
      .locator('.jp-gis-layer')
      .filter({ hasText: 'MapLibre COG' });

    // The Sentinel COG is unsupported by MapLibre and should be disabled.
    await expect(sentinelLayer).toBeVisible();
    await expect(sentinelLayer.locator('.jp-gis-layerTitle')).toHaveCSS(
      'opacity',
      '0.5',
    );

    // The MapLibre example COG should remain enabled.
    await expect(mapLibreCogLayer).toBeVisible();
    await expect(mapLibreCogLayer.locator('.jp-gis-layerTitle')).toHaveCSS(
      'opacity',
      '1',
    );

    // Its visibility control should remain interactable.
    const mapLibreVisibilityButton = mapLibreCogLayer.getByTitle('Hide layer');
    await expect(mapLibreVisibilityButton).toBeEnabled();
    await mapLibreVisibilityButton.click();
    await expect(mapLibreCogLayer.getByTitle('Show layer')).toBeVisible();
  });
});
