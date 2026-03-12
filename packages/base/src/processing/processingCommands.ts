import {
  IDict,
  IJGISFormSchemaRegistry,
  ProcessingMerge,
  ProcessingLogicType,
  ProcessingType,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

import { selectedLayerIsOfType, processLayer } from './index';
import { JupyterGISTracker } from '../types';

export function replaceInSql(
  sql: string,
  keyToVal: IDict<string>,
  layerName: string,
) {
  const replaceTemplateString = (args: {
    variableName: string;
    template: string;
    value: string;
  }): string =>
    args.template.replace(RegExp(`{${args.variableName}}`, 'g'), args.value);

  let out = replaceTemplateString({
    variableName: 'layerName',
    template: sql,
    value: layerName,
  });

  for (const [key, value] of Object.entries(keyToVal)) {
    out = replaceTemplateString({
      variableName: key,
      template: out,
      value: value,
    });
  }

  return out;
}

export function addProcessingCommands(
  app: JupyterFrontEnd,
  commands: CommandRegistry,
  tracker: JupyterGISTracker,
  trans: any,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  processingSchemas: Record<string, any>,
) {
  for (const processingElement of ProcessingMerge) {

    const schemaKey = Object.keys(processingSchemas).find(
      k => k.toLowerCase() === processingElement.name.toLowerCase(),
    );
    if (!schemaKey) {
      continue;
    }

    if (processingElement.type === ProcessingLogicType.vector) {
      commands.addCommand(processingElement.name, {
        label: trans.__(processingElement.label),
        describedBy: {
          args: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the .jGIS file',
              },
              layerId: {
                type: 'string',
                description: 'Layer ID to process',
              },
              params: processingSchemas[schemaKey],
            },
          },
        },

        isEnabled: () => selectedLayerIsOfType(['VectorLayer'], tracker),

        execute: async (args?: {
          filePath?: string;
          layerId?: string;
          processingInputs?: Record<string, any>;
        }) => {
          await processLayer(
            tracker,
            formSchemaRegistry,
            processingElement.description as ProcessingType,
            {
              sqlQueryFn: (layerName, keyToVal) =>
                replaceInSql(
                  processingElement.operations.sql,
                  keyToVal,
                  layerName,
                ),
              gdalFunction: processingElement.operations.gdalFunction,
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
            args?.filePath,
            args?.processingInputs,
          );
        },
      });
    } else {
      console.error('Unsupported process type');
      return;
    }
  }
}
