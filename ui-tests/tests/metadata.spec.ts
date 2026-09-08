import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

/**
 * The Information tab of the Layer Properties dialog.
 *
 * The fixture deliberately uses a local GeoJSON file and an XYZ raster source,
 * so that everything asserted here is read without touching the network.
 */
test.describe('layer information', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/metadata-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  const openInformation = async (page: any, layerName: string) => {
    await page
      .getByLabel('Layers', { exact: true })
      .getByText(layerName)
      .click({ button: 'right' });

    await page.getByRole('menu').getByText('Layer Metadata').click();
  };

  test('layer context menu offers layer information', async ({ page }) => {
    await page
      .getByLabel('Layers', { exact: true })
      .getByText('France Regions')
      .click({ button: 'right' });

    await expect(
      page.getByRole('menu').getByText('Layer Metadata'),
    ).toBeVisible();
  });

  test('vector layer reports its CRS, extent and features', async ({
    page,
  }) => {
    await openInformation(page, 'France Regions');

    const dialog = page.locator('.jp-gis-object-properties-dialog');
    await expect(dialog).toBeVisible();

    // GeoJSON is longitude/latitude on WGS 84 by specification.
    await expect(
      dialog.getByRole('heading', { name: 'Coordinate reference system' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'EPSG:4326' }),
    ).toHaveAttribute('href', 'https://epsg.io/4326');

    await expect(dialog.getByRole('heading', { name: 'Extent' })).toBeVisible();

    // The fixture holds the 13 French regions: 8 polygons, 5 multipolygons,
    // each with a `code` and a `nom` attribute.
    await expect(dialog.getByText('13 features')).toBeVisible();
    await expect(
      dialog.getByText('Geometry: Polygon, MultiPolygon.'),
    ).toBeVisible();
    await expect(dialog.getByText('nom', { exact: true })).toBeVisible();
  });

  test('raster tile layer reports its zoom range', async ({ page }) => {
    await openInformation(page, 'OpenStreetMap.Mapnik Layer');

    const dialog = page.locator('.jp-gis-object-properties-dialog');
    await expect(dialog).toBeVisible();

    await expect(
      dialog.getByRole('heading', { name: 'Tile pyramid' }),
    ).toBeVisible();
    await expect(
      dialog.getByText('Served for zoom levels 0 to 19.'),
    ).toBeVisible();
  });

  test('information and properties are separate tabs', async ({ page }) => {
    await openInformation(page, 'France Regions');

    const dialog = page.locator('.jp-gis-object-properties-dialog');

    await expect(dialog.getByRole('tab', { name: 'Metadata' })).toHaveAttribute(
      'data-state',
      'active',
    );

    await dialog.getByRole('tab', { name: 'Properties' }).click();

    await expect(
      dialog.getByRole('heading', { name: 'Coordinate reference system' }),
    ).toBeHidden();

    // The property form is still the dialog's other half.
    await expect(dialog.locator('form').first()).toBeVisible();
  });
});
