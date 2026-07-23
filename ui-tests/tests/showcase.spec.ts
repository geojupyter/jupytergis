import { expect, galata, test } from '@jupyterlab/galata';
import type { Page } from '@playwright/test';
import path from 'path';

/**
 * Showcase snapshots — wide-screen, visually rich renders used in documentation.
 * These are not regression tests; they capture the UI at its best.
 */
test.use({ autoGoto: false });

interface IShowcase {
  name: string;
  file: string;
  snapshot: string;
  setup?: (page: Page) => Promise<void>;
}

const SHOWCASES: IShowcase[] = [
  {
    name: 'Macrostrat geology overlay',
    file: 'macrostrat.jGIS',
    snapshot: 'showcase-macrostrat-geology.jpg',
  },
  {
    name: 'Earthquakes symbology',
    file: 'earthquakes.jGIS',
    snapshot: 'showcase-earthquakes.jpg',
  },
  // {
  //   name: 'Story map',
  //   file: 'story_map.jGIS',
  //   snapshot: 'showcase-story-map.jpg',
  //   setup: async (page: Page) => {
  //     // Open the Story tab and enable preview mode
  //     const storyTab = page.getByRole('tab', { name: /Story/ });
  //     await storyTab.click();
  //     const previewSwitch = page.locator('#preview-mode-switch');
  //     await previewSwitch.click();
  //   },
  // },
  {
    name: 'France hiking layers',
    file: 'france_hiking.jGIS',
    snapshot: 'showcase-france-hiking.jpg',
  },
  {
    name: 'Buildings vector tiles',
    file: 'buildings.jGIS',
    snapshot: 'showcase-buildings.jpg',
  },
];

test.describe('Showcase', () => {
  test.beforeAll(async ({ request }) => {
    const content = galata.newContentsHelper(request);

    for (const { file } of SHOWCASES) {
      await content.uploadFile(
        path.resolve(__dirname, `../../examples/${file}`),
        `showcase/${file}`,
      );
    }

    // Extra data files needed by specific examples
    await content.uploadFile(
      path.resolve(__dirname, '../../examples/data/eq.geojson'),
      'showcase/data/eq.geojson',
    );
  });

  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1920, height: 1080 });
  });

  for (const { name, file, snapshot, setup } of SHOWCASES) {
    test(name, async ({ page }) => {
      await page.goto();
      await page.notebook.openByPath(`showcase/${file}`);
      await page.notebook.activate(`showcase/${file}`);

      await page.locator('div.jGIS-Spinner').waitFor({ state: 'hidden' });

      const okBtn = page.getByRole('button', { name: 'Ok' });
      if (await okBtn.isVisible()) {
        await okBtn.click();
      }

      const main = page.locator('.jp-MainAreaWidget:not(.lm-mod-hidden)');
      await main.waitFor({ state: 'visible' });

      if (setup) {
        await setup(page);
      }

      await page.waitForTimeout(15000);

      expect(
        await main.screenshot({ type: 'jpeg', quality: 80 }),
      ).toMatchSnapshot({
        name: snapshot,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
