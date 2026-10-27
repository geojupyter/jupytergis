import { IJupyterGISModel } from '@jupytergis/schema';
import { fromBlob, fromUrl, GeoTIFF, GeoTIFFImage } from 'geotiff';

import { loadFile } from '@/src/tools';
import {
  IBandMetadata,
  ILayerMetadata,
  ISourceMetadataContext,
  IPyramidLevel,
} from '../types';
import { buildCrsMetadata, transformExtent } from '../utils/crs';

/**
 * Largest image we are willing to decode just to compute band statistics when
 * the file does not carry them. Files above this are reported without
 * statistics rather than pulling tens of megabytes in the background.
 */
const MAX_PIXELS_FOR_STATS = 16_000_000;

/**
 * Size the statistics sample is resampled down to. Enough to characterize the
 * value range, small enough to decode instantly.
 */
const STATS_SAMPLE_SIZE = 128;

/**
 * Read metadata straight out of a GeoTIFF/COG.
 *
 * This is the format the issue's raster-specific asks are really about: it is
 * the one that carries its CRS, its extent, per-band statistics and an internal
 * pyramid all in the same file.
 */
export async function geoTiffProvider(
  context: ISourceMetadataContext,
): Promise<Partial<ILayerMetadata>> {
  const { model, source } = context;
  const url: string | undefined = source.parameters?.urls?.[0]?.url;

  if (!url) {
    return { notes: ['This source has no GeoTIFF URL.'] };
  }

  const tiff = await openGeoTiff(url, model);
  const imageCount = await tiff.getImageCount();
  const image = await tiff.getImage(0);

  const notes: string[] = [];
  const { bands, statsNote } = await readBands(tiff, image, imageCount);
  if (statsNote) {
    notes.push(statsNote);
  }

  const urlCount = source.parameters?.urls?.length ?? 0;
  if (urlCount > 1) {
    notes.push(
      `This source combines ${urlCount} GeoTIFFs; the information below describes the first one.`,
    );
  }

  return {
    crs: readCrs(image, source.parameters?.projection),
    extent: readExtent(image, source.parameters?.projection),
    bands,
    pyramid: await readPyramid(tiff, image, imageCount),
    extra: [
      {
        label: 'Size',
        value: `${image.getWidth()} × ${image.getHeight()} pixels`,
      },
    ],
    notes: notes.length ? notes : undefined,
  };
}

/**
 * Open the GeoTIFF the same way the map does, so that local files come from the
 * existing (cached) loader rather than being fetched a second time.
 */
async function openGeoTiff(
  url: string,
  model: IJupyterGISModel,
): Promise<GeoTIFF> {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return await fromUrl(url);
  }

  if (url.startsWith('data:')) {
    return await fromBlob(await (await fetch(url)).blob());
  }

  const loaded = await loadFile({
    filepath: url,
    type: 'GeoTiffSource',
    model,
  });

  if (!loaded?.file) {
    throw new Error(`Failed to load GeoTIFF: ${url}`);
  }

  return await fromBlob(loaded.file);
}

/**
 * The CRS the GeoTIFF declares, via its geo keys.
 *
 * A projected file carries `ProjectedCSTypeGeoKey`; a geographic one carries
 * only `GeographicTypeGeoKey`. When the file declares neither (which is why the
 * source has a `projection` parameter at all), fall back to what the user set
 * on the source.
 */
function readCrs(image: GeoTIFFImage, sourceProjection?: string) {
  const geoKeys = (image.getGeoKeys() ?? {}) as Record<string, unknown>;

  const code =
    (geoKeys.ProjectedCSTypeGeoKey as number | undefined) ??
    (geoKeys.GeographicTypeGeoKey as number | undefined) ??
    sourceProjection;

  const name =
    (geoKeys.ProjectedCitationGeoKey as string | undefined) ??
    (geoKeys.GTCitationGeoKey as string | undefined) ??
    (geoKeys.GeogCitationGeoKey as string | undefined);

  return buildCrsMetadata({ code, name });
}

/**
 * The extent the GeoTIFF itself declares, in its own CRS.
 */
function readExtent(image: GeoTIFFImage, sourceProjection?: string) {
  let native: number[] | undefined;
  try {
    native = image.getBoundingBox();
  } catch {
    // Files without an affine transformation cannot report a bounding box.
    return undefined;
  }

  if (!native?.length) {
    return undefined;
  }

  const geoKeys = (image.getGeoKeys() ?? {}) as Record<string, unknown>;
  const nativeCrs =
    (geoKeys.ProjectedCSTypeGeoKey as number | undefined) ??
    (geoKeys.GeographicTypeGeoKey as number | undefined) ??
    sourceProjection;

  const crs = buildCrsMetadata({ code: nativeCrs });

  return {
    native,
    nativeCrs: crs?.code,
    wgs84: transformExtent(native, crs?.code),
  };
}

/**
 * Per-band description, data type, nodata value and value range.
 */
async function readBands(
  tiff: GeoTIFF,
  image: GeoTIFFImage,
  imageCount: number,
): Promise<{ bands: IBandMetadata[]; statsNote?: string }> {
  const bandCount = image.getSamplesPerPixel();
  const noData = image.getGDALNoData();

  const bands: IBandMetadata[] = [];
  let missingStats = false;

  for (let index = 0; index < bandCount; index++) {
    const sampleMetadata = image.getGDALMetadata(index) ?? {};
    const minimum = toFiniteNumber(sampleMetadata['STATISTICS_MINIMUM']);
    const maximum = toFiniteNumber(sampleMetadata['STATISTICS_MAXIMUM']);

    if (minimum === undefined || maximum === undefined) {
      missingStats = true;
    }

    bands.push({
      band: index + 1,
      name: sampleMetadata['DESCRIPTION'] || `Band ${index + 1}`,
      dataType: getDataType(image, index),
      colorInterpretation: sampleMetadata['COLORINTERP'] || undefined,
      noData: noData === null ? undefined : String(noData),
      minimum,
      maximum,
    });
  }

  if (!missingStats) {
    return { bands };
  }

  const sampled = await sampleBandRanges(tiff, image, imageCount);
  if (!sampled) {
    return {
      bands,
      statsNote:
        'This file does not store band statistics, and it is too large to compute them here.',
    };
  }

  for (const band of bands) {
    const range = sampled[band.band - 1];
    if (range && (band.minimum === undefined || band.maximum === undefined)) {
      band.minimum = range.minimum;
      band.maximum = range.maximum;
    }
  }

  return {
    bands,
    statsNote:
      'This file does not store band statistics; the value ranges shown were estimated from a downsampled overview.',
  };
}

/**
 * Estimate each band's value range by decoding the smallest available overview.
 *
 * Returns `undefined` when there is no overview small enough to make this
 * cheap, so the caller can say so rather than stalling on a large download.
 */
async function sampleBandRanges(
  tiff: GeoTIFF,
  image: GeoTIFFImage,
  imageCount: number,
): Promise<{ minimum: number; maximum: number }[] | undefined> {
  const smallest = imageCount > 1 ? await tiff.getImage(imageCount - 1) : image;

  if (smallest.getWidth() * smallest.getHeight() > MAX_PIXELS_FOR_STATS) {
    return undefined;
  }

  try {
    const rasters = await smallest.readRasters({
      width: Math.min(STATS_SAMPLE_SIZE, smallest.getWidth()),
      height: Math.min(STATS_SAMPLE_SIZE, smallest.getHeight()),
      resampleMethod: 'nearest',
    });

    if (!Array.isArray(rasters)) {
      return undefined;
    }

    const noData = image.getGDALNoData();

    return rasters.map(band => {
      let minimum = Infinity;
      let maximum = -Infinity;

      for (let i = 0; i < band.length; i++) {
        const value = band[i];
        if (!Number.isFinite(value) || value === noData) {
          continue;
        }
        if (value < minimum) {
          minimum = value;
        }
        if (value > maximum) {
          maximum = value;
        }
      }

      return { minimum, maximum };
    });
  } catch {
    return undefined;
  }
}

/**
 * Describe the internal tile pyramid: the reduced-resolution images stored
 * alongside the full resolution one, which is what makes a GeoTIFF a COG.
 */
async function readPyramid(
  tiff: GeoTIFF,
  image: GeoTIFFImage,
  imageCount: number,
) {
  const fullWidth = image.getWidth();
  const levels: IPyramidLevel[] = [];

  for (let index = 0; index < imageCount; index++) {
    const levelImage = index === 0 ? image : await tiff.getImage(index);
    const width = levelImage.getWidth();

    levels.push({
      level: index,
      width,
      height: levelImage.getHeight(),
      scale: width ? Math.round(fullWidth / width) : undefined,
    });
  }

  const fileDirectory = image.getFileDirectory() ?? {};
  const tiled = fileDirectory.TileWidth !== undefined;

  return {
    levels,
    tiled,
    tileWidth: tiled ? image.getTileWidth() : undefined,
    tileHeight: tiled ? image.getTileHeight() : undefined,
  };
}

/**
 * Turn the TIFF sample format and bit depth into a familiar dtype name.
 */
function getDataType(image: GeoTIFFImage, index: number): string | undefined {
  try {
    const bits = image.getBitsPerSample(index);
    const format = image.getSampleFormat(index);

    const prefix =
      format === 3
        ? 'float'
        : format === 2
          ? 'int'
          : format === 1
            ? 'uint'
            : '';

    return prefix ? `${prefix}${bits}` : undefined;
  } catch {
    return undefined;
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
