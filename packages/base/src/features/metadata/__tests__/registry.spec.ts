import { IJGISLayer, IJGISSource, IJupyterGISModel } from '@jupytergis/schema';

import { getLayerMetadata } from '../registry';

// The format-specific providers reach for the network and for the GeoTIFF /
// Zarr readers. This suite is about how the registry resolves a selection and
// falls back, so they are stubbed out.
jest.mock('../providers/geoTiffProvider', () => ({
  geoTiffProvider: jest.fn(async () => ({
    crs: { code: 'EPSG:32636' },
    bands: [{ band: 1, name: 'Band 1' }],
  })),
}));
jest.mock('../providers/geoZarrProvider', () => ({
  geoZarrProvider: jest.fn(),
}));
jest.mock('../providers/vectorProvider', () => ({ vectorProvider: jest.fn() }));
jest.mock('../providers/tileProvider', () => ({ tileProvider: jest.fn() }));

interface IFakeModelOptions {
  layers?: Record<string, IJGISLayer>;
  sources?: Record<string, IJGISSource>;
  extents?: Record<string, number[]>;
}

function fakeModel(options: IFakeModelOptions): IJupyterGISModel {
  const { layers = {}, sources = {}, extents = {} } = options;

  return {
    getLayer: (id: string) => layers[id],
    getSource: (id: string) => sources[id],
    getExtent: (id: string) => extents[id],
    getOptions: () => ({ projection: 'EPSG:3857' }),
  } as unknown as IJupyterGISModel;
}

const labels = (metadata: { general: { label: string }[] }) =>
  metadata.general.map(field => field.label);

describe('getLayerMetadata', () => {
  it('describes a layer together with its source', async () => {
    const model = fakeModel({
      layers: {
        layer1: {
          name: 'COG Layer',
          type: 'GeoTiffLayer',
          visible: true,
          parameters: { source: 'source1' },
        },
      },
      sources: {
        source1: {
          name: 'Custom GeoTiff Source',
          type: 'GeoTiffSource',
          parameters: { urls: [{ url: 'https://example.org/x.tif' }] },
        },
      },
    });

    const metadata = await getLayerMetadata(model, 'layer1');

    expect(labels(metadata)).toEqual([
      'Layer',
      'Layer type',
      'Source',
      'Source type',
      'URL',
    ]);
    // The format-specific provider's findings win over the baseline.
    expect(metadata.crs?.code).toBe('EPSG:32636');
    expect(metadata.bands).toHaveLength(1);
  });

  it('spaces out the type names without splitting the format name', async () => {
    const model = fakeModel({
      layers: {
        layer1: {
          name: 'COG Layer',
          type: 'GeoTiffLayer',
          visible: true,
          parameters: { source: 'source1' },
        },
      },
      sources: {
        source1: { name: 'src', type: 'GeoTiffSource', parameters: {} },
      },
    });

    const metadata = await getLayerMetadata(model, 'layer1');
    const values = Object.fromEntries(
      metadata.general.map(field => [field.label, field.value]),
    );

    expect(values['Layer type']).toBe('GeoTiff Layer');
    expect(values['Source type']).toBe('GeoTiff Source');
  });

  it('describes a source selected on its own', async () => {
    const model = fakeModel({
      sources: {
        source1: {
          name: 'Custom GeoTiff Source',
          type: 'GeoTiffSource',
          parameters: { urls: [{ url: 'https://example.org/x.tif' }] },
        },
      },
    });

    const metadata = await getLayerMetadata(model, 'source1');

    expect(labels(metadata)).toEqual(['Source', 'Source type', 'URL']);
  });

  it('still describes a layer that holds its data inline', async () => {
    const model = fakeModel({
      layers: {
        layer1: {
          name: 'STAC Layer',
          type: 'StacLayer',
          visible: true,
          parameters: { data: { id: 'an-item' } },
        },
      },
    });

    const metadata = await getLayerMetadata(model, 'layer1');

    expect(labels(metadata)).toEqual(['Layer', 'Layer type']);
    expect(metadata.notes?.join(' ')).toContain('no file to inspect');
  });

  it('says so when a source type has no provider yet', async () => {
    const model = fakeModel({
      layers: {
        layer1: {
          name: 'Marker Layer',
          type: 'VectorLayer',
          visible: true,
          parameters: { source: 'source1' },
        },
      },
      sources: {
        source1: { name: 'Markers', type: 'MarkerSource', parameters: {} },
      },
    });

    const metadata = await getLayerMetadata(model, 'layer1');

    expect(metadata.notes?.join(' ')).toContain('MarkerSource');
  });

  it('falls back to the extent the map computed, flagged as approximate', async () => {
    const model = fakeModel({
      layers: {
        layer1: {
          name: 'Markers',
          type: 'VectorLayer',
          visible: true,
          parameters: { source: 'source1' },
        },
      },
      sources: {
        source1: { name: 'Markers', type: 'MarkerSource', parameters: {} },
      },
      extents: { layer1: [-20037508, -20037508, 20037508, 20037508] },
    });

    const metadata = await getLayerMetadata(model, 'layer1');

    expect(metadata.extent?.approximate).toBe(true);
    expect(metadata.extent?.nativeCrs).toBe('EPSG:3857');
    expect(metadata.extent?.wgs84?.[0]).toBeCloseTo(-180, 3);
  });

  it('rejects an id that is neither a layer nor a source', async () => {
    await expect(getLayerMetadata(fakeModel({}), 'nope')).rejects.toThrow();
  });
});
