import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';

import { JupyterGISTracker } from '../types';

export namespace DocumentActionCommandIDs {
  export const undoWithParams = 'jupytergis:undoWithParams';
  export const redoWithParams = 'jupytergis:redoWithParams';
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
}
