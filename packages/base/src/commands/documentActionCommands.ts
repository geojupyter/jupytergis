import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';

import { getSingleSelectedLayer } from '../processing';
import { JupyterGISTracker } from '../types';

export namespace DocumentActionCommandIDs {
  export const undoWithParams = 'jupytergis:undoWithParams';
  export const redoWithParams = 'jupytergis:redoWithParams';
  export const identifyWithParams = 'jupytergis:identifyWithParams';
  export const temporalControllerWithParams = 'jupytergis:temporalControllerWithParams';
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
            description: 'The path to the .jGIS file to be modified'
          }
        }
      }
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (current) {
        return current.model.sharedModel.undo();
      }
    }) as any
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
            description: 'The path to the .jGIS file to be modified'
          }
        }
      }
    },
    execute: (async (args: { filePath: string }) => {
      const { filePath } = args;
      const current = tracker.find(w => w.model.filePath === filePath);
      if (current) {
        return current.model.sharedModel.redo();
      }
    }) as any
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
              'The path to the .jGIS file where identify mode will be toggled'
          }
        }
      }
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
        'VectorTileLayer'
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
      commands.notifyCommandChanged(DocumentActionCommandIDs.identifyWithParams);
    }) as any
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
              'Path to the .jGIS file whose temporal controller should be toggled'
          }
        }
      }
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
        commands.notifyCommandChanged(DocumentActionCommandIDs.temporalControllerWithParams);
        return;
      }

      model.toggleTemporalController();
      commands.notifyCommandChanged(DocumentActionCommandIDs.temporalControllerWithParams);
    }) as any
  });
}
