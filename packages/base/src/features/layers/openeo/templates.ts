export interface IOpenEOTemplateParams {
  collectionId: string;
  bbox: { west: number; south: number; east: number; north: number };
  temporalExtent: [string, string];
}

export interface IOpenEOTemplate {
  id: string;
  name: string;
  description: string;
  defaults: IOpenEOTemplateParams;
  buildGraph(params: IOpenEOTemplateParams): Record<string, any>;
}

const DEFAULT_BBOX = { west: -74.0, south: 40.7, east: -73.9, north: 40.8 };
const DEFAULT_TEMPORAL: [string, string] = ['2022-04-15', '2022-12-31'];

/**
 * openEO's `load_collection` requires `spatial_extent` to be a full bbox
 * (west/south/east/north) or `null` — an empty `{}` is invalid and gets
 * rejected by validation. We ignore spatial_extent for the tiled layers we
 * render anyway, so normalize an empty extent to `null` (which the schema
 * accepts) rather than blocking the user on an otherwise-valid graph.
 * Returns the graph unchanged (same reference) when there is nothing to fix.
 */
export function normalizeSpatialExtent(
  graph: Record<string, any>,
): Record<string, any> {
  let changed = false;
  const out: Record<string, any> = {};
  for (const [nodeId, node] of Object.entries(graph)) {
    const ext = node?.arguments?.spatial_extent;
    const isEmptyObject =
      ext &&
      typeof ext === 'object' &&
      !Array.isArray(ext) &&
      Object.keys(ext).length === 0;
    if (isEmptyObject) {
      changed = true;
      out[nodeId] = {
        ...node,
        arguments: { ...node.arguments, spatial_extent: null },
      };
    } else {
      out[nodeId] = node;
    }
  }
  return changed ? out : graph;
}

function loadCollection(
  params: IOpenEOTemplateParams,
  bands: string[],
): Record<string, any> {
  return {
    arguments: {
      id: params.collectionId,
      bands,
      properties: {},
      spatial_extent: params.bbox,
      temporal_extent: params.temporalExtent,
    },
    process_id: 'load_collection',
  };
}

function reduceTimeFirst(fromNode: string): Record<string, any> {
  return {
    arguments: {
      data: { from_node: fromNode },
      dimension: 'time',
      reducer: {
        process_graph: {
          first1: {
            arguments: { data: { from_parameter: 'data' } },
            process_id: 'first',
            result: true,
          },
        },
      },
    },
    process_id: 'reduce_dimension',
  };
}

function linearScaleAndTrunc(
  fromNode: string,
  inputMax = 10000,
): Record<string, any> {
  return {
    arguments: {
      data: { from_node: fromNode },
      process: {
        process_graph: {
          linearscalerange1: {
            arguments: {
              inputMax,
              inputMin: 0,
              outputMax: 255,
              x: { from_parameter: 'x' },
            },
            process_id: 'linear_scale_range',
          },
          trunc1: {
            arguments: { x: { from_node: 'linearscalerange1' } },
            process_id: 'trunc',
            result: true,
          },
        },
      },
    },
    process_id: 'apply',
  };
}

function saveResult(fromNode: string): Record<string, any> {
  return {
    arguments: {
      data: { from_node: fromNode },
      format: 'PNG',
      options: {},
    },
    process_id: 'save_result',
    result: true,
  };
}

function rgbGraph(
  params: IOpenEOTemplateParams,
  bands: [string, string, string],
  formula: string,
): Record<string, any> {
  return {
    loadcollection1: loadCollection(params, [...bands]),
    reducedimension1: reduceTimeFirst('loadcollection1'),
    apply1: linearScaleAndTrunc('reducedimension1'),
    colorformula1: {
      arguments: {
        data: { from_node: 'apply1' },
        formula,
      },
      process_id: 'color_formula',
    },
    saveresult1: saveResult('colorformula1'),
  };
}

function indexGraph(
  params: IOpenEOTemplateParams,
  numeratorBand: string,
  denominatorBand: string,
  extraBand?: string,
): Record<string, any> {
  const bands = extraBand
    ? [numeratorBand, denominatorBand, extraBand]
    : [numeratorBand, denominatorBand];
  const numeratorIndex = bands.indexOf(numeratorBand);
  const denominatorIndex = bands.indexOf(denominatorBand);
  return {
    loadcollection1: loadCollection(params, bands),
    reducedimension1: reduceTimeFirst('loadcollection1'),
    // titiler-openeo's `ndvi` process has contradictory typing: its
    // schema declares `nir`/`red` as band-name strings (per the openEO
    // spec), but the Python impl annotates them as int and the pydantic
    // pass rejects either choice — strings at runtime, ints at /validation.
    // Compute the normalized difference inline over the bands dimension
    // instead, using only core arithmetic processes.
    ndvi1: {
      arguments: {
        data: { from_node: 'reducedimension1' },
        dimension: 'bands',
        reducer: {
          process_graph: {
            nir: {
              arguments: {
                data: { from_parameter: 'data' },
                index: numeratorIndex,
              },
              process_id: 'array_element',
            },
            red: {
              arguments: {
                data: { from_parameter: 'data' },
                index: denominatorIndex,
              },
              process_id: 'array_element',
            },
            diff: {
              arguments: {
                x: { from_node: 'nir' },
                y: { from_node: 'red' },
              },
              process_id: 'subtract',
            },
            sum: {
              arguments: {
                x: { from_node: 'nir' },
                y: { from_node: 'red' },
              },
              process_id: 'add',
            },
            ndvi: {
              arguments: {
                x: { from_node: 'diff' },
                y: { from_node: 'sum' },
              },
              process_id: 'divide',
              result: true,
            },
          },
        },
      },
      process_id: 'reduce_dimension',
    },
    apply1: {
      arguments: {
        data: { from_node: 'ndvi1' },
        process: {
          process_graph: {
            linearscalerange1: {
              arguments: {
                inputMin: -1,
                inputMax: 1,
                outputMin: 0,
                outputMax: 255,
                x: { from_parameter: 'x' },
              },
              process_id: 'linear_scale_range',
            },
            trunc1: {
              arguments: { x: { from_node: 'linearscalerange1' } },
              process_id: 'trunc',
              result: true,
            },
          },
        },
      },
      process_id: 'apply',
    },
    saveresult1: saveResult('apply1'),
  };
}

export const OPENEO_TEMPLATES: IOpenEOTemplate[] = [
  {
    id: 'true-color',
    name: 'True Color',
    description: 'RGB composite from Sentinel-2 B04/B03/B02 (red/green/blue).',
    defaults: {
      collectionId: 'sentinel-2-global-mosaics',
      bbox: DEFAULT_BBOX,
      temporalExtent: DEFAULT_TEMPORAL,
    },
    buildGraph: params =>
      rgbGraph(
        params,
        ['B04', 'B03', 'B02'],
        'Gamma RGB 1.5 Sigmoidal RGB 6 0.3 Saturation 1',
      ),
  },
  {
    id: 'false-color-ir',
    name: 'False Color IR',
    description:
      'NIR/Red/Green composite (B08/B04/B03) — vegetation appears red.',
    defaults: {
      collectionId: 'sentinel-2-global-mosaics',
      bbox: DEFAULT_BBOX,
      temporalExtent: DEFAULT_TEMPORAL,
    },
    buildGraph: params =>
      rgbGraph(params, ['B08', 'B04', 'B03'], 'Gamma RGB 1.4 Saturation 1.1'),
  },
  {
    id: 'ndvi',
    name: 'NDVI',
    description:
      'Normalized Difference Vegetation Index from B08 (NIR) and B04 (Red).',
    defaults: {
      collectionId: 'sentinel-2-global-mosaics',
      bbox: DEFAULT_BBOX,
      temporalExtent: DEFAULT_TEMPORAL,
    },
    buildGraph: params => indexGraph(params, 'B08', 'B04'),
  },
];
