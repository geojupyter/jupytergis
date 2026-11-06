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
  test.describe.configure({ retries: process.env.CI ? 3 : 0 });

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

    // STAC lives in the floating right dock; open it from Add Layer.
    await page.getByTestId('new-entry-button').click();
    const addStacItem = page
      .locator('.lm-Menu-item')
      .filter({ hasText: 'Add STAC Layer' });
    await expect(addStacItem).toBeVisible();
    await addStacItem.click();

    // Header keeps title="" even when the label is visually hidden on the chip.
    const stacHeader = page.locator(
      '.jgis-floating-right-panel-header[title="STAC Browser"]',
    );
    await expect(stacHeader).toBeVisible({ timeout: 15000 });

    const stacPanel = page
      .locator('.jgis-floating-right-panel')
      .filter({ has: stacHeader });

    // Auto-open is async (registerOpen effect); click the chip if needed.
    await expect(async () => {
      if (await stacPanel.evaluate(el => el.hasAttribute('data-closed'))) {
        await stacHeader.click();
      }
      expect(
        await stacPanel.evaluate(el => el.hasAttribute('data-open')),
      ).toBe(true);
    }).toPass({ timeout: 15000 });

    const filters = stacPanel.locator('.jgis-stac-filter-extension-panel');
    await expect(filters).toBeVisible({ timeout: 15000 });

    // The panel restores saved filters from the state DB asynchronously and
    // overwrites anything selected before that lands, so let it settle first.
    await page.waitForTimeout(2000);

    await stacPanel.getByLabel('Provider').selectOption({ label: 'GEODES' });
    await stacPanel.getByRole('button', { name: 'Collection' }).click();
    await page.getByRole('menuitem', { name: 'Sentinel 2' }).hover();
    await page.getByRole('menuitemcheckbox', { name: 'PEPS_S2_L1C' }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await stacPanel.getByRole('tab', { name: /Results/ }).click();

    const resultsList = stacPanel.locator('.jgis-stac-browser-results-list');
    await expect(resultsList.locator('button')).toHaveCount(1, {
      timeout: 30000,
    });
  });
});
