import { IJGISLayerGroup, JgisCoordinates } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';
import { Coordinate } from 'ol/coordinate';
import { fromLonLat } from 'ol/proj';

import { downloadFile, getGeoJSONDataFromLayerSource } from '../tools';
import { JupyterGISTracker } from '../types';

export namespace DocumentActionCommandIDs {
  export const moveLayerToNewGroupWithParams =
    'jupytergis:moveLayerToNewGroupWithParams';
  export const renameSourceWithParams = 'jupytergis:renameSourceWithParams';
  export const removeSourceWithParams = 'jupytergis:removeSourceWithParams';
  export const zoomToLayerWithParams = 'jupytergis:zoomToLayerWithParams';
  export const downloadGeoJSONWithParams =
    'jupytergis:downloadGeoJSONWithParams';
  export const getGeolocationWithParams = 'jupytergis:getGeolocationWithParams';
}

export function addDocumentActionCommands(options: {
  tracker: JupyterGISTracker;
  commands: CommandRegistry;
  trans: IRenderMime.TranslationBundle;
}) {
  const { commands, tracker, trans } = options;

  commands.addCommand(DocumentActionCommandIDs.moveLayerToNewGroupWithParams, {
    label: trans.__('Move selected layers to new group from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'groupName', 'layerIds'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
          groupName: {
            type: 'string',
            description: 'The name of the new layer group to create',
          },
          layerIds: {
            type: 'array',
            description: 'Array of layer IDs to move to the new group',
            items: { type: 'string' },
          },
        },
      },
    },
    execute: ((args: {
      filePath: string;
      groupName: string;
      layerIds: string[];
    }) => {
      const { filePath, groupName, layerIds } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current || !current.model.sharedModel.editable) {
        return;
      }

      const layerMap: { [key: string]: any } = {};
      layerIds.forEach(id => {
        layerMap[id] = { type: 'layer', selectedNodeId: id };
      });

      const newGroup: IJGISLayerGroup = {
        name: groupName,
        layers: layerIds,
      };

      current.model.addNewLayerGroup(layerMap, newGroup);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.renameSourceWithParams, {
    label: trans.__('Rename source from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'sourceId', 'newName'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to be modified',
          },
          sourceId: {
            type: 'string',
            description: 'The ID of the source to rename',
          },
          newName: {
            type: 'string',
            description: 'The new name for the source',
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      sourceId: string;
      newName: string;
    }) => {
      const { filePath, sourceId, newName } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current || !current.model.sharedModel.editable) {
        return;
      }

      const source = current.model.getSource(sourceId);
      if (!source) {
        console.warn(`Source with ID ${sourceId} not found`);
        return;
      }

      source.name = newName;
      current.model.sharedModel.updateSource(sourceId, source);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.removeSourceWithParams, {
    label: trans.__('Remove source from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'sourceId'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file to be modified',
          },
          sourceId: {
            type: 'string',
            description: 'The ID of the source to remove',
          },
        },
      },
    },
    execute: ((args: { filePath: string; sourceId: string }) => {
      const { filePath, sourceId } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current || !current.model.sharedModel.editable) {
        return;
      }

      const layersUsingSource = current.model.getLayersBySource(sourceId);
      if (layersUsingSource.length > 0) {
        showErrorMessage(
          'Remove source error',
          'The source is used by a layer.',
        );
        return;
      }

      current.model.sharedModel.removeSource(sourceId);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.zoomToLayerWithParams, {
    label: trans.__('Zoom to layer from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'layerId'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file containing the layer',
          },
          layerId: {
            type: 'string',
            description: 'The ID of the layer to zoom to',
          },
        },
      },
    },
    execute: ((args: { filePath: string; layerId: string }) => {
      const { filePath, layerId } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current || !current.model.sharedModel.editable) {
        return;
      }

      console.log(`Zooming to layer: ${layerId}`);
      current.model.centerOnPosition(layerId);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.downloadGeoJSONWithParams, {
    label: trans.__('Download layer as GeoJSON'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'layerId', 'exportFileName'],
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the .jGIS file containing the layer',
          },
          layerId: {
            type: 'string',
            description: 'The ID of the layer to export',
          },
          exportFileName: {
            type: 'string',
            description: 'The desired name of the exported GeoJSON file',
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      layerId: string;
      exportFileName: string;
    }) => {
      const { filePath, layerId, exportFileName } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current || !current.model.sharedModel.editable) {
        console.warn('Invalid or non-editable document');
        return;
      }

      const model = current.model;
      const layer = model.getLayer(layerId);

      if (!layer || !['VectorLayer', 'ShapefileLayer'].includes(layer.type)) {
        console.warn('Layer type not supported for GeoJSON export');
        return;
      }

      const sources = model.sharedModel.sources ?? {};
      const sourceId = layer.parameters?.source;
      const source = sources[sourceId];
      if (!source) {
        console.warn('Source not found for selected layer');
        return;
      }

      const geojsonString = await getGeoJSONDataFromLayerSource(source, model);
      if (!geojsonString) {
        console.warn('Failed to generate GeoJSON data');
        return;
      }

      downloadFile(
        geojsonString,
        `${exportFileName}.geojson`,
        'application/geo+json',
      );
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.getGeolocationWithParams, {
    label: trans.__('Center on Geolocation'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: {
            type: 'string',
            description:
              'Path to the .jGIS document to center on the user’s geolocation',
          },
        },
      },
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current) {
        console.warn('No document found for provided filePath');
        return;
      }

      const viewModel = current.model;
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };

      const success = (pos: GeolocationPosition) => {
        const location: Coordinate = fromLonLat([
          pos.coords.longitude,
          pos.coords.latitude,
        ]);

        const jgisLocation: JgisCoordinates = {
          x: location[0],
          y: location[1],
        };

        viewModel.geolocationChanged.emit(jgisLocation);
      };

      const error = (err: GeolocationPositionError) => {
        console.warn(`Geolocation error (${err.code}): ${err.message}`);
      };

      navigator.geolocation.getCurrentPosition(success, error, options);
    }) as any,
  });
}
