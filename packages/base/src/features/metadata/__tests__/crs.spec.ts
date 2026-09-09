import {
  buildCrsMetadata,
  getCrsInfoUrl,
  getCrsUnits,
  getProj4Definition,
  getCrsName,
  normalizeCrsCode,
  transformExtent,
} from '../utils/crs';

describe('normalizeCrsCode', () => {
  it('turns a bare number into an EPSG code', () => {
    expect(normalizeCrsCode(26915)).toBe('EPSG:26915');
    expect(normalizeCrsCode('26915')).toBe('EPSG:26915');
  });

  it('upper-cases the authority', () => {
    expect(normalizeCrsCode('epsg:4326')).toBe('EPSG:4326');
    expect(normalizeCrsCode('EPSG: 4326')).toBe('EPSG:4326');
  });

  it('unpacks OGC URNs', () => {
    expect(normalizeCrsCode('urn:ogc:def:crs:EPSG::4326')).toBe('EPSG:4326');
    expect(normalizeCrsCode('urn:ogc:def:crs:OGC:1.3:CRS84')).toBe('OGC:CRS84');
  });

  it('returns undefined for empty input', () => {
    expect(normalizeCrsCode(undefined)).toBeUndefined();
    expect(normalizeCrsCode(null)).toBeUndefined();
    expect(normalizeCrsCode('')).toBeUndefined();
    expect(normalizeCrsCode('   ')).toBeUndefined();
  });

  it('rejects a non-finite numeric code', () => {
    expect(normalizeCrsCode(NaN)).toBeUndefined();
  });
});

describe('getProj4Definition', () => {
  it('finds the definition for a known code', () => {
    expect(getProj4Definition('EPSG:26915')).toContain('+proj=utm');
    expect(getProj4Definition('EPSG:26915')).toContain('+zone=15');
  });

  it('normalizes before looking up', () => {
    expect(getProj4Definition('4326')).toContain('+proj=longlat');
  });

  it('returns undefined for a code it does not know', () => {
    expect(getProj4Definition('EPSG:999999')).toBeUndefined();
  });
});

describe('getCrsUnits', () => {
  it('reads the unit out of a projected definition', () => {
    expect(getCrsUnits('+proj=utm +zone=15 +datum=NAD83 +units=m')).toBe('m');
  });

  it('reports degrees for a geographic definition', () => {
    expect(getCrsUnits('+proj=longlat +datum=WGS84 +no_defs')).toBe('degrees');
  });

  it('returns undefined when there is nothing to read', () => {
    expect(getCrsUnits(undefined)).toBeUndefined();
    expect(getCrsUnits('+proj=merc')).toBeUndefined();
  });
});

describe('getCrsInfoUrl', () => {
  it('links EPSG codes to epsg.io', () => {
    expect(getCrsInfoUrl('EPSG:3857')).toBe('https://epsg.io/3857');
    expect(getCrsInfoUrl(4326)).toBe('https://epsg.io/4326');
  });

  it('offers no link for a non-EPSG authority', () => {
    expect(getCrsInfoUrl('OGC:CRS84')).toBeUndefined();
    expect(getCrsInfoUrl(undefined)).toBeUndefined();
  });
});

describe('getCrsName', () => {
  it('names the CRSs people meet constantly', () => {
    expect(getCrsName('EPSG:4326')).toBe('WGS 84');
    expect(getCrsName('epsg:3857')).toBe('WGS 84 / Pseudo-Mercator');
  });

  it('names the ones a hardcoded table would have missed', () => {
    expect(getCrsName('EPSG:26915')).toBe('NAD83 / UTM zone 15N');
    expect(getCrsName('urn:ogc:def:crs:EPSG::32636')).toBe(
      'WGS 84 / UTM zone 36N',
    );
  });

  it('has no name for a code no authority defines', () => {
    expect(getCrsName('EPSG:999999')).toBeUndefined();
  });
});

describe('buildCrsMetadata', () => {
  it('fills in the proj4 string and units from the code', () => {
    const crs = buildCrsMetadata({ code: 26915 });

    expect(crs).toBeDefined();
    expect(crs!.code).toBe('EPSG:26915');
    expect(crs!.proj4).toContain('+proj=utm');
    expect(crs!.units).toBe('m');
  });

  it('prefers a name supplied by the file over the well-known one', () => {
    const crs = buildCrsMetadata({ code: 4326, name: 'WGS 84 (from file)' });

    expect(crs!.name).toBe('WGS 84 (from file)');
  });

  it('falls back to the well-known name', () => {
    expect(buildCrsMetadata({ code: 4326 })!.name).toBe('WGS 84');
  });

  it('does not report WKT it was not given', () => {
    expect(buildCrsMetadata({ code: 4326 })!.wkt).toBeUndefined();
  });

  it('returns undefined when it knows nothing at all', () => {
    expect(buildCrsMetadata({})).toBeUndefined();
    expect(buildCrsMetadata({ code: '' })).toBeUndefined();
  });

  it('still reports an unknown code rather than dropping it', () => {
    const crs = buildCrsMetadata({ code: 'EPSG:999999' });

    expect(crs!.code).toBe('EPSG:999999');
    expect(crs!.proj4).toBeUndefined();
  });
});

describe('transformExtent', () => {
  it('is a no-op when both CRSs are the same', () => {
    expect(transformExtent([1, 2, 3, 4], 'EPSG:4326', 'EPSG:4326')).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('reprojects Web Mercator to longitude/latitude', () => {
    const result = transformExtent(
      [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
      'EPSG:3857',
    );

    expect(result).toBeDefined();
    expect(result![0]).toBeCloseTo(-180, 3);
    expect(result![2]).toBeCloseTo(180, 3);
  });

  it('produces a true envelope, not just the transformed corners', () => {
    // A wide UTM box: its northern edge bows north of both top corners, so a
    // corners-only transform would report a max latitude that is too low.
    const extent = [200000, 5000000, 800000, 5100000];

    const densified = transformExtent(extent, 'EPSG:26915')!;
    const corners = transformExtent(
      [extent[0], extent[3], extent[2], extent[3]],
      'EPSG:26915',
    )!;

    expect(densified[3]).toBeGreaterThanOrEqual(corners[3]);
  });

  it('returns undefined when a CRS is unknown', () => {
    expect(transformExtent([1, 2, 3, 4], 'EPSG:999999')).toBeUndefined();
    expect(transformExtent([1, 2, 3, 4], undefined)).toBeUndefined();
  });

  it('returns undefined for a malformed extent', () => {
    expect(transformExtent([1, 2], 'EPSG:4326', 'EPSG:3857')).toBeUndefined();
    expect(
      transformExtent([NaN, 2, 3, 4], 'EPSG:4326', 'EPSG:3857'),
    ).toBeUndefined();
  });
});
