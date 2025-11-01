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

export function addLayerCreationCommands(options: {
  tracker: JupyterGISTracker;
  commands: CommandRegistry;
  trans: IRenderMime.TranslationBundle;
}) {
  const { commands, tracker, trans } = options;

  commands.addCommand(LayerCreationCommandIDs.newGeoJSONWithParams, {
    label: trans.__('New GeoJSON Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new GeoJSON layer',
          },
          parameters: {
            type: 'object',
            required: ['source', 'opacity', 'symbologyState'],
            properties: {
              source: {
                type: 'object',
                description: 'GeoJSON source configuration',
                required: [],
                properties: {
                  path: {
                    type: 'string',
                    description: 'The path to the GeoJSON file',
                  },
                  data: {
                    type: 'object',
                    description: 'The GeoJSON data object',
                  },
                  valid: {
                    type: 'boolean',
                    description: 'Whether the data are valid',
                    readOnly: true,
                  },
                },
              },
              color: {
                type: 'object',
                description: 'The color configuration for the layer',
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
              symbologyState: {
                type: 'object',
                description: 'Symbology configuration for the layer',
                required: ['renderType'],
                properties: {
                  renderType: {
                    type: 'string',
                    enum: ['Single Symbol', 'Graduated', 'Categorized'],
                  },
                  value: { type: 'string' },
                  method: {
                    type: 'string',
                    enum: ['color', 'radius'],
                  },
                  colorRamp: {
                    type: 'string',
                    default: 'viridis',
                  },
                  nClasses: {
                    type: 'string',
                    default: '9',
                  },
                  mode: {
                    type: 'string',
                    default: 'equal interval',
                    enum: [
                      'quantile',
                      'equal interval',
                      'jenks',
                      'pretty',
                      'logarithmic',
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: Record<string, any>;
        color?: Record<string, any>;
        opacity?: number;
        symbologyState: Record<string, any>;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'GeoJSONSource',
        name: `${Name} Source`,
        parameters: parameters.source,
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'VectorLayer',
        name: Name,
        visible: true,
        parameters: {
          color: parameters.color ?? {},
          opacity: parameters.opacity ?? 1,
          symbologyState: parameters.symbologyState,
          source: sourceId,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newRasterWithParams, {
    label: trans.__('New Raster Tile Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new Raster Tile Layer',
          },
          parameters: {
            type: 'object',
            required: ['source', 'opacity'],
            properties: {
              source: {
                type: 'object',
                description: 'Raster source configuration',
                required: ['url', 'maxZoom', 'minZoom'],
                properties: {
                  url: {
                    type: 'string',
                    description: 'The URL to the tile provider',
                  },
                  minZoom: {
                    type: 'number',
                    minimum: 0,
                    maximum: 24,
                    default: 0,
                    description: 'Minimum zoom level',
                  },
                  maxZoom: {
                    type: 'number',
                    minimum: 0,
                    maximum: 24,
                    default: 24,
                    description: 'Maximum zoom level',
                  },
                  attribution: {
                    type: 'string',
                    default: '',
                    description: 'Attribution for the raster source',
                  },
                  htmlAttribution: {
                    type: 'string',
                    default: '',
                    description: 'HTML attribution for the raster source',
                  },
                  provider: {
                    type: 'string',
                    default: '',
                    description: 'Provider name',
                  },
                  bounds: {
                    type: 'array',
                    description: 'Bounds of the source',
                    items: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                    default: [],
                  },
                  urlParameters: {
                    type: 'object',
                    description: 'Extra URL parameters',
                    additionalProperties: { type: 'string' },
                    default: {},
                  },
                  interpolate: {
                    type: 'boolean',
                    description:
                      'Interpolate between grid cells when overzooming?',
                    default: false,
                  },
                },
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: Record<string, any>;
        opacity: number;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'RasterSource',
        name: `${Name} Source`,
        parameters: parameters.source,
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'RasterLayer',
        name: Name,
        visible: true,
        parameters: {
          opacity: parameters.opacity ?? 1,
          source: sourceId,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newVectorTileWithParams, {
    label: trans.__('New Vector Tile Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new Vector Tile Layer',
          },
          parameters: {
            type: 'object',
            required: ['source', 'opacity'],
            properties: {
              source: {
                type: 'object',
                description: 'Vector tile source configuration',
                required: ['url', 'maxZoom', 'minZoom'],
                properties: {
                  url: {
                    type: 'string',
                    description: 'The URL to the tile provider',
                  },
                  minZoom: {
                    type: 'number',
                    minimum: 0,
                    maximum: 24,
                    description: 'Minimum zoom level for the vector source',
                  },
                  maxZoom: {
                    type: 'number',
                    minimum: 0,
                    maximum: 24,
                    description: 'Maximum zoom level for the vector source',
                  },
                  attribution: {
                    type: 'string',
                    description: 'Attribution for the vector source',
                  },
                  provider: {
                    type: 'string',
                    description: 'The map provider',
                    readOnly: true,
                  },
                  urlParameters: {
                    type: 'object',
                    description: 'Additional URL parameters',
                    additionalProperties: { type: 'string' },
                  },
                },
              },
              color: {
                type: 'object',
                description: 'Color styling configuration for the layer',
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity (0–1)',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: Record<string, any>;
        color?: Record<string, any>;
        opacity?: number;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'VectorTileSource',
        name: `${Name} Source`,
        parameters: parameters.source,
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'VectorTileLayer',
        name: Name,
        visible: true,
        parameters: {
          color: parameters.color ?? {},
          opacity: parameters.opacity ?? 1,
          source: sourceId,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newGeoParquetWithParams, {
    label: trans.__('New GeoParquet Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new GeoParquet layer',
          },
          parameters: {
            type: 'object',
            required: ['source', 'opacity', 'symbologyState'],
            properties: {
              source: {
                type: 'object',
                description: 'GeoParquet source configuration',
                required: ['path'],
                properties: {
                  path: {
                    type: 'string',
                    description: 'The path to the GeoParquet source',
                  },
                  attribution: {
                    type: 'string',
                    readOnly: true,
                    description: 'Attribution for the GeoParquet source',
                    default: '',
                  },
                  projection: {
                    type: 'string',
                    description:
                      'Projection information for the GeoParquet data',
                    default: 'EPSG:4326',
                  },
                },
              },
              color: {
                type: 'object',
                description: 'Color styling for the layer',
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity (0–1)',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
              symbologyState: {
                type: 'object',
                description: 'Symbology configuration for the layer',
                required: ['renderType'],
                properties: {
                  renderType: {
                    type: 'string',
                    enum: ['Single Symbol', 'Graduated', 'Categorized'],
                  },
                  value: {
                    type: 'string',
                  },
                  method: {
                    type: 'string',
                    enum: ['color', 'radius'],
                  },
                  colorRamp: {
                    type: 'string',
                    default: 'viridis',
                  },
                  nClasses: {
                    type: 'string',
                    default: '9',
                  },
                  mode: {
                    type: 'string',
                    default: 'equal interval',
                    enum: [
                      'quantile',
                      'equal interval',
                      'jenks',
                      'pretty',
                      'logarithmic',
                    ],
                  },
                },
                additionalProperties: false,
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: Record<string, any>;
        color?: Record<string, any>;
        opacity?: number;
        symbologyState: Record<string, any>;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'GeoParquetSource',
        name: `${Name} Source`,
        parameters: parameters.source,
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'VectorLayer',
        name: Name,
        visible: true,
        parameters: {
          color: parameters.color ?? {},
          opacity: parameters.opacity ?? 1,
          symbologyState: parameters.symbologyState,
          source: sourceId,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newHillshadeWithParams, {
    label: trans.__('New Hillshade Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new Hillshade layer',
          },
          parameters: {
            type: 'object',
            required: ['source'],
            properties: {
              source: {
                type: 'object',
                description: 'RasterDem source configuration',
                required: ['url'],
                properties: {
                  url: {
                    type: 'string',
                    description: 'The URL to the DEM tile provider',
                  },
                  attribution: {
                    type: 'string',
                    description:
                      'Attribution for the raster-dem source (optional)',
                  },
                  urlParameters: {
                    type: 'object',
                    description:
                      'Additional URL parameters for the raster-dem source',
                    additionalProperties: {
                      type: 'string',
                    },
                  },
                  interpolate: {
                    type: 'boolean',
                    description:
                      'Interpolate between grid cells when overzooming',
                    default: false,
                  },
                },
              },
              shadowColor: {
                type: 'string',
                description: 'The color of the shadows',
                default: '#473B24',
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: Record<string, any>;
        shadowColor?: string;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'RasterDemSource',
        name: `${Name} Source`,
        parameters: parameters.source,
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'HillshadeLayer',
        name: Name,
        visible: true,
        parameters: {
          shadowColor: parameters.shadowColor ?? '#473B24',
          source: sourceId,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newImageWithParams, {
    label: trans.__('New Image Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new Image layer',
          },
          parameters: {
            type: 'object',
            required: ['source'],
            properties: {
              source: {
                type: 'object',
                description: 'Image source configuration',
                required: ['path', 'coordinates'],
                properties: {
                  path: {
                    type: 'string',
                    description: 'Path that points to the image',
                  },
                  coordinates: {
                    type: 'array',
                    description:
                      'Four corner coordinates in [lon, lat] pairs defining the image bounds',
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: 'array',
                      minItems: 2,
                      maxItems: 2,
                      items: { type: 'number' },
                    },
                  },
                  interpolate: {
                    type: 'boolean',
                    description:
                      'Whether to interpolate between grid cells when overzooming',
                    default: false,
                  },
                },
              },
              opacity: {
                type: 'number',
                description: 'The opacity of the image layer',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: {
          path: string;
          coordinates: number[][];
          interpolate?: boolean;
        };
        opacity?: number;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'ImageSource',
        name: `${Name} Source`,
        parameters: {
          path: parameters.source.path,
          coordinates: parameters.source.coordinates,
          interpolate: parameters.source.interpolate ?? false,
        },
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'ImageLayer',
        name: Name,
        visible: true,
        parameters: {
          source: sourceId,
          opacity: parameters.opacity ?? 1,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newVideoWithParams, {
    label: trans.__('New Video Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'The name of the new Video layer',
          },
          parameters: {
            type: 'object',
            required: ['source'],
            properties: {
              source: {
                type: 'object',
                description: 'Video source configuration',
                required: ['urls', 'coordinates'],
                properties: {
                  urls: {
                    type: 'array',
                    description: 'List of video URLs in preferred format order',
                    minItems: 1,
                    items: { type: 'string' },
                  },
                  coordinates: {
                    type: 'array',
                    description:
                      'Four corner coordinates in [lon, lat] pairs defining the video projection area',
                    minItems: 4,
                    maxItems: 4,
                    items: {
                      type: 'array',
                      minItems: 2,
                      maxItems: 2,
                      items: { type: 'number' },
                    },
                  },
                },
              },
              opacity: {
                type: 'number',
                description: 'The opacity of the video layer',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: {
          urls: string[];
          coordinates: number[][];
        };
        opacity?: number;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'VideoSource',
        name: `${Name} Source`,
        parameters: {
          urls: parameters.source.urls,
          coordinates: parameters.source.coordinates,
        },
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'RasterLayer',
        name: Name,
        visible: true,
        parameters: {
          source: sourceId,
          opacity: parameters.opacity ?? 1,
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newGeoTiffWithParams, {
    label: trans.__('New GeoTIFF Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'Name of the new GeoTIFF layer',
          },
          parameters: {
            type: 'object',
            required: ['source'],
            properties: {
              source: {
                type: 'object',
                description: 'GeoTIFF source configuration',
                required: ['urls'],
                properties: {
                  urls: {
                    type: 'array',
                    description:
                      'List of GeoTIFF URL objects with optional min/max values',
                    minItems: 1,
                    items: {
                      type: 'object',
                      properties: {
                        url: {
                          type: 'string',
                          description: 'URL to the GeoTIFF file',
                        },
                        min: {
                          type: 'number',
                          description: 'Minimum value for scaling',
                        },
                        max: {
                          type: 'number',
                          description: 'Maximum value for scaling',
                        },
                      },
                    },
                  },
                  normalize: {
                    type: 'boolean',
                    description:
                      'Normalize values between 0 and 1 for RGB display; disable to keep raw values',
                    default: true,
                  },
                  wrapX: {
                    type: 'boolean',
                    description: 'Wrap map horizontally?',
                    default: false,
                  },
                  interpolate: {
                    type: 'boolean',
                    description:
                      'Interpolate between grid cells when overzooming?',
                    default: false,
                  },
                },
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity (0–1)',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
              color: {
                oneOf: [
                  { type: 'string' },
                  { type: 'number' },
                  {
                    type: 'array',
                    items: {
                      anyOf: [
                        { type: 'string' },
                        { type: 'number' },
                        {
                          type: 'array',
                          items: {
                            anyOf: [{ type: 'number' }, { type: 'string' }],
                          },
                        },
                      ],
                    },
                  },
                ],
                description: 'Color of the WebGL layer',
              },
              symbologyState: {
                type: 'object',
                description: 'Symbology configuration for the layer',
                required: ['renderType'],
                properties: {
                  renderType: { type: 'string' },
                  band: { type: 'number' },
                  redBand: { type: 'number' },
                  greenBand: { type: 'number' },
                  blueBand: { type: 'number' },
                  alphaBand: { type: 'number' },
                  interpolation: {
                    type: 'string',
                    enum: ['discrete', 'linear', 'exact'],
                  },
                  colorRamp: {
                    type: 'string',
                    default: 'viridis',
                  },
                  nClasses: {
                    type: 'string',
                    default: '9',
                  },
                  mode: {
                    type: 'string',
                    default: 'equal interval',
                    enum: ['continuous', 'equal interval', 'quantile'],
                  },
                },
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: {
          urls: { url: string; min?: number; max?: number }[];
          normalize?: boolean;
          wrapX?: boolean;
          interpolate?: boolean;
        };
        opacity?: number;
        color?: any;
        symbologyState?: Record<string, any>;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;
      if (!sharedModel.editable) {
        console.warn('Shared model not editable');
        return;
      }

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'GeoTiffSource',
        name: `${Name} Source`,
        parameters: {
          urls: parameters.source.urls,
          normalize: parameters.source.normalize ?? true,
          wrapX: parameters.source.wrapX ?? false,
          interpolate: parameters.source.interpolate ?? false,
        },
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'WebGlLayer',
        name: Name,
        visible: true,
        parameters: {
          source: sourceId,
          opacity: parameters.opacity ?? 1,
          color: parameters.color,
          symbologyState: parameters.symbologyState ?? {
            renderType: 'continuous',
          },
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });

  commands.addCommand(LayerCreationCommandIDs.newShapefileWithParams, {
    label: trans.__('New Shapefile Layer From Parameters'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'Name', 'parameters'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to modify',
          },
          Name: {
            type: 'string',
            description: 'Name of the new Shapefile layer',
          },
          parameters: {
            type: 'object',
            required: ['source'],
            properties: {
              source: {
                type: 'object',
                description: 'Shapefile source configuration',
                required: ['path'],
                properties: {
                  path: {
                    type: 'string',
                    description:
                      'Path to the shapefile (.shp, .zip, or folder URL)',
                  },
                  attribution: {
                    type: 'string',
                    description: 'Attribution for the shapefile source',
                    default: '',
                  },
                  projection: {
                    type: 'string',
                    description: 'Projection for the shapefile (optional)',
                    default: 'WGS84',
                  },
                  encoding: {
                    type: 'string',
                    description: 'DBF encoding (optional)',
                    default: 'UTF-8',
                  },
                  additionalFiles: {
                    type: 'object',
                    description:
                      'Additional files (.dbf, .prj, .cpg) associated with the shapefile',
                    additionalProperties: { type: 'string' },
                    default: {},
                  },
                },
              },
              color: {
                type: 'object',
                description: 'Color configuration for the layer',
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity (0–1)',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1,
              },
              symbologyState: {
                type: 'object',
                description: 'Symbology configuration for the layer',
                required: ['renderType'],
                properties: {
                  renderType: {
                    type: 'string',
                    enum: ['Single Symbol', 'Graduated', 'Categorized'],
                  },
                  value: { type: 'string' },
                  method: {
                    type: 'string',
                    enum: ['color', 'radius'],
                  },
                  colorRamp: {
                    type: 'string',
                    default: 'viridis',
                  },
                  nClasses: {
                    type: 'string',
                    default: '9',
                  },
                  mode: {
                    type: 'string',
                    default: 'equal interval',
                    enum: [
                      'quantile',
                      'equal interval',
                      'jenks',
                      'pretty',
                      'logarithmic',
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      Name: string;
      parameters: {
        source: {
          path: string;
          attribution?: string;
          projection?: string;
          encoding?: string;
          additionalFiles?: Record<string, string>;
        };
        color?: Record<string, any>;
        opacity?: number;
        symbologyState?: Record<string, any>;
      };
    }) => {
      const { filePath, Name, parameters } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model: IJupyterGISModel = current.model;
      const sharedModel = model.sharedModel;
      if (!sharedModel.editable) {
        console.warn('Shared model not editable');
        return;
      }

      const sourceId = UUID.uuid4();
      const layerId = UUID.uuid4();

      const sourceModel: IJGISSource = {
        type: 'ShapefileSource',
        name: `${Name} Source`,
        parameters: {
          path: parameters.source.path,
          attribution: parameters.source.attribution ?? '',
          projection: parameters.source.projection ?? 'WGS84',
          encoding: parameters.source.encoding ?? 'UTF-8',
          additionalFiles: parameters.source.additionalFiles ?? {},
        },
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'VectorLayer',
        name: Name,
        visible: true,
        parameters: {
          source: sourceId,
          color: parameters.color ?? {},
          opacity: parameters.opacity ?? 1,
          symbologyState: parameters.symbologyState ?? {
            renderType: 'Single Symbol',
          },
        },
      };

      model.addLayer(layerId, layerModel);
    }) as any,
  });
}
