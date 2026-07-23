import { expect, galata, test } from '@jupyterlab/galata';
import path from 'path';

const FILENAME = 'story_map.jGIS';

test.describe('Story editor', () => {
  test.beforeEach(async ({ request, tmpPath }) => {
    const content = galata.newContentsHelper(request);
    await content.uploadFile(
      path.resolve(__dirname, `../../examples/${FILENAME}`),
      `/${tmpPath}/${FILENAME}`,
    );
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('opens with the segment list populated', async ({ page, tmpPath }) => {
    await page.filebrowser.open(`/${tmpPath}/${FILENAME}`);
    await page.waitForCondition(async () =>
      page.activity.isTabActive(FILENAME),
    );

    await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

    const okButton = page.getByRole('button', { name: 'Ok' });
    if (await okButton.isVisible()) {
      await okButton.click();
    }

    await page.getByTestId('open-story-editor-button').click();

    const dialog = page.locator('#jupytergis\\:\\:storyEditor');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('.jgis-story-editor-segment-list-items button'),
    ).not.toHaveCount(0);
  });
});
