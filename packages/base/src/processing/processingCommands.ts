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

  console.log(keyToVal);

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
    if (processingElement.gen_type === GEN_TYPE.vector) {
      commands.addCommand(processingElement.gen_name, {
        label: trans.__(processingElement.gen_label),
        isEnabled: () => selectedLayerIsOfType(['VectorLayer'], tracker),
        execute: async () => {
          await processSelectedLayer(
            tracker,
            formSchemaRegistry,
            processingElement.description as ProcessingType,
            {
              sqlQueryFn: (layerName, keyToVal) =>
                replaceInSql(
                  processingElement.gen_additionals.sql,
                  keyToVal,
                  layerName,
                ),
              gdalFunction: processingElement.gen_additionals.gen_gdal,
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
