import {
  IDict,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  IJGISFormSchemaRegistry,
  LayerType
} from '@jupytergis/schema';
import { getGdal } from './gdal';
import { JupyterGISTracker } from './types';
import { UUID } from '@lumino/coreutils';
import { ProcessingFormDialog } from './dialogs/ProcessingFormDialog';
import { getGeoJSONDataFromLayerSource } from './tools';
import { JupyterFrontEnd } from '@jupyterlab/application';

/**
 * Get the currently selected layer from the shared model. Returns null if there is no selection or multiple layer is selected.
 */
export function getSingleSelectedLayer(
  tracker: JupyterGISTracker
): IJGISLayer | null {
  const model = tracker.currentWidget?.model as IJupyterGISModel;
  if (!model) {
    return null;
  }

  const localState = model.sharedModel.awareness.getLocalState();
  if (!localState || !localState['selected']?.value) {
    return null;
  }

  const selectedLayers = Object.keys(localState['selected'].value);

  // Ensure only one layer is selected
  if (selectedLayers.length !== 1) {
    return null;
  }

  const selectedLayerId = selectedLayers[0];
  const layers = model.sharedModel.layers ?? {};
  const selectedLayer = layers[selectedLayerId];

  return selectedLayer && selectedLayer.parameters ? selectedLayer : null;
}

/**
 * Check if the selected layer is of one of the specified types
 */
export function selectedLayerIsOfType(
  allowedTypes: LayerType[],
  tracker: JupyterGISTracker
): boolean {
  const selectedLayer = getSingleSelectedLayer(tracker);
  return selectedLayer ? allowedTypes.includes(selectedLayer.type) : false;
}

/**
 * Extract GeoJSON from selected layer's source
 */
export async function getLayerGeoJSON(
  layer: IJGISLayer,
  sources: IDict,
  model: IJupyterGISModel
): Promise<string | null> {
  if (!layer.parameters || !layer.parameters.source) {
    console.error('Selected layer does not have a valid source.');
    return null;
  }

  const source = sources[layer.parameters.source];
  if (!source || !source.parameters) {
    console.error(
      `Source with ID ${layer.parameters.source} not found or missing path.`
    );
    return null;
  }

  return await getGeoJSONDataFromLayerSource(source, model);
}

export type GdalFunctions =
  | 'ogr2ogr'
  | 'gdal_rasterize'
  | 'gdalwarp'
  | 'gdal_translate';

/**
 * Generalized processing function for Buffer & Dissolve
 */
export async function processSelectedLayer(
  tracker: JupyterGISTracker,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  processingType: 'Buffer' | 'Dissolve',
  processingOptions: {
    sqlQueryFn: (layerName: string, param: any) => string;
    gdalFunction: GdalFunctions;
    options: (sqlQuery: string) => string[];
  },
  app: JupyterFrontEnd
) {
  const selected = getSingleSelectedLayer(tracker);
  if (!selected || !tracker.currentWidget) {
    return;
  }

  const model = tracker.currentWidget.model;
  const sources = model?.sharedModel.sources ?? {};

  const geojsonString = await getLayerGeoJSON(selected, sources, model);
  if (!geojsonString) {
    return;
  }

  const schema = {
    ...(formSchemaRegistry.getSchemas().get(processingType) as IDict)
  };
  const selectedLayerId = Object.keys(
    model?.sharedModel.awareness.getLocalState()?.selected?.value || {}
  )[0];

  // Open ProcessingFormDialog
  const formValues = await new Promise<IDict>(resolve => {
    const dialog = new ProcessingFormDialog({
      title: processingType.charAt(0).toUpperCase() + processingType.slice(1),
      schema,
      model,
      sourceData: {
        inputLayer: selectedLayerId,
        outputLayerName: selected.name
      },
      formContext: 'create',
      processingType,
      syncData: (props: IDict) => {
        resolve(props);
        dialog.dispose();
      }
    });
    dialog.launch();
  });

  if (!formValues) {
    return;
  }

  let processParam: any;
  switch (processingType) {
    case 'Buffer':
      processParam = formValues.bufferDistance;
      break;
    case 'Dissolve':
      processParam = formValues.dissolveField;
      break;
    default:
      console.error(`Unsupported processing type: ${processingType}`);
      return;
  }

  const embedOutputLayer = formValues.embedOutputLayer;

  const fileBlob = new Blob([geojsonString], {
    type: 'application/geo+json'
  });
  const geoFile = new File([fileBlob], 'data.geojson', {
    type: 'application/geo+json'
  });

  const Gdal = await getGdal();
  const result = await Gdal.open(geoFile);
  const dataset = result.datasets[0] as any;
  const layerName = dataset.info.layers[0].name;

  const sqlQuery = processingOptions.sqlQueryFn(layerName, processParam);
  const fullOptions = processingOptions.options(sqlQuery);

  await executeSQLProcessing(
    model,
    geojsonString,
    processingOptions.gdalFunction,
    fullOptions,
    formValues.outputLayerName,
    processingType,
    embedOutputLayer,
    tracker,
    app
  );
}

export async function executeSQLProcessing(
  model: IJupyterGISModel,
  geojsonString: string,
  gdalFunction: GdalFunctions,
  options: string[],
  layerNamePrefix: string,
  processingType: 'Buffer' | 'Dissolve',
  embedOutputLayer: boolean,
  tracker: JupyterGISTracker,
  app: JupyterFrontEnd
) {
  const geoFile = new File(
    [new Blob([geojsonString], { type: 'application/geo+json' })],
    'data.geojson',
    { type: 'application/geo+json' }
  );

  const Gdal = await getGdal();
  const result = await Gdal.open(geoFile);

  if (result.datasets.length === 0) {
    return;
  }

  const dataset = result.datasets[0] as any;
  const outputFilePath = await Gdal[gdalFunction](dataset, options);
  const processedBytes = await Gdal.getFileBytes(outputFilePath);
  const processedGeoJSONString = new TextDecoder().decode(processedBytes);
  Gdal.close(dataset);

  if (!embedOutputLayer) {
    // Save the output as a file
    const jgisFilePath = tracker.currentWidget?.model.filePath;
    const jgisDir = jgisFilePath
      ? jgisFilePath.substring(0, jgisFilePath.lastIndexOf('/'))
      : '';

    const outputFileName = `${layerNamePrefix}_${processingType}.json`;
    const savePath = jgisDir ? `${jgisDir}/${outputFileName}` : outputFileName;

    await app.serviceManager.contents.save(savePath, {
      type: 'file',
      format: 'text',
      content: processedGeoJSONString
    });

    const newSourceId = UUID.uuid4();
    const sourceModel: IJGISSource = {
      type: 'GeoJSONSource',
      name: outputFileName,
      parameters: {
        path: outputFileName
      }
    };

    const layerModel: IJGISLayer = {
      type: 'VectorLayer',
      parameters: { source: newSourceId },
      visible: true,
      name: outputFileName
    };

    model.sharedModel.addSource(newSourceId, sourceModel);
    model.addLayer(UUID.uuid4(), layerModel);
  } else {
    // Embed the output directly into the model
    const processedGeoJSON = JSON.parse(processedGeoJSONString);
    const newSourceId = UUID.uuid4();

    const sourceModel: IJGISSource = {
      type: 'GeoJSONSource',
      name: `${layerNamePrefix} ${processingType.charAt(0).toUpperCase() + processingType.slice(1)}`,
      parameters: { data: processedGeoJSON }
    };

    const layerModel: IJGISLayer = {
      type: 'VectorLayer',
      parameters: { source: newSourceId },
      visible: true,
      name: `${layerNamePrefix} ${processingType.charAt(0).toUpperCase() + processingType.slice(1)}`
    };

    model.sharedModel.addSource(newSourceId, sourceModel);
    model.addLayer(UUID.uuid4(), layerModel);
  }
}
