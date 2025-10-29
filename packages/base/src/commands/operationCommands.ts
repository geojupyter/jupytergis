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
      if (!sharedModel.editable) {
        console.warn('Shared model not editable');
        return;
      }

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
}
