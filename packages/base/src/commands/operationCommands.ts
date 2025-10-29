import {
  IJupyterGISModel,
  IJGISLayer,
  IJGISSource
} from '@jupytergis/schema';
import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';
import { UUID } from '@lumino/coreutils';

import { JupyterGISTracker } from '../types';

export namespace LayerCreationCommandIDs {
  export const newGeoJSONWithParams = 'jupytergis:newGeoJSONWithParams';
  export const newRasterWithParams = 'jupytergis:newRasterWithParams';
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
            description: 'The path to the .jGIS file to modify'
          },
          Name: {
            type: 'string',
            description: 'The name of the new GeoJSON layer'
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
                    description: 'The path to the GeoJSON file'
                  },
                  data: {
                    type: 'object',
                    description: 'The GeoJSON data object'
                  },
                  valid: {
                    type: 'boolean',
                    description: 'Whether the data are valid',
                    readOnly: true
                  }
                }
              },
              color: {
                type: 'object',
                description: 'The color configuration for the layer'
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1
              },
              symbologyState: {
                type: 'object',
                description: 'Symbology configuration for the layer',
                required: ['renderType'],
                properties: {
                  renderType: {
                    type: 'string',
                    enum: ['Single Symbol', 'Graduated', 'Categorized']
                  },
                  value: { type: 'string' },
                  method: {
                    type: 'string',
                    enum: ['color', 'radius']
                  },
                  colorRamp: {
                    type: 'string',
                    default: 'viridis'
                  },
                  nClasses: {
                    type: 'string',
                    default: '9'
                  },
                  mode: {
                    type: 'string',
                    default: 'equal interval',
                    enum: [
                      'quantile',
                      'equal interval',
                      'jenks',
                      'pretty',
                      'logarithmic'
                    ]
                  }
                }
              }
            }
          }
        }
      }
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
        parameters: parameters.source
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
          source: sourceId
        }
      };

      model.addLayer(layerId, layerModel);
    }) as any
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
            description: 'Path to the .jGIS file to modify'
          },
          Name: {
            type: 'string',
            description: 'The name of the new Raster Tile Layer'
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
                    description: 'The URL to the tile provider'
                  },
                  minZoom: {
                    type: 'number',
                    minimum: 0,
                    maximum: 24,
                    default: 0,
                    description: 'Minimum zoom level'
                  },
                  maxZoom: {
                    type: 'number',
                    minimum: 0,
                    maximum: 24,
                    default: 24,
                    description: 'Maximum zoom level'
                  },
                  attribution: {
                    type: 'string',
                    default: '',
                    description: 'Attribution for the raster source'
                  },
                  htmlAttribution: {
                    type: 'string',
                    default: '',
                    description: 'HTML attribution for the raster source'
                  },
                  provider: {
                    type: 'string',
                    default: '',
                    description: 'Provider name'
                  },
                  bounds: {
                    type: 'array',
                    description: 'Bounds of the source',
                    items: {
                      type: 'array',
                      items: { type: 'number' }
                    },
                    default: []
                  },
                  urlParameters: {
                    type: 'object',
                    description: 'Extra URL parameters',
                    additionalProperties: { type: 'string' },
                    default: {}
                  },
                  interpolate: {
                    type: 'boolean',
                    description:
                      'Interpolate between grid cells when overzooming?',
                    default: false
                  }
                }
              },
              opacity: {
                type: 'number',
                description: 'Layer opacity',
                default: 1,
                minimum: 0,
                maximum: 1,
                multipleOf: 0.1
              }
            }
          }
        }
      }
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
        parameters: parameters.source
      };

      sharedModel.addSource(sourceId, sourceModel);

      const layerModel: IJGISLayer = {
        type: 'RasterLayer',
        name: Name,
        visible: true,
        parameters: {
          opacity: parameters.opacity ?? 1,
          source: sourceId
        }
      };

      model.addLayer(layerId, layerModel);
    }) as any
  });
}
