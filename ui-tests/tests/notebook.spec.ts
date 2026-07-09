import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import * as path from 'path';
const klaw = require('klaw-sync');

const FILENAME = 'eq.geojson';

const testCellOutputs = async (
  page: IJupyterLabPageFixture,
  tmpPath: string,
  theme: 'JupyterLab Light' | 'JupyterLab Dark',
) => {
  const paths = klaw(path.resolve(__dirname, './notebooks'), {
    nodir: true,
  });
  const notebooks = paths.map(item => path.basename(item.path));

  const contextPrefix = theme == 'JupyterLab Light' ? 'light' : 'dark';
  page.theme.setTheme(theme);

  for (const notebook of notebooks) {
    const results: Array<{ cellIndex: number; screenshot: Buffer }> = [];

    await page.notebook.openByPath(`${tmpPath}/${notebook}`);
    await page.notebook.activate(notebook);
    await expect(page.getByLabel(notebook).getByText('XPython')).toBeVisible();

    const getCaptureImageName = (
      contextPrefix: string,
      notebook: string,
      id: number,
    ): string => {
      return `${contextPrefix}-${notebook}-cell-${id}.png`;
    };

    await page.notebook.runCellByCell({
      onAfterCellRun: async (cellIndex: number) => {
        const cellType = await page.notebook.getCellType(cellIndex);
        if (cellType !== 'code') {
          return; // skip Markdown cells
        }

        await page.waitForTimeout(5000);

        const cell = await page.notebook.getCellOutputLocator(cellIndex);
        if (cell) {
          results.push({
            cellIndex,
            screenshot: await cell.screenshot(),
          });
        }
      },
    });

    for (const { cellIndex, screenshot } of results) {
      expect(screenshot).toMatchSnapshot({
        name: getCaptureImageName(contextPrefix, notebook, cellIndex),
        maxDiffPixelRatio: 0.02, // The URL of the tiler layers will be different every time
      });
    }

    await page.notebook.close(true);
  }
};

test.describe('Notebook API Visual Regression', () => {
  test.beforeEach(async ({ page, tmpPath }) => {
    page.on('console', message => {
      console.log('CONSOLE MSG ---', message.text());
    });

    await page.contents.uploadDirectory(
      path.resolve(__dirname, './notebooks'),
      tmpPath,
    );
    await page.contents.uploadFile(
      path.resolve(__dirname, `./gis-files/${FILENAME}`),
      `/${tmpPath}/${FILENAME}`,
    );
    await page.filebrowser.openDirectory(tmpPath);
  });

  test('Light theme: Cell outputs should be correct', async ({
    page,
    tmpPath,
  }) => {
    await testCellOutputs(page, tmpPath, 'JupyterLab Light');
  });

  test('Dark theme: Cell outputs should be correct', async ({
    page,
    tmpPath,
  }) => {
    await testCellOutputs(page, tmpPath, 'JupyterLab Dark');
  });
});
