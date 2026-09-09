import {
  analyzeZarrStore,
  getBandInfoFromZarr,
} from '@/src/features/layers/symbology/zarrBandDiscovery';
import {
  IBandMetadata,
  ILayerMetadata,
  ISourceMetadataContext,
  IPyramidLevel,
} from '../types';
import { buildCrsMetadata, transformExtent } from '../utils/crs';

/**
 * Metadata for GeoZarr stores.
 *
 * Zarr already gets inspected for symbology, so this reuses that (cached)
 * discovery rather than reading the store a second time: the multiscale layout
 * is the store's pyramid, and band discovery already returns real statistics.
 */
export async function geoZarrProvider(
  context: ISourceMetadataContext,
): Promise<Partial<ILayerMetadata>> {
  const { source } = context;
  const url: string | undefined =
    source.parameters?.url ?? source.parameters?.urls?.[0]?.url;

  if (!url) {
    return { notes: ['This source has no Zarr URL.'] };
  }

  const store = await analyzeZarrStore(url);
  const bands = await readBands(url);

  return {
    crs: buildCrsMetadata({ code: store.crsCode }),
    extent: store.bbox
      ? {
          native: store.bbox,
          nativeCrs: store.crsCode,
          wgs84: transformExtent(store.bbox, store.crsCode),
        }
      : undefined,
    bands,
    pyramid: store.isMultiscale
      ? { levels: readLevels(store.resolutionLevels) }
      : undefined,
    notes: store.isMultiscale
      ? undefined
      : ['This store is not multiscale, so it has no resolution pyramid.'],
  };
}

async function readBands(url: string): Promise<IBandMetadata[] | undefined> {
  try {
    const bands = await getBandInfoFromZarr(url);

    return bands.length
      ? bands.map(band => ({
          band: band.band,
          name: band.name,
          colorInterpretation: band.colorInterpretation,
          minimum: band.stats?.minimum,
          maximum: band.stats?.maximum,
        }))
      : undefined;
  } catch {
    // Band discovery is best-effort; the rest of the metadata is still useful.
    return undefined;
  }
}

/**
 * Multiscale levels are named by the store (`r10m`, `r20m`, ...) rather than
 * described by pixel size, so report the names as-is.
 */
function readLevels(resolutionLevels: string[]): IPyramidLevel[] {
  return resolutionLevels.map((name, index) => ({ level: index, name }));
}
