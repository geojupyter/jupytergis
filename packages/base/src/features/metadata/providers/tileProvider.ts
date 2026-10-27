import {
  ILayerMetadata,
  ISourceMetadataContext,
  IMetadataField,
} from '../types';
import { buildCrsMetadata } from '../utils/crs';

/**
 * Metadata for tiled web services: XYZ rasters, vector tiles and WMS.
 *
 * These have no file to inspect — everything we can honestly say about them is
 * declared on the source. Their "pyramid" is the zoom range of the tile scheme
 * rather than a set of overviews inside a file.
 */
export async function tileProvider(
  context: ISourceMetadataContext,
): Promise<Partial<ILayerMetadata>> {
  const { source } = context;
  const parameters = source.parameters ?? {};

  const extra: IMetadataField[] = [];

  if (parameters.provider) {
    extra.push({ label: 'Provider', value: String(parameters.provider) });
  }

  if (parameters.params?.layers) {
    extra.push({
      label: 'WMS layers',
      value: String(parameters.params.layers),
    });
  }

  if (parameters.attribution) {
    extra.push({ label: 'Attribution', value: String(parameters.attribution) });
  }

  const hasZoomRange =
    parameters.minZoom !== undefined || parameters.maxZoom !== undefined;

  return {
    crs: getTileCrs(source.type),
    pyramid: hasZoomRange
      ? {
          levels: [],
          minZoom: parameters.minZoom,
          maxZoom: parameters.maxZoom,
        }
      : undefined,
    extra: extra.length ? extra : undefined,
    notes:
      source.type === 'WmsTileSource'
        ? [
            'WMS tiles are rendered by the server in the map’s projection, so this service has no fixed native CRS.',
          ]
        : undefined,
  };
}

/**
 * XYZ raster and vector tile schemes are Web Mercator by definition, which is
 * also what OpenLayers assumes for them. WMS is not: the server reprojects on
 * request, so we do not claim a native CRS for it.
 */
function getTileCrs(sourceType: string) {
  if (sourceType === 'WmsTileSource') {
    return undefined;
  }

  return buildCrsMetadata({ code: 'EPSG:3857' });
}
