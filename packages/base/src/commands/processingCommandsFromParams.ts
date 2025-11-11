import {
  IJGISFormSchemaRegistry,
  ProcessingLogicType,
  ProcessingType,
  ProcessingMerge,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

import { processSelectedLayer } from '../processing';
import { replaceInSql } from '../processing/processingCommands';
import { JupyterGISTracker } from '../types';

/**
 * Dynamically registers processing commands from schemas and ProcessingMerge metadata.
 */
export function addProcessingCommandsFromParams(options: {
  app: JupyterFrontEnd;
  commands: CommandRegistry;
  tracker: JupyterGISTracker;
  trans: any;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  processingSchemas: Record<string, any>;
}) {
  const {
    app,
    commands,
    tracker,
    trans,
    formSchemaRegistry,
    processingSchemas,
  } = options;

  for (const processingElement of ProcessingMerge) {
    if (processingElement.type !== ProcessingLogicType.vector) {
      console.error(
        `Skipping unsupported processing type: ${processingElement.type}`,
      );
      continue;
    }

    const schemaKey = Object.keys(processingSchemas).find(
      key => key.toLowerCase() === processingElement.name.toLowerCase(),
    );
    const schema = schemaKey ? processingSchemas[schemaKey] : undefined;
    if (!schema) {
      console.warn(
        `No schema found for ${processingElement.name}, skipping command`,
      );
      continue;
    }

    const commandId = `${processingElement.name}WithParams`;

    commands.addCommand(commandId, {
      label: trans.__(`${processingElement.label} from params`),
      isEnabled: () => true,
      describedBy: {
        args: {
          type: 'object',
          required: ['filePath', 'params'],
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the .jGIS file containing the layer',
            },
            params: schema,
          },
        },
      },
      execute: (async (args: {
        filePath: string;
        params: Record<string, any>;
      }) => {
        const { filePath, params } = args;
        const current = tracker.find(w => w.model.filePath === filePath);

        if (!current) {
          console.warn('No JupyterGIS widget found for', filePath);
          return;
        }

        // Build SQL using replaceInSql()
        const sql = replaceInSql(
          processingElement.operations.sql,
          Object.fromEntries(
            Object.entries(params).map(([k, v]) => [k, String(v)]),
          ),
          params.inputLayer ?? '',
        );

        // Execute using standard processSelectedLayer()
        await processSelectedLayer(
          tracker,
          formSchemaRegistry,
          processingElement as unknown as ProcessingType,
          {
            sqlQueryFn: () => sql,
            gdalFunction: processingElement.operations.gdalFunction,
            options: (query: string) => [
              '-f',
              'GeoJSON',
              '-dialect',
              'SQLITE',
              '-sql',
              query,
              'output.geojson',
            ],
          },
          app,
        );
      }) as any,
    });
  }
}
