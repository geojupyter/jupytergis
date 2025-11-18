import { JgisCoordinates } from '@jupytergis/schema';
import { IRenderMime } from '@jupyterlab/rendermime';
import { CommandRegistry } from '@lumino/commands';
import { Coordinate } from 'ol/coordinate';
import { fromLonLat } from 'ol/proj';

import { JupyterGISTracker } from '../types';

export namespace DocumentActionCommandIDs {
  export const getGeolocationWithParams = 'jupytergis:getGeolocationWithParams';
}

export function addDocumentActionCommands(options: {
  tracker: JupyterGISTracker;
  commands: CommandRegistry;
  trans: IRenderMime.TranslationBundle;
}) {
  const { commands, tracker, trans } = options;

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
