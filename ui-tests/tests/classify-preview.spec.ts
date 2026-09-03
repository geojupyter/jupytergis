import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

const FILENAME = 'colormap-nostops-test.jGIS';
const FILEPATH = `testDir/${FILENAME}`;
const LAYER = 'Roads (ColorMap)';

/**
 * The fixture carries a colorMap scale with NO persisted colorStops, which is
 * the state a freshly-configured layer is in. The editor must show the
 * classification derived from the data without the user pressing Classify,
 * and stops must only reach the document when edited by hand.
 */
test.describe('#classifyPreview', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open(FILEPATH);
    await expect(page.locator('.jGIS-Mainview')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  /** Open the symbology dialog and expand the colorMap scale editor. */
  const openScaleEditor = async (page: any) => {
    await page.getByText(LAYER, { exact: true }).click({ button: 'right' });
    await page.getByText('Edit Symbology').click();
    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();
    await dialog.getByRole('button', { name: /viridis/ }).click();
    return dialog;
  };

  /** Save, then read the layer's symbologyState back off disk. */
  const readSymbologyState = async (page: any, request: any) => {
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(2000);
    const res = await request.get(`/api/contents/${FILEPATH}?content=1`);
    const doc = JSON.parse((await res.json()).content);
    const layer: any = Object.values(doc.layers).find(
      (l: any) => l.name === LAYER,
    );
    return layer.parameters.symbologyState;
  };

  test('stop table is populated without pressing Classify', async ({
    page,
  }) => {
    const dialog = await openScaleEditor(page);

    const rows = dialog.locator('.jp-gis-color-row');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    // Classification derived from the live feature values, not from the
    // document — the fixture has no colorStops at all.
    const values = await dialog
      .locator('.jp-gis-color-row-value-input')
      .evaluateAll((els: HTMLInputElement[]) => els.map(e => e.value));
    expect(values.length).toBeGreaterThan(1);
    expect(values.every(v => v !== '')).toBe(true);

    await dialog.getByText('Cancel').click();
  });

  test('Classify does not write colorStops to the document', async ({
    page,
    request,
  }) => {
    const dialog = await openScaleEditor(page);
    await expect(dialog.locator('.jp-gis-color-row').first()).toBeVisible({
      timeout: 15000,
    });

    await dialog.getByRole('button', { name: 'Classify' }).click();
    await page.locator('.jp-Dialog-footer button:has-text("Ok")').click();
    await expect(dialog).not.toBeAttached();

    const state = await readSymbologyState(page, request);
    const serialized = JSON.stringify(state);
    expect(serialized).toContain('colorMap');
    expect(serialized).not.toContain('colorStops');
  });

  test('editing a stop persists colorStops', async ({ page, request }) => {
    const dialog = await openScaleEditor(page);
    const firstValue = dialog.locator('.jp-gis-color-row-value-input').first();
    await expect(firstValue).toBeVisible({ timeout: 15000 });

    // A manual edit is the one action that should persist stops.
    await firstValue.fill('42');
    await firstValue.press('Tab');

    await page.locator('.jp-Dialog-footer button:has-text("Ok")').click();
    await expect(dialog).not.toBeAttached();

    const state = await readSymbologyState(page, request);
    expect(JSON.stringify(state)).toContain('colorStops');
  });
});
