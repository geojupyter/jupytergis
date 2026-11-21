/**
 * @jest-environment jsdom
 */

jest.mock('@/src/shared/store', () => {
  const stateDb = {
    fetch: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  };

  return {
    GlobalStateDbManager: {
      getInstance: () => ({
        getStateDb: () => stateDb,
      }),
    },
  };
});

jest.mock('@/src/tools', () => ({
  fetchWithProxies: jest.fn(),
}));

import type { IJupyterGISModel } from '@jupytergis/schema';
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  StacResultsProvider,
  useStacResultsContext,
} from '@/src/features/stac-browser/context/StacResultsContext';
import useGeodesSearch from '@/src/features/stac-browser/hooks/useGeodesSearch';
import { fetchWithProxies } from '@/src/tools';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const GEODES_URL = 'https://geodes-portal.cnes.fr/api/stac/';

const mockStacResponse = {
  context: { returned: 1, limit: 12, matched: 1 },
  features: [
    {
      type: 'Feature',
      stac_version: '1.0.0',
      id: 'test-item-1',
      geometry: null,
      bbox: [-10.0, -10.0, 10.0, 10.0],
      properties: {
        title: 'Test STAC Item 1',
        datetime: '2024-01-01T00:00:00Z',
      },
      links: [],
      assets: {
        visual: {
          title: 'True Color Image',
          type: 'image/tiff',
        },
      },
      collection: 'test-collection',
    },
  ],
  links: [],
  type: 'FeatureCollection',
};

function createModel(): IJupyterGISModel {
  return {
    updateBboxSignal: {
      connect: jest.fn(),
      disconnect: jest.fn(),
    },
  } as unknown as IJupyterGISModel;
}

interface IHarnessApi {
  filterSetters: ReturnType<typeof useGeodesSearch>['filterSetters'];
  setSelectedUrl: (url: string) => void;
  results: ReturnType<typeof useStacResultsContext>['results'];
}

function mountGeodesSearch(model: IJupyterGISModel) {
  const container = document.createElement('div');
  const root: Root = createRoot(container);
  let latest: IHarnessApi | null = null;

  function Inner(): null {
    const geodes = useGeodesSearch({ model });
    const { setSelectedUrl, results } = useStacResultsContext();

    useEffect(() => {
      latest = {
        filterSetters: geodes.filterSetters,
        setSelectedUrl,
        results,
      };
    });

    return null;
  }

  function Harness(): JSX.Element {
    return React.createElement(
      StacResultsProvider,
      { model },
      React.createElement(Inner),
    );
  }

  act(() => {
    root.render(React.createElement(Harness));
  });

  return {
    get current() {
      if (!latest) {
        throw new Error('Harness was not initialized');
      }

      return latest;
    },

    async settle() {
      await act(async () => {
        await Promise.resolve();
      });
    },

    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('useGeodesSearch', () => {
  const fetchMock = fetchWithProxies as jest.MockedFunction<
    typeof fetchWithProxies
  >;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(mockStacResponse as never);
    document.cookie = '_xsrf=test-token';
  });

  it('searches GEODES with a selected dataset and stores the feature results', async () => {
    const model = createModel();
    const view = mountGeodesSearch(model);

    await view.settle();

    await act(async () => {
      view.current.setSelectedUrl(GEODES_URL);
    });
    await view.settle();

    await act(async () => {
      view.current.filterSetters.collections(new Set(['Sentinel 2']));
      view.current.filterSetters.datasets(new Set(['PEPS_S2_L1C']));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    const [url, , , options] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(`${GEODES_URL}search`);

    const body = JSON.parse((options as { body: string }).body);
    expect(body.query.dataset.in).toEqual(['PEPS_S2_L1C']);

    await view.settle();
    expect(view.current.results).toHaveLength(1);
    expect(view.current.results[0].id).toBe('test-item-1');

    view.unmount();
  });
});
