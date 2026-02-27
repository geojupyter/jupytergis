import {
  IDict,
  IJGISFormSchemaRegistry,
  ProcessingType,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

import { selectedLayerIsOfType, processSelectedLayer } from './index';
import { JupyterGISTracker } from '../types';

import {
  forEachVectorProcessing,
  buildGeoJsonSqlOptions,
} from './processingVectorShared';

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
) {
  forEachVectorProcessing(processingElement => {
    commands.addCommand(processingElement.name, {
      label: trans.__(processingElement.label),
      describedBy: {
        args: {
          type: 'object',
          properties: {},
        },
      },
      isEnabled: () => selectedLayerIsOfType(['VectorLayer'], tracker),
      execute: async () => {
        await processSelectedLayer(
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
            options: buildGeoJsonSqlOptions,
          },
          app,
        );
      },
    });
  });
}
