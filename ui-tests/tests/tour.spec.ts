import {
  IJupyterLabPageFixture,
  expect,
  galata,
  test,
} from '@jupyterlab/galata';
import { Locator } from '@playwright/test';
import path from 'path';

// A document with layers, so the "Edit a layer" step has a layer item to
// highlight.
const FILENAME = 'france-hiking.jGIS';

const EXPECTED_TITLES = [
  'Welcome to the JupyterGIS Feature Tour',
  'Add a basemap',
  'Add layers',
  'Layers panel',
  'Edit a layer',
  'Identify features',
  'Draw on the map',
  'Annotate and collaborate',
  'Explore data over time',
  'Automate with Python',
  'Create a story map',
];

const openGIS = async (
  page: IJupyterLabPageFixture,
  tmpPath: string,
  filename: string,
): Promise<Locator> => {
  await page.filebrowser.open(`/${tmpPath}/${filename}`);
  await page.waitForCondition(
    async () => await page.activity.isTabActive(filename),
  );
  return (await page.activity.getPanelLocator(filename)) as Locator;
};

test.describe('#featureTour', () => {
  test.beforeEach(async ({ request, tmpPath }) => {
    const content = galata.newContentsHelper(request);
    await content.uploadFile(
      path.resolve(__dirname, `./gis-files/${FILENAME}`),
      `/${tmpPath}/${FILENAME}`,
    );
  });

  test.afterEach(async ({ page, tmpPath }) => {
    await page.activity.closeAll();
    if (await page.filebrowser.contents.fileExists(FILENAME)) {
      await page.filebrowser.contents.deleteFile(FILENAME);
    }
  });

  test('walks through every step of the feature tour', async ({
    page,
    tmpPath,
  }) => {
    await openGIS(page, tmpPath, FILENAME);

    // The tour is launched from a button in the JupyterGIS document toolbar.
    await page.getByTestId('launch-tour-button').click();

    const tooltip = page.locator('.react-joyride__tooltip');
    await expect(tooltip).toBeVisible();

    // Every step must render its target: react-joyride silently skips a step
    // whose target is missing, so asserting each title appears in order also
    // guards every anchor selector against regressions.
    const title = tooltip.locator('h1, h2, h3, h4, h5, h6').first();
    for (const expectedTitle of EXPECTED_TITLES) {
      await expect(title).toHaveText(expectedTitle);
      await tooltip.locator('[data-action="primary"]').click();
    }

    // After the last step the tour closes.
    await expect(tooltip).toBeHidden();
  });
});
