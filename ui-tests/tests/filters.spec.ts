import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

test.describe('#filters', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/filter-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('when-clause can be added and removed in grammar panel', async ({
    page,
  }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Open the symbology dialog
    await page
      .getByText('Custom GeoJSON Layer', { exact: true })
      .click({ button: 'right' });
    await page.getByText('Edit Symbology').click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    // Verify grammar panel is shown
    await expect(dialog.getByText('Layer 1')).toBeVisible();

    // Click the "+" button in the layer-level "when" row to open the add form
    const whenRow = dialog.locator('.jp-gis-grammar-when-row').first();
    await whenRow.locator('.jp-gis-grammar-when-add-btn').click();

    // The WhenAddForm should appear with a type selector defaulting to "geometry type"
    const typeSelect = whenRow.locator('select').first();
    await expect(typeSelect).toBeVisible();
    await expect(typeSelect).toHaveValue('geometryType');

    // Confirm the predicate (geometry type = Point by default)
    await whenRow.locator('button[title="Add predicate"]').click();

    // A "when" chip should appear showing the condition
    const chip = whenRow.locator('.jp-gis-grammar-when-chip').first();
    await expect(chip).toBeVisible();

    // Remove the chip
    await chip.locator('button').click();
    await expect(chip).not.toBeAttached();

    await dialog.getByText('Cancel').click();
  });
});
