import {
  IJGISFormSchemaRegistry,
  ProcessingLogicType,
  ProcessingType,
  ProcessingMerge,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

import { replaceInSql } from '../processing/processingCommands';
import { processSelectedLayer } from '../processing';
import { JupyterGISTracker } from '../types';

export function addProcessingCommandsFromParams(options: {
  app: JupyterFrontEnd;
  commands: CommandRegistry;
  tracker: JupyterGISTracker;
  trans: any;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  processingSchemas: Record<string, any>;
}): void {
  const { app, commands, tracker, trans, formSchemaRegistry, processingSchemas } = options;

  for (const proc of ProcessingMerge) {
    if (proc.type !== ProcessingLogicType.vector) {
      continue;
    }

    const schemaKey = Object.keys(processingSchemas).find(
      k => k.toLowerCase() === proc.name.toLowerCase(),
    );
    if (!schemaKey) {
      continue;
    }

    const commandId = `${proc.name}WithParams`;

    commands.addCommand(commandId, {
      label: trans.__(`${proc.label} from params`),
      isEnabled: () => true,
      describedBy: {
        args: {
          type: 'object',
          required: ['filePath', 'params'],
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the .jGIS file',
            },
            params: processingSchemas[schemaKey],
          },
        },
      },
      execute: async (args?: {
        filePath?: string;
        params?: Record<string, any>;
      }) => {
        await processSelectedLayer(
          tracker,
          formSchemaRegistry,
          proc.name as ProcessingType,
          {
            sqlQueryFn: (layer, p) =>
              replaceInSql(proc.operations.sql, p, layer),
            gdalFunction: 'ogr2ogr',
            options: (sql: string) => [
              '-f',
              'GeoJSON',
              '-dialect',
              'SQLITE',
              '-sql',
              sql,
              'output.geojson',
            ],
          },
          app,
          args,
        );
      },
    });
  }
}
