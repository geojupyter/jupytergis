import {
  IDict,
  IJGISFormSchemaRegistry,
  ProcessingMerge,
  GEN_TYPE,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

import { selectedLayerIsOfType, processSelectedLayer } from '../processing';
import { JupyterGISTracker } from '../types';
import { ProcessingType } from './_generated/processingType';

export function replaceInSql(
  sql: string,
  keyToVal: IDict<string>,
  layerName: string,
) {
  const helper = (key: string, s: string, value: string): string =>
    s.replace(RegExp(`{${key}}`, 'g'), value);

  let out = helper('layerName', sql, layerName);

  for (const [key, value] of Object.entries(keyToVal)) {
    out = helper(key, out, value);
  }

  return out;
}

export function addProcessingCommands(
  app: JupyterFrontEnd,
  commands: CommandRegistry,
  tracker: JupyterGISTracker,
  trans: any,
  formSchemaRegistry: IJGISFormSchemaRegistry,
) {
  for (const processingElement of ProcessingMerge) {
    if (processingElement.processType === GEN_TYPE.vector) {
      commands.addCommand(processingElement.processName, {
        label: trans.__(processingElement.processLabel),
        isEnabled: () => selectedLayerIsOfType(['VectorLayer'], tracker),
        execute: async () => {
          await processSelectedLayer(
            tracker,
            formSchemaRegistry,
            processingElement.description as ProcessingType,
            {
              sqlQueryFn: (layerName, keyToVal) =>
                replaceInSql(
                  processingElement.processAdditionalsParams.sql,
                  keyToVal,
                  layerName,
                ),
              gdalFunction:
                processingElement.processAdditionalsParams.gdalFunction,
              options: (sqlQuery: string) => [
                '-f',
                'GeoJSON',
                '-dialect',
                'SQLITE',
                '-sql',
                sqlQuery,
                'output.geojson',
              ],
            },
            app,
          );
        },
      });
    }
  }
}
