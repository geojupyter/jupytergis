import { expect, galata, test } from '@jupyterlab/galata';
import type { IJupyterLabPageFixture } from '@jupyterlab/galata';
import path from 'path';

const FILENAME = 'story_map.jGIS';
// #AEBAD3 resolved to rgb, the custom presentationTextColor already committed
// on this fixture's story.
const CUSTOM_TEXT_COLOR = 'rgb(174, 186, 211)';
// #171B2C resolved to rgb, the custom presentationBgColor already committed
// on this fixture's story.
const CUSTOM_BG_COLOR = 'rgb(23, 27, 44)';

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

async function openStoryPresentation(
  page: IJupyterLabPageFixture,
  tmpPath: string,
) {
  await page.filebrowser.open(`/${tmpPath}/${FILENAME}`);
  await page.waitForCondition(async () => page.activity.isTabActive(FILENAME));

  await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

  const okButton = page.getByRole('button', { name: 'Ok' });
  if (await okButton.isVisible()) {
    await okButton.click();
  }

  await page.getByTestId('open-story-editor-button').click();
  const dialog = page.locator('#jupytergis\\:\\:storyEditor');
  await dialog.getByRole('button', { name: 'Preview story' }).click();

  return page.locator('.specta-article-host-widget');
}

test.describe('Story presentation colors', () => {
  test.beforeEach(async ({ request, tmpPath }) => {
    await uploadStoryMap(request, tmpPath);
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('links, code, blockquote and table pick up the story text color', async ({
    page,
    tmpPath,
  }) => {
    const host = await openStoryPresentation(page, tmpPath);

    await expect(host.locator('a').first()).toHaveCSS(
      'color',
      CUSTOM_TEXT_COLOR,
    );
    await expect(host.locator('code').first()).toHaveCSS(
      'color',
      CUSTOM_TEXT_COLOR,
    );
    await expect(host.locator('blockquote').first()).toHaveCSS(
      'color',
      CUSTOM_TEXT_COLOR,
    );
    await expect(host.locator('table').first()).toHaveCSS(
      'color',
      CUSTOM_TEXT_COLOR,
    );
  });

  test('inline code and fenced code blocks pick up the story background color', async ({
    page,
    tmpPath,
  }) => {
    const host = await openStoryPresentation(page, tmpPath);

    await expect(host.locator('code').first()).toHaveCSS(
      'background-color',
      CUSTOM_BG_COLOR,
    );
    await expect(host.locator('pre').first()).toHaveCSS(
      'background-color',
      CUSTOM_BG_COLOR,
    );
  });
});
