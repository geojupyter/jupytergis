import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

import {
  getLayerSummary,
  getResolvedFeatureStyles,
  waitForMapReady,
} from './utils/map';

const FILENAME = 'graduated-lines-test.jGIS';
const ROADS_LAYER = 'a1b2c3d4-0000-4000-8000-000000000002';

const SPEED_LIMITS = [30, 50, 70, 90, 110];

// The fixture ramps `speed_limit` over viridis in five equal-interval classes,
// one per road. Assert what viridis guarantees rather than the exact
// intermediate colours, which depend on the colormap implementation: the ends
// of the ramp, five distinct classes, and a green channel that only rises.
const assertViridisRamp = (strokes: Array<{ value: any; stroke?: string }>) => {
  expect(strokes.map(({ value }) => value)).toEqual(SPEED_LIMITS);

  const colors = strokes.map(({ stroke }) => stroke);
  expect(colors[0]).toBe('rgba(68,1,84,1)');
  expect(colors[colors.length - 1]).toBe('rgba(253,231,37,1)');
  expect(new Set(colors).size).toBe(SPEED_LIMITS.length);

  const green = colors.map(color => Number(color?.split(',')[1]));
  for (let i = 1; i < green.length; i++) {
    expect(green[i]).toBeGreaterThan(green[i - 1]);
  }
};

test.describe('#graduatedLines', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open(`testDir/${FILENAME}`);
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('graduated symbology renders on line layer', async ({ page }) => {
    await waitForMapReady(page, FILENAME);

    const layers = await getLayerSummary(page, FILENAME);
    const roads = layers.find(layer => layer.id === ROADS_LAYER);
    expect(roads).toBeDefined();
    expect(roads?.visible).toBe(true);
    expect(roads?.featureCount).toBe(5);

    const styles = await getResolvedFeatureStyles(
      page,
      FILENAME,
      ROADS_LAYER,
      'speed_limit',
    );
    assertViridisRamp(styles);
  });

  test('graduated symbology dialog opens with grammar panel', async ({
    page,
  }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Open the symbology dialog for the graduated line layer
    await page
      .getByText('Roads (Graduated)', { exact: true })
      .click({ button: 'right' });
    await page.getByText('Edit Symbology').click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    // Verify the Grammar panel is shown (not the old render-type dialog)
    await expect(dialog.getByText('Layer 1')).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Add Mapping' }),
    ).toBeVisible();

    await dialog.getByText('Cancel').click();
  });

  test('applying graduated symbology on line layer uses stroke color', async ({
    page,
  }) => {
    await waitForMapReady(page, FILENAME);

    // Open the symbology dialog
    await page
      .getByText('Roads (Graduated)', { exact: true })
      .click({ button: 'right' });
    await page.getByText('Edit Symbology').click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    // Re-apply symbology by clicking Ok
    await dialog.getByText('Ok', { exact: true }).first().click();
    await expect(dialog).not.toBeAttached();

    await waitForMapReady(page, FILENAME);

    // Re-applying must not drop the graduated stroke colours.
    const styles = await getResolvedFeatureStyles(
      page,
      FILENAME,
      ROADS_LAYER,
      'speed_limit',
    );
    assertViridisRamp(styles);
  });
});
