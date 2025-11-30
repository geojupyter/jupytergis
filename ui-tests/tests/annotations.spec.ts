import { galata, test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import path from 'path';

test.describe('#annotations', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);
    await content.deleteDirectory('/testDir');
    await content.uploadDirectory(
      path.resolve(__dirname, './gis-files'),
      '/testDir',
    );
  });
  test.beforeEach(async ({ page }) => {
    await page.filebrowser.open('testDir/annotation-test.jGIS');
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('Should add an annotation and display the entered text', async ({
    page,
  }) => {
    // Wait for main view to be visible
    await expect(page.locator('.jGIS-Mainview')).toBeVisible();

    // Open Annotations tab in side panel
    await page.getByText('Annotations').click();

    // Right-click on the map canvas to open context menu
    const canvas = page.locator('canvas').first();
    await canvas.click({ button: 'right', position: { x: 10, y: 10 } });

    // Click "Add annotation" from context menu
    await page.getByText('Add annotation').click();

    // Get the annotations panel and wait for the annotation to appear in the side panel
    const annotationsPanel = page.getByRole('tabpanel', {
      name: 'Annotations',
    });

    // Wait for the annotation panel container to appear
    const annotationPanel = annotationsPanel
      .locator('.jgis-annotation-panel')
      .first();
    await expect(annotationPanel).toBeVisible();

    // Find the textarea within the side panel annotation
    const textarea = annotationPanel.locator('[data-id="annotation-textarea"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();

    // Click the textarea to focus it, then clear and fill it
    await textarea.click();
    await textarea.clear();

    // Enter text in the annotation textarea
    const annotationText = 'Test annotation message';
    await textarea.fill(annotationText);

    // Verify the text was actually entered
    await expect(textarea).toHaveValue(annotationText);

    // Submit the annotation - find the submit button in the side panel annotation
    const submitButton = annotationPanel
      .locator('.jGIS-Annotation-Buttons')
      .getByRole('button')
      .last();
    await submitButton.click();

    // Wait for the message to appear in the annotation
    await expect(
      annotationPanel.locator('.jGIS-Annotation-Message-Content'),
    ).toBeVisible();

    // Verify the entered text is displayed in the side panel annotation
    await expect(annotationPanel).toContainText(annotationText, {});

    // Delete the annotation
    const deleteButton = annotationPanel
      .locator('.jGIS-Annotation-Buttons')
      .getByRole('button')
      .first();
    await deleteButton.click();

    // Confirm deletion in the dialog
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify the annotation is no longer visible in the side panel
    await expect(annotationPanel).not.toBeVisible();

    const a = false;
    expect(a);
  });
});
