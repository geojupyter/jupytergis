import { expect, galata, test } from '@jupyterlab/galata';
import type { IJupyterLabPageFixture } from '@jupyterlab/galata';
import type { Locator } from '@playwright/test';
import path from 'path';

const FILENAME = 'story_map.jGIS';
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1290, height: 800 };

async function uploadStoryMap(
  request: Parameters<typeof galata.newContentsHelper>[0],
  tmpPath: string,
): Promise<void> {
  const content = galata.newContentsHelper(request);
  await content.uploadFile(
    path.resolve(__dirname, `../../examples/${FILENAME}`),
    `/${tmpPath}/${FILENAME}`,
  );
}

async function openStoryEditor(
  page: IJupyterLabPageFixture,
  tmpPath: string,
): Promise<Locator> {
  await page.filebrowser.open(`/${tmpPath}/${FILENAME}`);
  await page.waitForCondition(async () => page.activity.isTabActive(FILENAME));

  await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

  const okButton = page.getByRole('button', { name: 'Ok' });
  if (await okButton.isVisible()) {
    await okButton.click();
  }

  await page.getByTestId('open-story-editor-button').click();

  const dialog = page.locator('#jupytergis\\:\\:storyEditor');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Story editor (desktop)', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test.beforeEach(async ({ request, tmpPath }) => {
    await uploadStoryMap(request, tmpPath);
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('opens with side-by-side segment list and workspace', async ({
    page,
    tmpPath,
  }) => {
    const dialog = await openStoryEditor(page, tmpPath);
    const segmentItems = dialog.locator(
      '.jgis-story-editor-segment-list-items button',
    );
    await expect(segmentItems).not.toHaveCount(0);

    const main = dialog.locator('.jgis-story-editor-main');
    const listItems = dialog.locator('.jgis-story-editor-segment-list-items');

    await expect(main).toHaveCSS('flex-direction', 'row');
    await expect(listItems).toHaveCSS('flex-direction', 'column');
    await expect(dialog.locator('.jgis-story-editor-workspace')).toBeVisible();
  });
});

test.describe('Story editor (mobile)', () => {
  // test.use({ viewport: MOBILE_VIEWPORT });

  test.beforeEach(async ({ request, tmpPath }) => {
    await uploadStoryMap(request, tmpPath);
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('opens with segment dropdown and stacked workspace', async ({
    page,
    tmpPath,
  }) => {
    const dialog = await openStoryEditor(page, tmpPath);

    // Mobile uses NativeSelect instead of the desktop button list.
    const segmentPicker = dialog.locator(
      '.jgis-story-editor-segment-list.jgis-story-editor-segment-list--mobile',
    );
    await expect(segmentPicker).toBeVisible();
    await expect(segmentPicker.locator('option')).not.toHaveCount(0);
    await expect(
      dialog.locator('.jgis-story-editor-segment-list-items'),
    ).toHaveCount(0);

    const main = dialog.locator('.jgis-story-editor-main');
    await expect(main).toHaveCSS('flex-direction', 'column');
    await expect(dialog.locator('.jgis-story-editor-workspace')).toBeVisible();
  });
});
