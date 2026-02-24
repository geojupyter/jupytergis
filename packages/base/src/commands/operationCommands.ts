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
  export const newVideoWithParams = 'jupytergis:newVideoWithParams';
  export const newGeoTiffWithParams = 'jupytergis:newGeoTiffWithParams';
  export const newShapefileWithParams = 'jupytergis:newShapefileWithParams';
}

type LayerCreationSpec = {
  id: string;
  label: string;
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
      id: LayerCreationCommandIDs.newVideoWithParams,
      label: 'New Video Layer From Parameters',
      sourceType: 'VideoSource',
      layerType: 'RasterLayer',
      sourceSchema: {
        type: 'object',
        required: ['urls', 'coordinates'],
        properties: {
          urls: { type: 'array', items: { type: 'string' } },
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
      sourceType: 'GeoTiffSource',
      layerType: 'WebGlLayer',
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
                min: { type: 'number' },
                max: { type: 'number' },
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
        symbologyState: p.symbologyState ?? { renderType: 'continuous' },
      }),
    },
    {
      id: LayerCreationCommandIDs.newShapefileWithParams,
      label: 'New Shapefile Layer From Parameters',
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
        symbologyState: p.symbologyState ?? { renderType: 'Single Symbol' },
      }),
    },
  ];

  specs.forEach(spec => createLayerCommand(commands, tracker, trans, spec));
}
