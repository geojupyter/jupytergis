import { open as openStore, FetchStore } from 'zarrita';

export interface IZarrBandInfo {
  band: number;
  name: string;
  colorInterpretation?: string;
  stats: {
    minimum: number;
    maximum: number;
  };
}

export interface IZarrStoreMetadata {
  isMultiscale: boolean;
  resolutionLevels: string[];
  defaultResolution: string;
  hasGeospatialInfo: boolean;
}

/**
 * Analyze store metadata
 */
export async function analyzeZarrStore(
  url: string,
): Promise<IZarrStoreMetadata> {
  const root = await openStore(new FetchStore(url));
  const attrs = (root.attrs as any) || {};

  const isMultiscale = !!attrs.multiscales;

  let resolutionLevels: string[] = [];
  let defaultResolution = '';

  if (isMultiscale) {
    const layout = attrs.multiscales?.layout || [];
    resolutionLevels = layout.map((item: any) => item.asset).filter(Boolean);

    defaultResolution = resolutionLevels[0] || 'r10m';
  }

  return {
    isMultiscale,
    resolutionLevels,
    defaultResolution,
    hasGeospatialInfo: !!attrs['spatial:bbox'] || !!attrs['proj:code'],
  };
}

export function getDefaultRGBBands(bandInfo: any[]): string[] {
  if (!bandInfo || bandInfo.length === 0) {
    return [];
  }

  const findBand = (keywords: string[]) =>
    bandInfo.find(b => {
      const ci = b.colorInterpretation?.toLowerCase() || '';
      const name = b.name?.toLowerCase() || '';

      return keywords.some(k => ci.includes(k) || name.includes(k));
    });

  const red = findBand(['red', 'b04']);
  const green = findBand(['green', 'b03']);
  const blue = findBand(['blue', 'b02']);

  if (red && green && blue) {
    return [red.name, green.name, blue.name];
  }

  // fallback
  if (bandInfo.length >= 3) {
    return bandInfo.slice(0, 3).map(b => b.name);
  }

  if (bandInfo.length === 1) {
    return [bandInfo[0].name];
  }

  return [];
}

export function buildZarrColorStyle(
  bands: string[],
  options?: {
    contrastMax?: number;
  },
): any {
  const contrastMax = options?.contrastMax ?? 0.5;

  if (!bands || bands.length === 0) {
    return [
      'interpolate',
      ['linear'],
      ['band', 1],
      0,
      [0, 0, 0, 1],
      contrastMax,
      [255, 255, 255, 1],
    ];
  }

  const bandIndices = bands.length >= 3 ? [0, 1, 2] : [0];

  // RGB case
  if (bandIndices.length === 3) {
    return [
      'color',
      ...bandIndices.map(i => [
        'interpolate',
        ['linear'],
        ['band', i + 1],
        0,
        0,
        contrastMax,
        255,
      ]),
    ];
  }

  // Grayscale case
  return [
    'interpolate',
    ['linear'],
    ['band', bandIndices[0] + 1],
    0,
    [0, 0, 0, 1],
    contrastMax,
    [255, 255, 255, 1],
  ];
}

/**
 * Discover bands (FIXED VERSION)
 */
export async function discoverZarrBands(
  url: string,
  resolutionLevel?: string,
): Promise<IZarrBandInfo[]> {
  try {
    const metadata = await analyzeZarrStore(url);

    const resolution = metadata.isMultiscale
      ? resolutionLevel || metadata.defaultResolution
      : '';

    const basePath = resolution ? `${url}/${resolution}` : url;

    const possibleBands = [
      'b01',
      'b02',
      'b03',
      'b04',
      'b05',
      'b06',
      'b07',
      'b08',
      'b8a',
      'b09',
      'b10',
      'b11',
      'b12',
    ];

    const bands: IZarrBandInfo[] = [];

    for (const bandName of possibleBands) {
      try {
        const array = await openStore(
          new FetchStore(`${basePath}/${bandName}`),
        );

        if (array.kind !== 'array') {
          continue;
        }

        bands.push({
          band: parseInt(bandName.replace('b', '')),
          name: bandName,
          colorInterpretation: inferColorInterpretation(bandName),
          stats: {
            minimum: 0,
            maximum: 255,
          },
        });
      } catch {
        // silently ignore missing bands
      }
    }
    return bands;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * Infer band meaning
 */
function inferColorInterpretation(bandName: string): string | undefined {
  const lower = bandName.toLowerCase();

  const sentinel2Map: Record<string, string> = {
    b01: 'Coastal Aerosol',
    b02: 'Blue',
    b03: 'Green',
    b04: 'Red',
    b05: 'Vegetation Red Edge',
    b06: 'Vegetation Red Edge',
    b07: 'Vegetation Red Edge',
    b08: 'Near Infrared',
    b8a: 'Vegetation Red Edge',
    b09: 'Water Vapor',
    b10: 'SWIR - Cirrus',
    b11: 'SWIR',
    b12: 'SWIR',
  };

  return sentinel2Map[lower];
}

const bandCache = new Map<string, Promise<IZarrBandInfo[]>>();

export async function getBandInfoFromZarr(
  zarrUrl: string,
  resolutionLevel?: string,
): Promise<IZarrBandInfo[]> {
  const key = `${zarrUrl}#${resolutionLevel || 'default'}`;

  const cached = bandCache.get(key);
  if (cached) {
    return cached;
  }

  const promise = discoverZarrBands(zarrUrl, resolutionLevel);
  bandCache.set(key, promise);

  return promise;
}

export { FetchStore };
