import { expect, test } from '@jupyterlab/galata';
import * as path from 'path';

import {
  getCellLayerSummary,
  getCellView,
  waitForCellMapReady,
} from './utils/map';

const FILENAME = 'eq.geojson';
const NOTEBOOK = 'Notebook.ipynb';

/**
 * What each cell of `./notebooks/Notebook.ipynb` is expected to build. This
 * mirrors the `GISDocument` calls in that notebook, so a change to the Python
 * API that stops producing layers, or moves the view, fails here.
 *
 * The old version of this spec compared a screenshot of every cell output in
 * both themes. Those images broke whenever unrelated UI chrome changed, while
 * the map itself was identical.
 */
const EXPECTED_CELLS = [
  { layers: 1, vectors: 0 },
  { layers: 1, vectors: 0, view: { latitude: 21, longitude: 130, zoom: 4 } },
  { layers: 2, vectors: 1, view: { latitude: 19, longitude: -88, zoom: 6 } },
  { layers: 2, vectors: 1, view: { latitude: 58, longitude: 12, zoom: 12 } },
  { layers: 1, vectors: 0 },
];

test.describe('Notebook API', () => {
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

  test('Cell outputs build the expected maps', async ({ page, tmpPath }) => {
    await page.notebook.openByPath(`${tmpPath}/${NOTEBOOK}`);
    await page.notebook.activate(NOTEBOOK);
    await expect(page.getByLabel(NOTEBOOK).getByText('XPython')).toBeVisible();

    await page.notebook.run();

    for (const [index, expected] of EXPECTED_CELLS.entries()) {
      const cell = await page.notebook.getCellOutputLocator(index);
      expect(cell, `cell ${index} produced no output`).not.toBeNull();

      await waitForCellMapReady(cell!);

      const layers = await getCellLayerSummary(cell!);
      expect(layers, `cell ${index} layers`).toHaveLength(expected.layers);

      for (const layer of layers) {
        expect(layer.sourceState, `cell ${index} source state`).not.toBe(
          'error',
        );
      }

      const vectors = layers.filter(layer => layer.kind === 'vector');
      expect(vectors, `cell ${index} vector layers`).toHaveLength(
        expected.vectors,
      );
      for (const vector of vectors) {
        expect(
          vector.featureCount,
          `cell ${index} vector features`,
        ).toBeGreaterThan(0);
      }

      if (expected.view) {
        expect(await getCellView(cell!), `cell ${index} view`).toEqual(
          expected.view,
        );
      }
    }
  });
});
