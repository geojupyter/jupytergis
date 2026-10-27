import { IJupyterGISModel, IJGISLayer, IJGISSource } from '@jupytergis/schema';
import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';
import { UUID } from '@lumino/coreutils';

import { JupyterGISTracker } from '../types';

export namespace LayerCreationCommandIDs {
  export const newGeoJSONWithParams = 'jupytergis:newGeoJSONWithParams';
  export const newRasterWithParams = 'jupytergis:newRasterWithParams';
  export const newVectorTileWithParams = 'jupytergis:newVectorTileWithParams';
  export const newGeoParquetWithParams = 'jupytergis:newGeoParquetWithParams';
  export const newHillshadeWithParams = 'jupytergis:newHillshadeWithParams';
  export const newImageWithParams = 'jupytergis:newImageWithParams';
  export const newGeoTiffWithParams = 'jupytergis:newGeoTiffWithParams';
  export const newGeoZarrWithParams = 'jupytergis:newGeoZarrWithParams';
  export const newShapefileWithParams = 'jupytergis:newShapefileWithParams';
  export const newTripsWithParams = 'jupytergis:newTripsWithParams';
  export const newPolygonWithParams = 'jupytergis:newPolygonWithParams';
}

type LayerCreationSpec = {
  id: string;
  label: string;
  caption: string;
  sourceType: string;
  layerType: string;
  sourceSchema: Record<string, unknown>;
  layerParamsSchema: Record<string, unknown>;
  buildParameters: (params: any, sourceId: string) => IJGISLayer['parameters'];
};

/**
 * Generic command factory for layer creation.
 */
function createLayerCommand(
  commands: CommandRegistry,
  tracker: JupyterGISTracker,
  trans: IRenderMime.TranslationBundle,
  spec: LayerCreationSpec,
): void {
  commands.addCommand(spec.id, {
    label: trans.__(spec.label),
    caption: trans.__(spec.caption),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'name', 'parameters'],
        properties: {
          filePath: { type: 'string', description: 'Path to the .jGIS file' },
          name: { type: 'string', description: 'Layer name' },
          parameters: {
            type: 'object',
            properties: {
              source: spec.sourceSchema,
              ...spec.layerParamsSchema,
            },
          },
        } as any,
      },
    },
    execute: (async (args: {
      filePath: string;
      name: string;
      parameters: Record<string, any>;
    }) => {
      const { filePath, name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current || !current.model.sharedModel.editable) {
        console.warn('Invalid or non-editable document for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;
      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: spec.sourceType as any,
        name: `${name} Source`,
        parameters: parameters.source,
      };
      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: spec.layerType as any,
        name: name,
        visible: true,
        parameters: spec.buildParameters(parameters, sourceId),
      };
      model.addLayer(layerId, layerModel);
    }) as any,
  });
}

/**
 * Register all layer creation commands using declarative specs.
 */
export function addLayerCreationCommands(options: {
  tracker: JupyterGISTracker;
  commands: CommandRegistry;
  trans: IRenderMime.TranslationBundle;
}): void {
  const { tracker, commands, trans } = options;

  const specs: LayerCreationSpec[] = [
    {
      id: LayerCreationCommandIDs.newGeoJSONWithParams,
      label: 'New GeoJSON Layer From Parameters',
      caption:
        'Add a new GeoJSON vector layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'GeoJSONSource',
      layerType: 'VectorLayer',
      sourceSchema: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' } },
      },
      layerParamsSchema: {
        color: { type: 'object' },
        opacity: { type: 'number', default: 1 },
        symbologyState: { type: 'object' },
      },
      buildParameters: (p, id) => ({
        source: id,
        color: p.color ?? {},
        opacity: p.opacity ?? 1,
        symbologyState: p.symbologyState,
      }),
    },
    {
      id: LayerCreationCommandIDs.newRasterWithParams,
      label: 'New Raster Layer From Parameters',
      caption:
        'Add a new raster layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'RasterSource',
      layerType: 'RasterLayer',
      sourceSchema: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } },
      },
      layerParamsSchema: { opacity: { type: 'number', default: 1 } },
      buildParameters: (p, id) => ({
        source: id,
        opacity: p.opacity ?? 1,
      }),
    },
    {
      id: LayerCreationCommandIDs.newVectorTileWithParams,
      label: 'New Vector Tile Layer From Parameters',
      caption:
        'Add a new vector tile layer (by URL) and add it to the given JupyterGIS file',
      sourceType: 'VectorTileSource',
      layerType: 'VectorTileLayer',
      sourceSchema: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } },
      },
      layerParamsSchema: {
        color: { type: 'object' },
        opacity: { type: 'number', default: 1 },
      },
      buildParameters: (p, id) => ({
        source: id,
        color: p.color ?? {},
        opacity: p.opacity ?? 1,
      }),
    },
    {
      id: LayerCreationCommandIDs.newGeoParquetWithParams,
      label: 'New GeoParquet Layer From Parameters',
      caption:
        'Add a new GeoParquet vector layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'GeoParquetSource',
      layerType: 'VectorLayer',
      sourceSchema: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' } },
      },
      layerParamsSchema: {
        color: { type: 'object' },
        opacity: { type: 'number', default: 1 },
        symbologyState: { type: 'object' },
      },
      buildParameters: (p, id) => ({
        source: id,
        color: p.color ?? {},
        opacity: p.opacity ?? 1,
        symbologyState: p.symbologyState,
      }),
    },
    {
      id: LayerCreationCommandIDs.newHillshadeWithParams,
      label: 'New Hillshade Layer From Parameters',
      caption:
        'Add a new hillshade layer (by DEM raster source) and add it to the given JupyterGIS file',
      sourceType: 'RasterDemSource',
      layerType: 'HillshadeLayer',
      sourceSchema: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } },
      },
      layerParamsSchema: {
        shadowColor: { type: 'string', default: '#473B24' },
      },
      buildParameters: (p, id) => ({
        source: id,
        shadowColor: p.shadowColor ?? '#473B24',
      }),
    },
    {
      id: LayerCreationCommandIDs.newImageWithParams,
      label: 'New Image Layer From Parameters',
      caption:
        'Add a new image layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'ImageSource',
      layerType: 'ImageLayer',
      sourceSchema: {
        type: 'object',
        required: ['path', 'coordinates'],
        properties: {
          path: { type: 'string' },
          coordinates: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' } },
          },
        },
      },
      layerParamsSchema: { opacity: { type: 'number', default: 1 } },
      buildParameters: (p, id) => ({
        source: id,
        opacity: p.opacity ?? 1,
      }),
    },
    {
      id: LayerCreationCommandIDs.newGeoTiffWithParams,
      label: 'New GeoTIFF Layer From Parameters',
      caption:
        'Add a new GeoTIFF layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'GeoTiffSource',
      layerType: 'GeoTiffLayer',
      sourceSchema: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
              },
            },
          },
        },
      },
      layerParamsSchema: {
        opacity: { type: 'number', default: 1 },
        color: { type: 'any' },
        symbologyState: { type: 'object' },
      },
      buildParameters: (p, id) => ({
        source: id,
        opacity: p.opacity ?? 1,
        color: p.color,
        symbologyState: p.symbologyState ?? {
          renderType: 'Singleband Pseudocolor',
        },
      }),
    },
    {
      id: LayerCreationCommandIDs.newGeoZarrWithParams,
      label: 'New GeoZarr Layer From Parameters',
      caption:
        'Add a new GeoZarr layer (by Zarr store URL) and add it to the given JupyterGIS file',
      sourceType: 'GeoZarrSource',
      layerType: 'GeoZarrLayer',
      sourceSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'URL to the Zarr store' },
          bands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Band names to load (e.g. ["b02","b03","b04"])',
          },
          wrapX: { type: 'boolean', default: false },
        },
      },
      layerParamsSchema: {
        opacity: { type: 'number', default: 1 },
        gamma: { type: 'number', default: 1.5 },
        color: { type: 'any' },
        symbologyState: { type: 'object' },
      },
      buildParameters: (p, id) => ({
        source: id,
        opacity: p.opacity ?? 1,
        gamma: p.gamma ?? 1.5,
        color: p.color,
        symbologyState: p.symbologyState ?? { renderType: 'Multiband Color' },
      }),
    },
    {
      id: LayerCreationCommandIDs.newShapefileWithParams,
      label: 'New Shapefile Layer From Parameters',
      caption:
        'Add a new Shapefile vector layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'ShapefileSource',
      layerType: 'VectorLayer',
      sourceSchema: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' } },
      },
      layerParamsSchema: {
        color: { type: 'object' },
        opacity: { type: 'number', default: 1 },
        symbologyState: { type: 'object' },
      },
      buildParameters: (p, id) => ({
        source: id,
        color: p.color ?? {},
        opacity: p.opacity ?? 1,
        symbologyState: p.symbologyState ?? { layers: [] },
      }),
    },
    {
      id: LayerCreationCommandIDs.newTripsWithParams,
      label: 'New Trips Layer From Parameters',
      caption:
        'Add a new trips layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'TripsSource',
      layerType: 'TripsLayer',
      sourceSchema: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' } },
      },
      layerParamsSchema: {
        opacity: { type: 'number', default: 1 },
        color: {
          type: 'array',
          items: { type: 'number' },
          default: [253, 128, 93],
        },
        trailLength: { type: 'number', default: 120 },
        fadeTrail: { type: 'boolean', default: true },
        widthMinPixels: { type: 'number', default: 4 },
        capRounded: { type: 'boolean', default: true },
        jointRounded: { type: 'boolean', default: true },
      },
      buildParameters: (p, id) => ({
        source: id,
        opacity: p.opacity ?? 1,
        color: p.color ?? [253, 128, 93],
        trailLength: p.trailLength ?? 120,
        fadeTrail: p.fadeTrail ?? true,
        widthMinPixels: p.widthMinPixels ?? 4,
        capRounded: p.capRounded ?? true,
        jointRounded: p.jointRounded ?? true,
      }),
    },
    {
      id: LayerCreationCommandIDs.newPolygonWithParams,
      label: 'New Polygon Layer From Parameters',
      caption:
        'Add a new polygon layer (by file path or URL) and add it to the given JupyterGIS file',
      sourceType: 'PolygonSource',
      layerType: 'PolygonLayer',
      sourceSchema: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' } },
      },
      layerParamsSchema: {
        opacity: { type: 'number', default: 1 },
        filled: { type: 'boolean', default: true },
        stroked: { type: 'boolean', default: true },
        fillColor: {
          type: 'array',
          items: { type: 'number' },
          default: [0, 128, 255, 160],
        },
        lineColor: {
          type: 'array',
          items: { type: 'number' },
          default: [80, 80, 80],
        },
        lineWidthMinPixels: { type: 'number', default: 1 },
      },
      buildParameters: (p, id) => ({
        source: id,
        opacity: p.opacity ?? 1,
        filled: p.filled ?? true,
        stroked: p.stroked ?? true,
        fillColor: p.fillColor ?? [0, 128, 255, 160],
        lineColor: p.lineColor ?? [80, 80, 80],
        lineWidthMinPixels: p.lineWidthMinPixels ?? 1,
      }),
    },
  ];

  specs.forEach(spec => createLayerCommand(commands, tracker, trans, spec));
}
