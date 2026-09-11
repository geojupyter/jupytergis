import { IJGISSource, SourceType } from '@jupytergis/schema';

import { ILayerMetadata, IMetadataField } from '../types';
import { buildCrsMetadata } from '../utils/crs';

const TILE_SOURCES: SourceType[] = [
  'RasterSource',
  'VectorTileSource',
  'WmsTileSource',
];

/**
 * Metadata for tiled web services: XYZ rasters, vector tiles and WMS.
 *
 * Deliberately not a metadata provider. Providers read the data a source points
 * at, which costs a network round trip and is worth storing in the document.
 * A tiled service has no file to inspect: everything we can honestly say about
 * it is already declared on the source, so this is a synchronous read of
 * parameters that are a few lines away in the same document. Recomputing it is
 * free; storing it would duplicate the document into itself.
 *
 * Returns undefined for anything that is not a tiled service.
 *
 * Their "pyramid" is the zoom range of the tile scheme rather than a set of
 * overviews inside a file.
 */
export function tileMetadata(
  source: IJGISSource,
): Partial<ILayerMetadata> | undefined {
  if (!TILE_SOURCES.includes(source.type)) {
    return undefined;
  }

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
