import {
  IDict,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  IJGISFormSchemaRegistry,
  LayerType,
  processingList,
  ProcessingType,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { UUID } from '@lumino/coreutils';

import { ProcessingFormDialog } from './ProcessingFormDialog';
import { processingFormToParam } from './processingFormToParam';
import {
  isServerProcessingEnabled,
  runServerProcessing,
} from './serverProcessing';
import { getGdal } from '../../gdal';
import { getGeoJSONDataFromLayerSource } from '../../tools';
import { JupyterGISTracker } from '../../types';

/**
 * Get the currently selected layer from the shared model. Returns null if there is no selection or multiple layer is selected.
 */
export function getSingleSelectedLayer(
  tracker: JupyterGISTracker,
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
  tracker: JupyterGISTracker,
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
  model: IJupyterGISModel,
): Promise<string | null> {
  if (!layer.parameters || !layer.parameters.source) {
    console.error('Selected layer does not have a valid source.');
    return null;
  }

  const source = sources[layer.parameters.source];
  if (!source || !source.parameters) {
    console.error(
      `Source with ID ${layer.parameters.source} not found or missing path.`,
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
export async function processLayer(
  tracker: JupyterGISTracker,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  processingType: ProcessingType,
  processingOptions: {
    sqlQueryFn: (layerName: string, param: any) => string;
    gdalFunction: GdalFunctions;
    options: (sqlQuery: string) => string[];
  },
  app: JupyterFrontEnd,
  filePath?: string,
  processingInputs?: Record<string, any>,
) {
  // Resolve widget
  const widget = filePath
    ? tracker.find(w => w.model.filePath === filePath)
    : tracker.currentWidget;

  if (!widget) {
    return;
  }

  const model = widget.model;
  const sources = model.sharedModel.sources ?? {};
  const layers = model.sharedModel.layers ?? {};

  // Resolve layer
  let selected: IJGISLayer | null = null;

  if (processingInputs?.inputLayer) {
    selected = layers[processingInputs.inputLayer];
  } else {
    selected = getSingleSelectedLayer(tracker);
  }

  if (!selected) {
    return;
  }

  const geojsonString = await getLayerGeoJSON(selected, sources, model);
  if (!geojsonString) {
    return;
  }

  // Resolve params
  let processParam: any;
  let embedOutputLayer = true;
  let outputLayerName = selected.name;

  if (processingInputs) {
    processParam = processingInputs;
    outputLayerName = `${processingType} Layer`;
  } else {
    const schema = {
      ...(formSchemaRegistry.getSchemas().get(processingType) as IDict),
    };

    const selectedLayerId = Object.keys(
      model.sharedModel.awareness.getLocalState()?.selected?.value || {},
    )[0];

    // Open ProcessingFormDialog
    const formValues = await new Promise<IDict>(resolve => {
      const dialog = new ProcessingFormDialog({
        title: processingType.charAt(0).toUpperCase() + processingType.slice(1),
        schema,
        model,
        sourceData: {
          inputLayer: selectedLayerId,
          outputLayerName: selected.name,
        },
        formContext: 'create',
        processingType,
        syncData: (props: IDict) => {
          resolve(props);
          dialog.dispose();
        },
      });
      dialog.launch();
    });

    if (!formValues) {
      return;
    }

    if (!processingList.includes(processingType)) {
      console.error(`Unsupported processing type: ${processingType}`);
      return;
    }

    processParam = processingFormToParam(formValues, processingType);
    embedOutputLayer = formValues.embedOutputLayer;
    outputLayerName = formValues.outputLayerName;
  }

  // GDAL pre-processing

  const fileBlob = new Blob([geojsonString], {
    type: 'application/geo+json',
  });
  const geoFile = new File([fileBlob], 'data.geojson', {
    type: 'application/geo+json',
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
    outputLayerName,
    processingType,
    embedOutputLayer,
    tracker,
    app,
  );
}

/**
 * Rasterize a vector layer to a GeoTIFF on disk and add it as a WebGlLayer.
 */
export async function rasterizeLayer(
  tracker: JupyterGISTracker,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  processingType: ProcessingType,
  gdalFunction: GdalFunctions,
  app: JupyterFrontEnd,
  filePath?: string,
  processingInputs?: Record<string, any>,
) {
  const widget = filePath
    ? tracker.find(w => w.model.filePath === filePath)
    : tracker.currentWidget;
  if (!widget) {
    return;
  }

  const model = widget.model;
  const sources = model.sharedModel.sources ?? {};
  const layers = model.sharedModel.layers ?? {};

  let selected: IJGISLayer | null = null;
  if (processingInputs?.inputLayer) {
    selected = layers[processingInputs.inputLayer];
  } else {
    selected = getSingleSelectedLayer(tracker);
  }
  if (!selected) {
    return;
  }

  const geojsonString = await getLayerGeoJSON(selected, sources, model);
  if (!geojsonString) {
    return;
  }

  let processParam: any;
  let outputFileName = 'rasterized.tif';
  let embedOutputLayer = false;

  if (processingInputs) {
    processParam = processingInputs;
    outputFileName = processingInputs.outputFileName || outputFileName;
    embedOutputLayer = !!processingInputs.embedOutputLayer;
  } else {
    const schema = {
      ...(formSchemaRegistry.getSchemas().get(processingType) as IDict),
    };
    const selectedLayerId = Object.keys(
      model.sharedModel.awareness.getLocalState()?.selected?.value || {},
    )[0];

    const formValues = await new Promise<IDict>(resolve => {
      const dialog = new ProcessingFormDialog({
        title: processingType.charAt(0).toUpperCase() + processingType.slice(1),
        schema,
        model,
        sourceData: {
          inputLayer: selectedLayerId,
          outputFileName: `${selected.name.replace(/\s+/g, '_')}_rasterized.tif`,
        },
        formContext: 'create',
        processingType,
        syncData: (props: IDict) => {
          resolve(props);
          dialog.dispose();
        },
      });
      dialog.launch();
    });

    if (!formValues) {
      return;
    }

    processParam = processingFormToParam(formValues, processingType);
    outputFileName = formValues.outputFileName || outputFileName;
    embedOutputLayer = !!formValues.embedOutputLayer;
  }

  const pixelSize = String(processParam.pixelSize ?? 0.01);
  const noDataValue = String(processParam.noDataValue ?? 0);
  const burnValue = String(processParam.burnValue ?? 1);
  const attributeField: string = (processParam.attributeField || '').trim();

  // Compute the min/max of the burned values so the GeoTIFF source can
  // normalize correctly. gdal_rasterize doesn't write band statistics, so
  // without this OL falls back to the data-type range (e.g. 0..255).
  let bandMin: number;
  let bandMax: number;
  if (attributeField) {
    const features = (JSON.parse(geojsonString)?.features ?? []) as Array<{
      properties?: Record<string, unknown>;
    }>;
    const values: number[] = [];
    for (const f of features) {
      const v = f.properties?.[attributeField];
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) {
        values.push(n);
      }
    }
    bandMin = values.length ? Math.min(...values) : 0;
    bandMax = values.length ? Math.max(...values) : 1;
  } else {
    // Burn mode: pixels are nodata or burnValue. min/max must be ordered and
    // non-equal so normalization doesn't divide by zero.
    const burn = Number(burnValue) || 1;
    bandMin = Math.min(0, burn);
    bandMax = Math.max(0, burn) || 1;
  }

  const options: string[] = [
    '-of',
    'GTiff',
    '-at',
    '-tr',
    pixelSize,
    pixelSize,
  ];
  if (attributeField) {
    options.push('-a', attributeField);
  } else {
    options.push('-burn', burnValue);
  }
  options.push('-a_nodata', noDataValue);

  const outputName = 'output.tif';

  let tiffBytes: Uint8Array;

  if (isServerProcessingEnabled()) {
    console.debug(
      `[JupyterGIS] Processing "${processingType}" via SERVER GDAL (${gdalFunction})`,
    );
    const t0 = performance.now();
    const response = await runServerProcessing({
      operation: gdalFunction,
      options,
      geojson: geojsonString,
      outputName,
    });
    if (response.format !== 'base64') {
      throw new Error('Expected base64 response for raster output');
    }
    const binary = atob(response.result);
    tiffBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      tiffBytes[i] = binary.charCodeAt(i);
    }
    console.debug(
      `[JupyterGIS] SERVER GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
    );
  } else {
    console.debug(
      `[JupyterGIS] Processing "${processingType}" via BROWSER WASM GDAL (${gdalFunction})`,
    );
    const t0 = performance.now();
    const geoFile = new File(
      [new Blob([geojsonString], { type: 'application/geo+json' })],
      'data.geojson',
      { type: 'application/geo+json' },
    );
    const Gdal = await getGdal();
    const result = await Gdal.open(geoFile);
    const dataset = result.datasets[0] as any;
    const outputFilePath = await (Gdal as any)[gdalFunction](
      dataset,
      options,
      outputName,
    );
    tiffBytes = await Gdal.getFileBytes(outputFilePath);
    Gdal.close(dataset);
    console.debug(
      `[JupyterGIS] BROWSER WASM GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
    );
  }

  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(
      new Blob([tiffBytes as BlobPart], { type: 'image/tiff' }),
    );
  });

  let sourceUrl: string;
  if (embedOutputLayer) {
    // Embed the GeoTIFF as a data URL inside the .jGIS document.
    sourceUrl = `data:image/tiff;base64,${base64Content}`;
  } else {
    // Save .tif to disk next to the .jGIS project file. If a file already
    // exists at the chosen path, append `_1`, `_2`, ... so repeated runs don't
    // overwrite previous outputs.
    const jgisFilePath = widget.model.filePath;
    const jgisDir = jgisFilePath
      ? jgisFilePath.substring(0, jgisFilePath.lastIndexOf('/'))
      : '';
    const dotIdx = outputFileName.lastIndexOf('.');
    const baseName =
      dotIdx > 0 ? outputFileName.slice(0, dotIdx) : outputFileName;
    const ext = dotIdx > 0 ? outputFileName.slice(dotIdx) : '';
    const candidatePath = (name: string) =>
      jgisDir ? `${jgisDir}/${name}` : name;
    const pathExists = async (path: string) => {
      try {
        await app.serviceManager.contents.get(path, { content: false });
        return true;
      } catch {
        return false;
      }
    };
    let suffix = 0;
    while (
      await pathExists(
        candidatePath(
          suffix === 0 ? outputFileName : `${baseName}_${suffix}${ext}`,
        ),
      )
    ) {
      suffix += 1;
    }
    if (suffix > 0) {
      outputFileName = `${baseName}_${suffix}${ext}`;
    }
    const savePath = candidatePath(outputFileName);

    await app.serviceManager.contents.save(savePath, {
      type: 'file',
      format: 'base64',
      content: base64Content,
    });
    sourceUrl = outputFileName;
  }

  const newSourceId = UUID.uuid4();
  const sourceModel: IJGISSource = {
    type: 'GeoTiffSource',
    name: `${selected.name} Rasterized Source`,
    parameters: {
      urls: [
        { url: sourceUrl, min: bandMin, max: bandMax, nodata: noDataValue },
      ],
      normalize: true,
      wrapX: false,
      interpolate: false,
    },
  };

  const layerModel: IJGISLayer = {
    type: 'GeoTiffLayer',
    parameters: { source: newSourceId },
    visible: true,
    name: `${selected.name} Rasterized`,
  };

  model.sharedModel.addSource(newSourceId, sourceModel);
  model.addLayer(UUID.uuid4(), layerModel);
}

export async function executeSQLProcessing(
  model: IJupyterGISModel,
  geojsonString: string,
  gdalFunction: GdalFunctions,
  options: string[],
  layerNamePrefix: string,
  processingType: ProcessingType,
  embedOutputLayer: boolean,
  tracker: JupyterGISTracker,
  app: JupyterFrontEnd,
) {
  let processedGeoJSONString: string;

  if (isServerProcessingEnabled()) {
    console.debug(
      `[JupyterGIS] Processing "${processingType}" via SERVER GDAL (${gdalFunction})`,
    );
    const t0 = performance.now();
    const outputName = 'output.geojson';
    const response = await runServerProcessing({
      operation: gdalFunction,
      options,
      geojson: geojsonString,
      outputName,
    });
    processedGeoJSONString = response.result;
    console.debug(
      `[JupyterGIS] SERVER GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
    );
  } else {
    console.debug(
      `[JupyterGIS] Processing "${processingType}" via BROWSER WASM GDAL (${gdalFunction})`,
    );
    const t0 = performance.now();
    const geoFile = new File(
      [new Blob([geojsonString], { type: 'application/geo+json' })],
      'data.geojson',
      { type: 'application/geo+json' },
    );

    const Gdal = await getGdal();
    const result = await Gdal.open(geoFile);

    if (result.datasets.length === 0) {
      return;
    }

    const dataset = result.datasets[0] as any;
    const wasmOptions = options.map(o =>
      o.replace('{outputName}', 'output.geojson'),
    );
    const outputFilePath = await Gdal[gdalFunction](dataset, wasmOptions);
    const processedBytes = await Gdal.getFileBytes(outputFilePath);
    processedGeoJSONString = new TextDecoder().decode(processedBytes);
    Gdal.close(dataset);
    console.debug(
      `[JupyterGIS] BROWSER WASM GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
    );
  }

  const layerName = `${layerNamePrefix} ${processingType.charAt(0).toUpperCase() + processingType.slice(1)}`;

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
      content: processedGeoJSONString,
    });

    const newSourceId = UUID.uuid4();
    const sourceModel: IJGISSource = {
      type: 'GeoJSONSource',
      name: outputFileName,
      parameters: {
        path: outputFileName,
      },
    };

    const layerModel: IJGISLayer = {
      type: 'VectorLayer',
      parameters: { source: newSourceId },
      visible: true,
      name: layerName,
    };

    model.sharedModel.addSource(newSourceId, sourceModel);
    model.addLayer(UUID.uuid4(), layerModel);
  } else {
    // Embed the output directly into the model
    const processedGeoJSON = JSON.parse(processedGeoJSONString);
    const newSourceId = UUID.uuid4();

    const sourceModel: IJGISSource = {
      type: 'GeoJSONSource',
      name: `${layerName} Source`,
      parameters: { data: processedGeoJSON },
    };

    const layerModel: IJGISLayer = {
      type: 'VectorLayer',
      parameters: { source: newSourceId },
      visible: true,
      name: layerName,
    };

    model.sharedModel.addSource(newSourceId, sourceModel);
    model.addLayer(UUID.uuid4(), layerModel);
  }
}
