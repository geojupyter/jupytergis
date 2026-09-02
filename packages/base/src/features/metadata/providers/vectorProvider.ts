import { loadFile } from '@/src/tools';
import { ILayerMetadata, ISourceMetadataContext } from '../types';
import { buildCrsMetadata, transformExtent } from '../utils/crs';

/**
 * Number of features inspected when working out which attributes exist and what
 * type they hold. Reading every feature of a large file to label a column adds
 * nothing; the first few hundred are representative.
 */
const FIELD_SAMPLE_SIZE = 500;

/**
 * Metadata for the vector formats that JupyterGIS reads into GeoJSON:
 * GeoJSON itself, shapefiles and GeoParquet.
 *
 * All three arrive here as a parsed GeoJSON `FeatureCollection` in EPSG:4326,
 * which is what makes one provider enough for the three of them.
 */
export async function vectorProvider(
  context: ISourceMetadataContext,
): Promise<Partial<ILayerMetadata>> {
  const { source } = context;

  const data = await readGeoJson(context);
  const features: any[] = Array.isArray(data?.features) ? data.features : [];

  if (!data) {
    return { notes: ['Could not read this source’s vector data.'] };
  }

  const native = data.bbox?.length >= 4 ? data.bbox : computeBbox(features);

  return {
    // Everything JupyterGIS loads through this path is GeoJSON, which RFC 7946
    // defines as WGS 84 longitude/latitude.
    crs: buildCrsMetadata({ code: 'EPSG:4326' }),
    extent: native
      ? {
          native,
          nativeCrs: 'EPSG:4326',
          wgs84: transformExtent(native, 'EPSG:4326'),
        }
      : undefined,
    vector: {
      featureCount: features.length,
      geometryTypes: collectGeometryTypes(features),
      fields: collectFields(features),
    },
    extra: source.parameters?.layerName
      ? [{ label: 'Table', value: source.parameters.layerName }]
      : undefined,
    notes: features.length ? undefined : ['This source contains no features.'],
  };
}

/**
 * Read the source's data through the same loader the map uses, so a file that
 * is already open is served from cache.
 */
async function readGeoJson({
  model,
  source,
}: ISourceMetadataContext): Promise<any | undefined> {
  const parameters = source.parameters ?? {};

  if (parameters.path) {
    return await loadFile({
      filepath: parameters.path,
      type: source.type,
      model,
    });
  }

  return parameters.data;
}

function collectGeometryTypes(features: any[]): string[] | undefined {
  const types = new Set<string>();

  for (const feature of features) {
    const type = feature?.geometry?.type;
    if (type) {
      types.add(type);
    }
  }

  return types.size ? [...types] : undefined;
}

/**
 * Attribute names and their types, inferred from the first values we see.
 */
function collectFields(
  features: any[],
): { name: string; type: string }[] | undefined {
  const fields = new Map<string, string>();
  const limit = Math.min(features.length, FIELD_SAMPLE_SIZE);

  for (let i = 0; i < limit; i++) {
    const properties = features[i]?.properties;
    if (!properties) {
      continue;
    }

    for (const [name, value] of Object.entries(properties)) {
      // Keep looking until a field shows a value we can actually name a type
      // for; a column that starts with nulls should not be labelled "null".
      if (fields.get(name) && fields.get(name) !== 'null') {
        continue;
      }
      fields.set(name, describeValueType(value));
    }
  }

  return fields.size
    ? [...fields.entries()].map(([name, type]) => ({ name, type }))
    : undefined;
}

function describeValueType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

/**
 * Bounding box of a feature collection, for the files that do not declare one.
 */
function computeBbox(features: any[]): number[] | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coordinates: any): void => {
    if (!Array.isArray(coordinates)) {
      return;
    }

    if (typeof coordinates[0] === 'number') {
      const [x, y] = coordinates;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return;
    }

    for (const child of coordinates) {
      visit(child);
    }
  };

  for (const feature of features) {
    const geometry = feature?.geometry;
    if (!geometry) {
      continue;
    }

    if (geometry.type === 'GeometryCollection') {
      for (const child of geometry.geometries ?? []) {
        visit(child?.coordinates);
      }
    } else {
      visit(geometry.coordinates);
    }
  }

  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : undefined;
}
