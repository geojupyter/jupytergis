import { IJGISSource } from '@jupytergis/schema';

import {
  METADATA_VERSION,
  fromStoredMetadata,
  isEmptyMetadata,
  isMetadataFresh,
  shouldPersistMetadata,
  toStoredMetadata,
} from '../persistence';

const remote: IJGISSource = {
  name: 'Remote COG',
  type: 'GeoTiffSource',
  parameters: { urls: [{ url: 'https://example.org/x.tif' }] },
};

describe('shouldPersistMetadata', () => {
  it('stores metadata for a source that points at a file', () => {
    expect(shouldPersistMetadata(remote)).toBe(true);
  });

  it('does not store metadata for a data URI', () => {
    expect(
      shouldPersistMetadata({
        name: 'Inline',
        type: 'GeoJSONSource',
        parameters: { path: 'data:application/json;base64,e30=' },
      }),
    ).toBe(false);
  });

  it('does not store metadata for a source with no location at all', () => {
    expect(
      shouldPersistMetadata({ name: 'Marker', type: 'MarkerSource' }),
    ).toBe(false);
  });
});

describe('isMetadataFresh', () => {
  it('is stale when nothing has been stored', () => {
    expect(isMetadataFresh(undefined, remote)).toBe(false);
  });

  it('is stale when no fingerprint was recorded', () => {
    expect(isMetadataFresh({ crs: { code: 'EPSG:4326' } }, remote)).toBe(false);
  });

  it('is fresh for the same location and version', () => {
    expect(
      isMetadataFresh(
        {
          fingerprint: {
            source: 'https://example.org/x.tif',
            version: METADATA_VERSION,
          },
        },
        remote,
      ),
    ).toBe(true);
  });
});

describe('toStoredMetadata', () => {
  it('drops the rows that are derived from the document', () => {
    const stored = toStoredMetadata(
      {
        general: [{ label: 'Layer', value: 'Elevation' }],
        crs: { code: 'EPSG:4326' },
      },
      remote,
    );

    expect(stored).not.toHaveProperty('general');
    expect(stored.crs).toEqual({ code: 'EPSG:4326' });
  });

  it('keeps the notes that qualify a value, so an estimate stays labelled', () => {
    const notes = ['Value ranges were estimated from a downsampled overview.'];

    const stored = toStoredMetadata(
      { bands: [{ band: 1, name: 'Band 1', minimum: 0, maximum: 255 }], notes },
      remote,
    );

    expect(fromStoredMetadata(stored).notes).toEqual(notes);
  });

  it('records where and when it read from', () => {
    const stored = toStoredMetadata({ crs: { code: 'EPSG:4326' } }, remote);

    expect(stored.fingerprint).toEqual({
      source: 'https://example.org/x.tif',
      version: METADATA_VERSION,
      readAt: expect.any(String),
    });
  });
});

describe('isEmptyMetadata', () => {
  it('treats a result with nothing but notes as empty, so it is retried', () => {
    expect(isEmptyMetadata({ notes: ['Could not read this source.'] })).toBe(
      true,
    );
  });

  it('treats any read section as worth storing', () => {
    expect(isEmptyMetadata({ vector: { featureCount: 0 } })).toBe(false);
  });
});
