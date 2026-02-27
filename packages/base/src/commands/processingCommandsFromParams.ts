import {
  IJGISFormSchemaRegistry,
  ProcessingType,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { CommandRegistry } from '@lumino/commands';

import { getGdal } from '../gdal';
import { getLayerGeoJSON, executeSQLProcessing } from '../processing';
import { replaceInSql } from '../processing/processingCommands';
import { JupyterGISTracker } from '../types';

import {
  forEachVectorProcessing,
  buildGeoJsonSqlOptions,
} from '../processing/processingVectorShared';

/**
 * Execute processing directly from params (no UI dialogs).
 */
async function processLayerFromParams(
  tracker: JupyterGISTracker,
  processingType: ProcessingType,
  options: {
    sqlQueryFn: (layerName: string, param: any) => string;
    gdalFunction: 'ogr2ogr' | 'gdal_rasterize' | 'gdalwarp' | 'gdal_translate';
    gdalOptions: (sqlQuery: string) => string[];
  },
  app: JupyterFrontEnd,
  filePath: string,
  params: Record<string, any>,
): Promise<void> {
  const current = tracker.find(w => w.model.filePath === filePath);
  if (!current) {
    return;
  }

  const model = current.model;
  const { sources = {}, layers = {} } = model.sharedModel;
  const inputLayerId = params.inputLayer;
  const inputLayer = layers[inputLayerId];
  if (!inputLayer) {
    return;
  }

  const geojsonString = await getLayerGeoJSON(inputLayer, sources, model);
  if (!geojsonString) {
    return;
  }

  const Gdal = await getGdal();
  const fileBlob = new Blob([geojsonString], { type: 'application/geo+json' });
  const geoFile = new File([fileBlob], 'input.geojson', {
    type: 'application/geo+json',
  });

  const result = await Gdal.open(geoFile);
  const dataset = result.datasets[0] as any;
  const layerName = dataset.info.layers[0].name;

  const sqlQuery = options.sqlQueryFn(layerName, params);
  const fullOptions = options.gdalOptions(sqlQuery);

  await executeSQLProcessing(
    model,
    geojsonString,
    options.gdalFunction,
    fullOptions,
    processingType,
    processingType,
    true,
    tracker,
    app,
  );
}

/**
 * Register all processing commands from schema + ProcessingMerge metadata.
 */
export function addProcessingCommandsFromParams(options: {
  app: JupyterFrontEnd;
  commands: CommandRegistry;
  tracker: JupyterGISTracker;
  trans: any;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  processingSchemas: Record<string, any>;
}): void {
  const { app, commands, tracker, trans, processingSchemas } = options;

  forEachVectorProcessing(proc => {
    const schemaKey = Object.keys(processingSchemas).find(
      k => k.toLowerCase() === proc.name.toLowerCase(),
    );
    const schema = schemaKey ? processingSchemas[schemaKey] : undefined;
    if (!schema) return;

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
            params: schema,
          },
        },
      },
      execute: (async (args: {
        filePath: string;
        params: Record<string, any>;
      }) => {
        const { filePath, params } = args;
        await processLayerFromParams(
          tracker,
          proc.name as ProcessingType,
          {
            sqlQueryFn: (layer, p) =>
              replaceInSql(proc.operations.sql, p, layer),
            gdalFunction: 'ogr2ogr',
            gdalOptions: buildGeoJsonSqlOptions,
          },
          app,
          filePath,
          params,
        );
      }) as any,
    });
  });
}
