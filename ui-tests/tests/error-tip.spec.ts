import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

const FILENAME = 'graduated-lines-test.jGIS';

test.describe('#errorTip', () => {
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

  test('invalid expression shows a field-level ErrorTip', async ({ page }) => {
    const main = page.locator('.jGIS-Mainview');
    await expect(main).toBeVisible();

    // Open the symbology dialog for the vector layer.
    await page
      .getByText('Roads (Graduated)', { exact: true })
      .click({ button: 'right' });
    await page.getByText('Edit Symbology').click();

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toBeAttached();

    // Switch the mapping's scale scheme to "expression".
    await dialog
      .locator('.jp-gis-grammar-scale-section select')
      .first()
      .selectOption('expression');

    // Expand the inline scale editor.
    await dialog.locator('.jp-gis-grammar-preview-btn').first().click();

    // The ErrorTip is not shown while the expression is empty.
    await expect(dialog.getByLabel('Validation error')).toHaveCount(0);

    // Type an invalid expression into the CodeMirror editor.
    const editor = dialog.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.type('1 +');

    // Validation is debounced; the ErrorTip appears once it fails.
    const errorTip = dialog.getByLabel('Validation error');
    await expect(errorTip).toBeVisible();

    // Hovering the tip reveals the validation message.
    await errorTip.hover();
    const hoverCard = page.locator('[data-slot="hover-card-content"]');
    await expect(hoverCard).toBeVisible();

    // Expand "More Info" and verify the docs link.
    await hoverCard.getByText('More Info').click();
    const docsLink = hoverCard.getByRole('link', {
      name: 'Expression syntax reference',
    });
    await expect(docsLink).toHaveAttribute(
      'href',
      'https://vega.github.io/vega/docs/expressions/',
    );

    await dialog.getByText('Cancel').click();
  });
});
