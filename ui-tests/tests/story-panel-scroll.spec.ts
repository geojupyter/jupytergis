import { expect, galata, test } from '@jupyterlab/galata';
import fs from 'fs';
import path from 'path';

const FILENAME = 'story_map_long_text.jGIS';

test.use({
  viewport: { width: 1290, height: 800 },
  // Headless Chromium hides scrollbars by default; the drag test needs them.
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
});

test.describe('Vertical scroll story map card', () => {
  test.beforeEach(async ({ page, request, tmpPath }) => {
    // The example story, as a vertical scroll story whose first map segment
    // has more text than fits on the stage.
    const doc = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../examples/story_map.jGIS'),
        'utf-8',
      ),
    );
    const story: any = Object.values(doc.stories)[0];
    story.storyType = 'Vertical Scroll';
    const content = doc.layers[story.storySegments[0]].parameters.content;
    content.markdown = Array(20).fill(content.markdown).join('\n\n');

    await galata
      .newContentsHelper(request)
      .uploadContent(JSON.stringify(doc), 'text', `/${tmpPath}/${FILENAME}`);

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
    await page.getByRole('button', { name: 'Preview story' }).click();
  });

  test.afterEach(async ({ page }) => {
    await page.activity.closeAll();
  });

  test('scrolls its own text before advancing the story', async ({ page }) => {
    const card = page.locator('.jgis-story-map-overlay-content').first();
    const scrollHost = page.getByTestId('jgis-story-stage-scroll-host');
    await expect(card).toBeVisible();

    const scrollTop = (locator: typeof card) =>
      locator.evaluate(el => el.scrollTop);

    // The card fits in the stage and overflows, rather than running off it.
    const stage = await page.locator('.jgis-story-stage').boundingBox();
    const box = await card.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      stage!.y + stage!.height + 1,
    );
    expect(
      await card.evaluate(el => el.scrollHeight > el.clientHeight),
    ).toBeTruthy();

    // Wheel over the card scrolls the card, not the story.
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => scrollTop(card)).toBeGreaterThan(0);
    expect(await scrollTop(scrollHost)).toBe(0);

    // Once the card is at its end, the wheel moves the story on.
    await card.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    await page.mouse.wheel(0, 200);
    await expect.poll(() => scrollTop(scrollHost)).toBeGreaterThan(0);
  });

  test('scrolls its own text when its scrollbar is dragged', async ({
    page,
  }) => {
    const card = page.locator('.jgis-story-map-overlay-content').first();
    const scrollHost = page.getByTestId('jgis-story-stage-scroll-host');
    await expect(card).toBeVisible();

    const { scrollbarWidth, clientHeight } = await card.evaluate(el => ({
      scrollbarWidth: (el as HTMLElement).offsetWidth - el.clientWidth,
      clientHeight: el.clientHeight,
    }));
    expect(scrollbarWidth).toBeGreaterThan(0);

    // Drag the thumb, which sits at the top of the card's right edge, just
    // below the square up-arrow button of classic (non-overlay) scrollbars.
    const box = (await card.boundingBox())!;
    const x = box.x + box.width - scrollbarWidth / 2;
    const y = box.y + scrollbarWidth + 5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 100, { steps: 10 });
    await page.mouse.up();

    // Further than a click on the track, which only pages by one card height.
    expect(await card.evaluate(el => el.scrollTop)).toBeGreaterThan(
      clientHeight,
    );
    expect(await scrollHost.evaluate(el => el.scrollTop)).toBe(0);
  });
});
