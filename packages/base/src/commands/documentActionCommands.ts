import { IJGISLayerGroup } from '@jupytergis/schema';
import { showErrorMessage } from '@jupyterlab/apputils';
import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';

import { getSingleSelectedLayer } from '../processing';
import { downloadFile, getGeoJSONDataFromLayerSource } from '../tools';
import { JupyterGISTracker } from '../types';

export namespace DocumentActionCommandIDs {
  export const undoWithParams = 'jupytergis:undoWithParams';
  export const redoWithParams = 'jupytergis:redoWithParams';
  export const identifyWithParams = 'jupytergis:identifyWithParams';
  export const temporalControllerWithParams =
    'jupytergis:temporalControllerWithParams';
  export const renameLayerWithParams = 'jupytergis:renameLayerWithParams';
  export const removeLayerWithParams = 'jupytergis:removeLayerWithParams';
  export const renameGroupWithParams = 'jupytergis:renameGroupWithParams';
  export const removeGroupWithParams = 'jupytergis:removeGroupWithParams';
  export const moveLayersToGroupWithParams =
    'jupytergis:moveLayersToGroupWithParams';
  export const moveLayerToNewGroupWithParams =
    'jupytergis:moveLayerToNewGroupWithParams';
  export const renameSourceWithParams = 'jupytergis:renameSourceWithParams';
  export const removeSourceWithParams = 'jupytergis:removeSourceWithParams';
  export const zoomToLayerWithParams = 'jupytergis:zoomToLayerWithParams';
  export const downloadGeoJSONWithParams =
    'jupytergis:downloadGeoJSONWithParams';
}

export function addDocumentActionCommands(options: {
  tracker: JupyterGISTracker;
  commands: CommandRegistry;
  trans: IRenderMime.TranslationBundle;
}) {
  const { commands, tracker, trans } = options;

  commands.addCommand(DocumentActionCommandIDs.undoWithParams, {
    label: trans.__('Undo from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
        },
      },
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (current) {
        return current.model.sharedModel.undo();
      }
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.redoWithParams, {
    label: trans.__('Redo from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
        },
      },
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (current) {
        return current.model.sharedModel.redo();
      }
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.identifyWithParams, {
    label: trans.__('Identify features from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: {
            type: 'string',
            description:
              'The path to the .jGIS file where identify mode will be toggled',
          },
        },
      },
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current) {
        console.warn('No active JupyterGIS widget found for', filePath);
        return;
      }

      // Get currently selected layer
      const selectedLayer = getSingleSelectedLayer(tracker);
      if (!selectedLayer) {
        console.warn('No selected layer found');
        return;
      }

      const canIdentify = [
        'VectorLayer',
        'ShapefileLayer',
        'WebGlLayer',
        'VectorTileLayer',
      ].includes(selectedLayer.type);

      if (current.model.currentMode === 'identifying' && !canIdentify) {
        current.model.currentMode = 'panning';
        current.node.classList.remove('jGIS-identify-tool');
        return;
      }

      // Toggle identify tool
      current.node.classList.toggle('jGIS-identify-tool');
      current.model.toggleIdentify();

      // Notify change
      commands.notifyCommandChanged(
        DocumentActionCommandIDs.identifyWithParams,
      );
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.temporalControllerWithParams, {
    label: trans.__('Toggle Temporal Controller from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: {
            type: 'string',
            description:
              'Path to the .jGIS file whose temporal controller should be toggled',
          },
        },
      },
    },
    isToggled: () => {
      const current = tracker.currentWidget;
      return current?.model.isTemporalControllerActive || false;
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current) {
        console.warn('No JupyterGIS widget found for', filePath);
        return;
      }

      const model = current.model;
      const selectedLayers = model.localState?.selected?.value;
      if (!selectedLayers) {
        console.warn('No layer selected');
        return;
      }

      const layerId = Object.keys(selectedLayers)[0];
      const layerType = model.getLayer(layerId)?.type;
      if (!layerType) {
        console.warn('Selected layer has no type');
        return;
      }

      const isSelectionValid =
        Object.keys(selectedLayers).length === 1 &&
        !model.getSource(layerId) &&
        ['VectorLayer', 'HeatmapLayer'].includes(layerType);

      if (!isSelectionValid && model.isTemporalControllerActive) {
        model.toggleTemporalController();
        commands.notifyCommandChanged(
          DocumentActionCommandIDs.temporalControllerWithParams,
        );
        return;
      }

      model.toggleTemporalController();
      commands.notifyCommandChanged(
        DocumentActionCommandIDs.temporalControllerWithParams,
      );
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.renameLayerWithParams, {
    label: trans.__('Rename layer from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'layerId', 'newName'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
          layerId: {
            type: 'string',
            description: 'The ID of the layer to be renamed',
          },
          newName: {
            type: 'string',
            description: 'The new name for the layer',
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      layerId: string;
      newName: string;
    }) => {
      const { filePath, layerId, newName } = args;
      const current = tracker.find(w => w.model.filePath === filePath);

      if (!current || !current.model.sharedModel.editable) {
        return;
      }

      const sharedModel = current.model.sharedModel;
      const layer = sharedModel.layers[layerId];
      if (!layer) {
        return;
      }

      layer.name = newName;
      sharedModel.updateLayer(layerId, layer);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.removeLayerWithParams, {
    label: trans.__('Remove layer from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'layerId'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
          layerId: {
            type: 'string',
            description: 'The ID of the layer to be removed',
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

      const sharedModel = current.model.sharedModel;
      const existing = sharedModel.layers[layerId];
      if (!existing) {
        return;
      }

      current.model.removeLayer(layerId);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.renameGroupWithParams, {
    label: trans.__('Rename Group from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'oldName', 'newName'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
          oldName: {
            type: 'string',
            description: 'The existing name of the group to rename',
          },
          newName: {
            type: 'string',
            description: 'The new name for the group',
          },
        },
      },
    },
    execute: (async (args: {
      filePath: string;
      oldName: string;
      newName: string;
    }) => {
      const { filePath, oldName, newName } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current || !current.model.sharedModel.editable) {
        return;
      }

      const model = current.model;
      model.renameLayerGroup(oldName, newName);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.removeGroupWithParams, {
    label: trans.__('Remove group from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'groupName'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
          groupName: {
            type: 'string',
            description: 'The name of the group to remove',
          },
        },
      },
    },
    execute: ((args: { filePath: string; groupName: string }) => {
      const { filePath, groupName } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current || !current.model.sharedModel.editable) {
        return;
      }
      current.model.removeLayerGroup(groupName);
    }) as any,
  });

  commands.addCommand(DocumentActionCommandIDs.moveLayersToGroupWithParams, {
    label: trans.__('Move layers to group from file name'),
    isEnabled: () => true,
    describedBy: {
      args: {
        type: 'object',
        required: ['filePath', 'layerIds', 'groupName'],
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the .jGIS file to be modified',
          },
          layerIds: {
            type: 'array',
            description: 'Array of layer IDs to move',
            items: { type: 'string' },
          },
          groupName: {
            type: 'string',
            description:
              'The name of the target group. Use empty string for root.',
          },
        },
      },
    },
    execute: ((args: {
      filePath: string;
      layerIds: string[];
      groupName: string;
    }) => {
      const { filePath, layerIds, groupName } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (!current || !current.model.sharedModel.editable) {
        return;
      }
      current.model.moveItemsToGroup(layerIds, groupName);
    }) as any,
  });

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
}
