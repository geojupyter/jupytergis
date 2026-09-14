import { IJGISLayer, IJGISSource, IJupyterGISModel } from '@jupytergis/schema';

import { METADATA_VERSION } from '../persistence';
import { geoTiffProvider } from '../providers/geoTiffProvider';
import { getLayerMetadata, populateSourceMetadata } from '../registry';

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

interface IFakeModelOptions {
  layers?: Record<string, IJGISLayer>;
  sources?: Record<string, IJGISSource>;
  extents?: Record<string, number[]>;
}

const updateSource = jest.fn();

function fakeModel(options: IFakeModelOptions): IJupyterGISModel {
  const { layers = {}, sources = {}, extents = {} } = options;

  return {
    getLayer: (id: string) => layers[id],
    getSource: (id: string) => sources[id],
    getExtent: (id: string) => extents[id],
    getOptions: () => ({ projection: 'EPSG:3857' }),
    sharedModel: { updateSource },
  } as unknown as IJupyterGISModel;
}

beforeEach(() => {
  jest.clearAllMocks();
});

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

    expect(labels(metadata)).toEqual(['Source type', 'URL']);
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

describe('stored metadata', () => {
  const source = (metadata?: IJGISSource['metadata']): IJGISSource => ({
    name: 'Custom GeoTiff Source',
    type: 'GeoTiffSource',
    parameters: { urls: [{ url: 'https://example.org/x.tif' }] },
    metadata,
  });

  const fingerprint = {
    source: 'https://example.org/x.tif',
    version: METADATA_VERSION,
  };

  const fresh: IJGISSource['metadata'] = {
    crs: { code: 'EPSG:4326' },
    fingerprint,
  };

  it('is read from the document instead of the file', async () => {
    const model = fakeModel({ sources: { source1: source(fresh) } });

    const metadata = await getLayerMetadata(model, 'source1');

    expect(metadata.crs?.code).toBe('EPSG:4326');
    expect(geoTiffProvider).not.toHaveBeenCalled();
  });

  it('is re-read when it was written by an older version', async () => {
    const model = fakeModel({
      sources: {
        source1: source({
          ...fresh,
          fingerprint: { ...fingerprint, version: METADATA_VERSION - 1 },
        }),
      },
    });

    const metadata = await getLayerMetadata(model, 'source1');

    expect(geoTiffProvider).toHaveBeenCalled();
    expect(metadata.crs?.code).toBe('EPSG:32636');
  });

  it('is re-read when the source now points somewhere else', async () => {
    const model = fakeModel({
      sources: {
        source1: source({
          ...fresh,
          fingerprint: { ...fingerprint, source: 'https://old.example' },
        }),
      },
    });

    await getLayerMetadata(model, 'source1');

    expect(geoTiffProvider).toHaveBeenCalled();
  });

  it('is written back after reading a source that had none', async () => {
    const model = fakeModel({ sources: { source1: source() } });

    await getLayerMetadata(model, 'source1');
    await Promise.resolve();

    expect(updateSource).toHaveBeenCalledWith(
      'source1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          crs: { code: 'EPSG:32636' },
          fingerprint: expect.objectContaining({
            source: 'https://example.org/x.tif',
            version: METADATA_VERSION,
          }),
        }),
      }),
    );
  });
});

describe('populateSourceMetadata', () => {
  it('reads and stores metadata for a newly added source', async () => {
    const model = fakeModel({
      sources: {
        source1: {
          name: 'Custom GeoTiff Source',
          type: 'GeoTiffSource',
          parameters: { urls: [{ url: 'https://example.org/x.tif' }] },
        },
      },
    });

    await expect(populateSourceMetadata(model, 'source1')).resolves.toBe(true);
    expect(updateSource).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a source that already holds current metadata', async () => {
    const model = fakeModel({
      sources: {
        source1: {
          name: 'Custom GeoTiff Source',
          type: 'GeoTiffSource',
          parameters: { urls: [{ url: 'https://example.org/x.tif' }] },
          metadata: {
            crs: { code: 'EPSG:4326' },
            fingerprint: {
              source: 'https://example.org/x.tif',
              version: METADATA_VERSION,
            },
          },
        },
      },
    });

    await expect(populateSourceMetadata(model, 'source1')).resolves.toBe(false);
    expect(geoTiffProvider).not.toHaveBeenCalled();
    expect(updateSource).not.toHaveBeenCalled();
  });

  it('does not store metadata for a source whose data is inline', async () => {
    const model = fakeModel({
      sources: {
        source1: {
          name: 'Inline GeoJSON',
          type: 'GeoJSONSource',
          parameters: { data: { type: 'FeatureCollection', features: [] } },
        },
      },
    });

    await expect(populateSourceMetadata(model, 'source1')).resolves.toBe(false);
    expect(updateSource).not.toHaveBeenCalled();
  });
});

describe('tiled services', () => {
  it('are described from the document and never stored', async () => {
    const model = fakeModel({
      sources: {
        source1: {
          name: 'OpenStreetMap',
          type: 'RasterSource',
          parameters: {
            url: 'https://tile.example.org/{z}/{x}/{y}.png',
            minZoom: 0,
            maxZoom: 19,
          },
        },
      },
    });

    const metadata = await getLayerMetadata(model, 'source1');

    expect(metadata.crs?.code).toBe('EPSG:3857');
    expect(metadata.pyramid?.maxZoom).toBe(19);
    // Everything above came from the source's own parameters, so writing it
    // back would duplicate the document into itself.
    expect(updateSource).not.toHaveBeenCalled();
    await expect(populateSourceMetadata(model, 'source1')).resolves.toBe(false);
  });

  it('are not reported as an unreadable source type', async () => {
    const model = fakeModel({
      sources: {
        source1: {
          name: 'WMS',
          type: 'WmsTileSource',
          parameters: { url: 'https://wms.example.org' },
        },
      },
    });

    const metadata = await getLayerMetadata(model, 'source1');

    expect(metadata.notes?.join(' ')).not.toContain('cannot yet read');
  });
});
