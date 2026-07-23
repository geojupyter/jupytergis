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

    // Click the "+" button in the layer-level "when" row. This commits a
    // default predicate live and shows it as an inline, always-editable form.
    const whenRow = dialog.locator('.jp-gis-grammar-when-row').first();
    await whenRow.locator('.jp-gis-grammar-when-add-btn').click();

    // The inline "when" form should appear with a type selector defaulting to
    // "geometry type" (predicate is already committed — there is no confirm step).
    const whenForm = whenRow.locator('.jp-gis-grammar-when-form').first();
    await expect(whenForm).toBeVisible();
    const typeSelect = whenForm.locator('select').first();
    await expect(typeSelect).toHaveValue('geometryType');

    // Remove the condition
    await whenForm.locator('button[title="Remove condition"]').click();
    await expect(whenForm).not.toBeAttached();

    await dialog.getByText('Cancel').click();
  });
});
