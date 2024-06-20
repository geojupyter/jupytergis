import { expect, IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import * as path from 'path';
const klaw = require('klaw-sync');

const testCellOutputs = async (
  page: IJupyterLabPageFixture,
  tmpPath: string,
  theme: 'JupyterLab Light' | 'JupyterLab Dark'
) => {
  const paths = klaw(path.resolve(__dirname, './notebooks'), { nodir: true });
  const notebooks = paths.map(item => path.basename(item.path));

  const contextPrefix = theme == 'JupyterLab Light' ? 'light' : 'dark';
  page.theme.setTheme(theme);

  for (const notebook of notebooks) {
    let results: Buffer[] = [];

    await page.notebook.openByPath(`${tmpPath}/${notebook}`);
    await page.notebook.activate(notebook);

    await page.waitForTimeout(1000);
    if (await page.getByRole('button', { name: 'Ok' }).isVisible()) {
      await page.getByRole('button', { name: 'Ok' }).click();
    }
    let numCellImages = 0;

    const getCaptureImageName = (
      contextPrefix: string,
      notebook: string,
      id: number
    ): string => {
      return `${contextPrefix}-${notebook}-cell-${id}.png`;
    };

    await page.notebook.runCellByCell({
      onAfterCellRun: async (cellIndex: number) => {
        await page.waitForTimeout(5000);

        const cell = await page.notebook.getCellOutput(cellIndex);
        if (cell) {
          results.push(await cell.screenshot());
          numCellImages++;
        }
      }
    });

    for (let c = 0; c < numCellImages; ++c) {
      expect(results[c]).toMatchSnapshot(
        getCaptureImageName(contextPrefix, notebook, c)
      );
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
      tmpPath
    );
    await page.filebrowser.openDirectory(tmpPath);
  });

  test('Light theme: Cell outputs should be correct', async ({
    page,
    tmpPath
  }) => {
    await testCellOutputs(page, tmpPath, 'JupyterLab Light');
  });

  test('Dark theme: Cell outputs should be correct', async ({
    page,
    tmpPath
  }) => {
    await testCellOutputs(page, tmpPath, 'JupyterLab Dark');
  });
});
