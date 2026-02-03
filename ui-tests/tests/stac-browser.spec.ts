import { galata, test, expect } from '@jupyterlab/galata';
import path from 'path';

const mockStacResponse = {
  context: { returned: 1, limit: 10, matched: 1 },
  features: [
    {
      type: 'Feature',
      stac_version: '1.0.0',
      id: 'test-item-1',
      geometry: null,
      bbox: [-10.0, -10.0, 10.0, 10.0],
      properties: {
        title: 'Test STAC Item 1',
        description: 'A description for test item 1',
        datetime: '2024-01-01T00:00:00Z',
        start_datetime: '2024-01-01T00:00:00Z',
        end_datetime: '2024-01-01T00:00:00Z',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        platform: 'test-platform',
        instruments: ['test-instrument'],
        constellation: 'test-constellation',
        mission: 'test-mission',
        gsd: 10,
      },
      links: [],
      assets: {
        visual: {
          title: 'True Color Image',
          type: 'image/tiff',
        },
      },
      collection: 'test-collection',
    },
  ],
  links: [],
  stac_extensions: [],
  stac_version: '1.0.0',
  type: 'FeatureCollection',
};

test.describe('#stac-browser', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/stac-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('Should be able to add a STAC layer', async ({ page }) => {
    await page.route(
      `*/**/jupytergis_core/proxy?url=${encodeURIComponent(
        'https://geodes-portal.cnes.fr/api/stac/search',
      )}`,
      async route => {
        await route.fulfill({ json: mockStacResponse });
      },
    );
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    await page.getByText('Stac Browser').click();

    await page
      .getByRole('tabpanel', { name: 'Filters' })
      .getByRole('combobox')
      .click();
    await page.getByRole('option', { name: 'GEODES' }).click();
    await page.getByRole('button', { name: 'Collection' }).click();
    await page.getByRole('menuitem', { name: 'Sentinel 2' }).hover();
    await page.getByRole('menuitemcheckbox', { name: 'PEPS_S2_L1C' }).click();
    await page
      .getByRole('menuitemcheckbox', { name: 'PEPS_S2_L1C' })
      .press('Escape');

    await page.getByRole('tab', { name: /Results/ }).click();

    const resultsList = page.locator('.jgis-stac-browser-results-list');
    await expect(resultsList.locator('button')).toHaveCount(1);
  });
});
