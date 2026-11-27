import { expect, test } from '@jupyterlab/galata';
import * as fs from 'fs';
import * as path from 'path';

import {
  getLayerSummary,
  getTileLoadStats,
  getView,
  mapKeyInCell,
  waitForMapReady,
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
  {
    layers: 1,
    vectors: 0,
    view: { latitude: 20.718, longitude: 129.94, zoom: 4 },
  },
  {
    layers: 2,
    vectors: 1,
    view: { latitude: 19.089113, longitude: -87.561299, zoom: 6 },
  },
  {
    layers: 2,
    vectors: 1,
    view: { latitude: 57.676696, longitude: 11.864487, zoom: 12 },
  },
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
    // EXPECTED_CELLS describes one notebook, so a second one added to the
    // folder would otherwise go untested.
    expect(fs.readdirSync(path.resolve(__dirname, './notebooks'))).toEqual([
      NOTEBOOK,
    ]);

    await page.notebook.openByPath(`${tmpPath}/${NOTEBOOK}`);
    await page.notebook.activate(NOTEBOOK);
    await expect(page.getByLabel(NOTEBOOK).getByText('XPython')).toBeVisible();

    expect(await page.notebook.getCellCount()).toBe(EXPECTED_CELLS.length);

    await page.notebook.run();

    for (const [index, expected] of EXPECTED_CELLS.entries()) {
      const cell = await page.notebook.getCellOutputLocator(index);
      expect(cell, `cell ${index} produced no output`).not.toBeNull();

      const map = await mapKeyInCell(cell!);
      await waitForMapReady(page, map);

      const layers = await getLayerSummary(page, map);
      expect(layers, `cell ${index} layers`).toHaveLength(expected.layers);

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

      // A tile source is 'ready' whatever its URL answers, so count the tiles
      // that actually came back.
      for (const tiles of await getTileLoadStats(page, map)) {
        expect(
          tiles.loaded,
          `cell ${index} tiles loaded for layer ${tiles.id}`,
        ).toBeGreaterThan(0);
      }

      if (expected.view) {
        const view = await getView(page, map);
        expect(view.zoom, `cell ${index} zoom`).toBe(expected.view.zoom);
        expect(view.latitude, `cell ${index} latitude`).toBeCloseTo(
          expected.view.latitude,
          2,
        );
        expect(view.longitude, `cell ${index} longitude`).toBeCloseTo(
          expected.view.longitude,
          2,
        );
      }
    }
  });
});
