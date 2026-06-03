import {
  IDict,
  IGeoTiffSource,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel,
  IJGISFormSchemaRegistry,
  LayerType,
  processingList,
  ProcessingType,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { Notification, showErrorMessage } from '@jupyterlab/apputils';
import { UUID } from '@lumino/coreutils';

import { ProcessingFormDialog } from './ProcessingFormDialog';
import { processingFormToParam } from './processingFormToParam';
import {
  isServerProcessingEnabled,
  ProcessingCancelledError,
  ProgressCallback,
  runServerProcessing,
  runServerProcessingUrl,
  runServerProcessingUrlWithCutline,
} from './serverProcessing';
import { getGdal } from '../../gdal';
import { getGeoJSONDataFromLayerSource } from '../../tools';
import { JupyterGISTracker } from '../../types';

/**
 * A live processing notification whose message tracks progress.
 *
 * The toast is an indeterminate "in-progress" spinner (JupyterLab's toast can't
 * render a determinate bar — it forces a spinner for the in-progress type), so
 * `onProgress` reports progress as a percentage in the message text. Server GDAL
 * raster ops emit progress in several 0→100 sweeps (warp pass, then overview
 * builds), so the percentage is clamped to be monotonic — it never goes
 * backwards, which would otherwise look like it's restarting. The browser-WASM
 * and vector-SQL paths report nothing, so the toast just spins. `attachCancel`
 * adds a Cancel button (server tasks only); `success`/`error`/`cancelled`
 * settle the toast and remove the button.
 */
interface IProcessingNotification {
  onProgress: ProgressCallback;
  attachCancel: (onCancel: () => void) => void;
  cancelled: () => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

function createProcessingNotification(label: string): IProcessingNotification {
  const id = Notification.emit(`${label}…`, 'in-progress', {
    autoClose: false,
  });
  // Highest percentage shown so far; keeps the reported progress monotonic.
  let shownPercent = 0;
  return {
    onProgress: (percent: number) => {
      if (percent <= shownPercent) {
        return;
      }
      shownPercent = percent;
      Notification.update({
        id,
        message: `${label}… ${percent}%`,
        type: 'in-progress',
        autoClose: false,
      });
    },
    attachCancel: (onCancel: () => void) => {
      Notification.update({
        id,
        type: 'in-progress',
        autoClose: false,
        actions: [
          {
            label: 'Cancel',
            callback: event => {
              // Keep the toast open so we can show the cancelling state.
              event.preventDefault();
              Notification.update({
                id,
                message: `Cancelling ${label.toLowerCase()}…`,
                type: 'in-progress',
                autoClose: false,
              });
              onCancel();
            },
          },
        ],
      });
    },
    cancelled: () => {
      Notification.update({
        id,
        message: `${label} cancelled.`,
        type: 'default',
        autoClose: 3000,
        actions: [],
      });
    },
    success: (message: string) => {
      Notification.update({
        id,
        message,
        type: 'success',
        autoClose: 3000,
        actions: [],
      });
    },
    error: (message: string) => {
      Notification.update({
        id,
        message,
        type: 'error',
        autoClose: 5000,
        actions: [],
      });
    },
  };
}

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

  const notification = createProcessingNotification('Rasterizing');

  const doRasterize = async (): Promise<Uint8Array> => {
    if (isServerProcessingEnabled()) {
      console.debug(
        `[JupyterGIS] Processing "${processingType}" via SERVER GDAL (${gdalFunction})`,
      );
      const t0 = performance.now();
      const controller = new AbortController();
      notification.attachCancel(() => controller.abort());
      const response = await runServerProcessing(
        {
          operation: gdalFunction,
          options,
          geojson: geojsonString,
          outputName,
        },
        { onProgress: notification.onProgress, signal: controller.signal },
      );
      if (response.format !== 'base64') {
        throw new Error('Expected base64 response for raster output');
      }
      const binary = atob(response.result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      console.debug(
        `[JupyterGIS] SERVER GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return bytes;
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
      const bytes = await Gdal.getFileBytes(outputFilePath);
      Gdal.close(dataset);
      console.debug(
        `[JupyterGIS] BROWSER WASM GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return bytes;
    }
  };

  let tiffBytes: Uint8Array;
  try {
    tiffBytes = await doRasterize();
  } catch (err: any) {
    if (err instanceof ProcessingCancelledError) {
      notification.cancelled();
      return;
    }
    notification.error(`${processingType} failed: ${err?.message ?? err}`);
    return;
  }
  notification.success(`${processingType} completed.`);

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

/**
 * Load raw bytes for a GeoTiffSource — handles both embedded data URLs and
 * file paths resolved relative to the .jGIS document.
 */
async function getRasterBytes(
  source: IJGISSource,
  model: IJupyterGISModel,
  app: JupyterFrontEnd,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const params = source.parameters as IGeoTiffSource;
  const url = params?.urls?.[0]?.url;
  if (!url) {
    return null;
  }

  // Embedded data URL
  if (url.startsWith('data:')) {
    const commaIdx = url.indexOf(',');
    if (commaIdx < 0) {
      return null;
    }
    const binary = atob(url.slice(commaIdx + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Remote URL — fetch directly
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `Failed to fetch raster from ${url}: ${response.statusText}`,
      );
      return null;
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  // Local file path — resolve relative to the .jGIS document
  const jgisDir = model.filePath
    ? model.filePath.substring(0, model.filePath.lastIndexOf('/'))
    : '';
  const absolutePath = jgisDir ? `${jgisDir}/${url}` : url;
  const file = await app.serviceManager.contents.get(absolutePath, {
    content: true,
    format: 'base64',
  });
  if (!file?.content) {
    return null;
  }
  const binary = atob(file.content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Clip a GeoTiff raster layer to a bounding-box extent using gdal_translate -projwin.
 */
export async function clipRasterByExtent(
  tracker: JupyterGISTracker,
  formSchemaRegistry: IJGISFormSchemaRegistry,
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

  if (!selected.parameters?.source) {
    await showErrorMessage('Clip failed', 'Selected layer has no source.');
    return;
  }
  let source = sources[selected.parameters.source];
  if (!source || source.type !== 'GeoTiffSource') {
    await showErrorMessage(
      'Clip failed',
      'Selected layer is not a GeoTiff raster layer.',
    );
    return;
  }

  let xMin: number;
  let yMin: number;
  let xMax: number;
  let yMax: number;
  let outputFileName = `${selected.name.replace(/\s+/g, '_')}_clipped.tif`;
  let embedOutputLayer = false;

  if (processingInputs) {
    xMin = processingInputs.xMin;
    yMin = processingInputs.yMin;
    xMax = processingInputs.xMax;
    yMax = processingInputs.yMax;
    outputFileName = processingInputs.outputFileName ?? outputFileName;
    embedOutputLayer = !!processingInputs.embedOutputLayer;
  } else {
    const schema = {
      ...(formSchemaRegistry.getSchemas().get('ClipRasterByExtent') as IDict),
    };
    const selectedLayerId = Object.keys(
      model.sharedModel.awareness.getLocalState()?.selected?.value || {},
    )[0];

    const formValues = await new Promise<IDict>(resolve => {
      const dialog = new ProcessingFormDialog({
        title: 'Clip Raster by Extent',
        schema,
        model,
        sourceData: {
          inputLayer: selectedLayerId,
          outputFileName,
        },
        formContext: 'create',
        processingType: 'ClipRasterByExtent',
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

    // Re-resolve selected/source in case the user changed inputLayer in the form
    const resolvedLayerId = formValues.inputLayer ?? selectedLayerId;
    if (resolvedLayerId && resolvedLayerId !== selectedLayerId) {
      const resolvedLayer = layers[resolvedLayerId];
      if (!resolvedLayer?.parameters?.source) {
        await showErrorMessage('Clip failed', 'Selected layer has no source.');
        return;
      }
      const resolvedSource = sources[resolvedLayer.parameters.source];
      if (!resolvedSource || resolvedSource.type !== 'GeoTiffSource') {
        await showErrorMessage(
          'Clip failed',
          'Selected layer is not a GeoTiff raster layer.',
        );
        return;
      }
      selected = resolvedLayer;
      source = resolvedSource;
    }

    xMin = formValues.xMin;
    yMin = formValues.yMin;
    xMax = formValues.xMax;
    yMax = formValues.yMax;
    outputFileName = formValues.outputFileName ?? outputFileName;
    embedOutputLayer = !!formValues.embedOutputLayer;
  }

  const sourceParams = source.parameters as IGeoTiffSource;
  const firstUrl = sourceParams.urls[0] as any;
  const bandMin: number = firstUrl.min ?? 0;
  const bandMax: number = firstUrl.max ?? 1;
  const nodata: string | undefined =
    firstUrl.nodata !== undefined ? String(firstUrl.nodata) : undefined;

  // gdal_translate -projwin: upper-left (xmin, ymax) → lower-right (xmax, ymin)
  // -projwin_srs EPSG:4326 tells GDAL the coordinates are in WGS84 so it
  // reprojects them to the raster's native CRS before computing the pixel window.
  const options: string[] = [
    '-of',
    'GTiff',
    '-projwin',
    String(xMin),
    String(yMax),
    String(xMax),
    String(yMin),
    '-projwin_srs',
    'EPSG:4326',
  ];
  if (nodata !== undefined) {
    options.push('-a_nodata', nodata);
  }

  const outputName = 'output.tif';
  const rasterUrl: string = firstUrl?.url ?? '';
  const isRemoteUrl =
    rasterUrl.startsWith('http://') || rasterUrl.startsWith('https://');

  const notification = createProcessingNotification('Clipping raster');

  const doClip = async (): Promise<Uint8Array<ArrayBuffer>> => {
    if (isRemoteUrl && isServerProcessingEnabled()) {
      console.debug(
        '[JupyterGIS] Clipping raster by extent via SERVER GDAL (vsicurl)',
      );
      const t0 = performance.now();
      const controller = new AbortController();
      notification.attachCancel(() => controller.abort());
      const response = await runServerProcessingUrl(
        {
          operation: 'gdal_translate',
          options,
          url: rasterUrl,
          outputName,
        },
        { onProgress: notification.onProgress, signal: controller.signal },
      );
      if (response.format !== 'base64') {
        throw new Error('Expected base64 response for raster output');
      }
      const binary = atob(response.result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      console.debug(
        `[JupyterGIS] SERVER GDAL raster clip finished in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return bytes;
    } else {
      const tiffBytes = await getRasterBytes(source, model, app);
      if (!tiffBytes) {
        throw new Error('Could not load raster data from source.');
      }

      console.debug(
        '[JupyterGIS] Clipping raster by extent via BROWSER WASM GDAL',
      );
      const t0 = performance.now();
      const Gdal = await getGdal();
      const tiffFile = new File(
        [new Blob([tiffBytes], { type: 'image/tiff' })],
        'input.tif',
        { type: 'image/tiff' },
      );
      const result = await Gdal.open(tiffFile);
      if (result.datasets.length === 0) {
        throw new Error('Failed to open raster in GDAL.');
      }
      const dataset = result.datasets[0] as any;
      const outputPath = await (Gdal as any).gdal_translate(
        dataset,
        options,
        outputName,
      );
      const bytes = new Uint8Array(await Gdal.getFileBytes(outputPath));
      Gdal.close(dataset);
      console.debug(
        `[JupyterGIS] BROWSER WASM GDAL raster clip finished in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return bytes;
    }
  };

  let outputTiffBytes: Uint8Array<ArrayBuffer>;
  try {
    outputTiffBytes = await doClip();
  } catch (err: any) {
    if (err instanceof ProcessingCancelledError) {
      notification.cancelled();
      return;
    }
    notification.error(`Raster clip failed: ${err?.message ?? err}`);
    return;
  }
  notification.success('Raster clipped successfully.');

  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(
      new Blob([outputTiffBytes as any], { type: 'image/tiff' }),
    );
  });

  let sourceUrl: string;
  if (embedOutputLayer) {
    sourceUrl = `data:image/tiff;base64,${base64Content}`;
  } else {
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
  const newSource: IJGISSource = {
    type: 'GeoTiffSource',
    name: `${selected.name} Clipped Source`,
    parameters: {
      urls: [{ url: sourceUrl, min: bandMin, max: bandMax, nodata }],
      normalize: sourceParams.normalize ?? true,
      wrapX: sourceParams.wrapX ?? false,
      interpolate: sourceParams.interpolate ?? false,
    },
  };

  const newLayer: IJGISLayer = {
    type: 'GeoTiffLayer',
    parameters: { source: newSourceId },
    visible: true,
    name: `${selected.name} Clipped`,
  };

  model.sharedModel.addSource(newSourceId, newSource);
  model.addLayer(UUID.uuid4(), newLayer);
}

/**
 * Clip a GeoTiff raster layer using a vector layer as the cutline.
 * Uses gdalwarp with -cutline (and optionally -crop_to_cutline).
 */
export async function clipRasterByVector(
  tracker: JupyterGISTracker,
  formSchemaRegistry: IJGISFormSchemaRegistry,
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
  let inputLayerId: string | undefined;
  if (processingInputs?.inputLayer) {
    inputLayerId = processingInputs.inputLayer as string;
    selected = layers[inputLayerId] ?? null;
  } else {
    selected = getSingleSelectedLayer(tracker);
    inputLayerId = Object.keys(
      model.sharedModel.awareness.getLocalState()?.selected?.value || {},
    )[0];
  }
  if (!selected) {
    return;
  }

  if (!selected.parameters?.source) {
    await showErrorMessage('Clip failed', 'Selected layer has no source.');
    return;
  }
  let source = sources[selected.parameters.source];
  if (!source || source.type !== 'GeoTiffSource') {
    await showErrorMessage(
      'Clip failed',
      'Selected layer is not a GeoTiff raster layer.',
    );
    return;
  }

  let clipLayerId: string;
  let cropToCutline = true;
  let outputFileName = `${selected.name.replace(/\s+/g, '_')}_clipped.tif`;
  let embedOutputLayer = false;

  if (processingInputs) {
    clipLayerId = processingInputs.clipLayer;
    cropToCutline = processingInputs.cropToCutline ?? true;
    outputFileName = processingInputs.outputFileName ?? outputFileName;
    embedOutputLayer = !!processingInputs.embedOutputLayer;
  } else {
    const schema = {
      ...(formSchemaRegistry.getSchemas().get('ClipRasterByVector') as IDict),
    };

    const formValues = await new Promise<IDict>(resolve => {
      const dialog = new ProcessingFormDialog({
        title: 'Clip Raster by Vector',
        schema,
        model,
        sourceData: {
          inputLayer: inputLayerId,
          outputFileName,
          cropToCutline: true,
        },
        formContext: 'create',
        processingType: 'ClipRasterByVector',
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

    // Re-resolve the selected raster if the user changed inputLayer in the form
    const resolvedLayerId = formValues.inputLayer ?? inputLayerId;
    if (resolvedLayerId && resolvedLayerId !== inputLayerId) {
      const resolvedLayer = layers[resolvedLayerId];
      if (!resolvedLayer?.parameters?.source) {
        await showErrorMessage('Clip failed', 'Selected layer has no source.');
        return;
      }
      const resolvedSource = sources[resolvedLayer.parameters.source];
      if (!resolvedSource || resolvedSource.type !== 'GeoTiffSource') {
        await showErrorMessage(
          'Clip failed',
          'Selected layer is not a GeoTiff raster layer.',
        );
        return;
      }
      selected = resolvedLayer;
      source = resolvedSource;
    }

    clipLayerId = formValues.clipLayer;
    cropToCutline = formValues.cropToCutline ?? true;
    outputFileName = formValues.outputFileName ?? outputFileName;
    embedOutputLayer = !!formValues.embedOutputLayer;
  }

  const clipLayer = layers[clipLayerId];
  if (!clipLayer) {
    await showErrorMessage('Clip failed', 'Clip layer not found.');
    return;
  }

  const clipGeoJSON = await getLayerGeoJSON(clipLayer, sources, model);
  if (!clipGeoJSON) {
    await showErrorMessage(
      'Clip failed',
      'Could not read the clip layer geometry.',
    );
    return;
  }

  const sourceParams = source.parameters as IGeoTiffSource;
  const firstUrl = sourceParams.urls[0] as any;
  const bandMin: number = firstUrl.min ?? 0;
  const bandMax: number = firstUrl.max ?? 1;
  const nodata: string | undefined =
    firstUrl.nodata !== undefined ? String(firstUrl.nodata) : undefined;

  const outputName = 'output.tif';
  const rasterUrl: string = firstUrl?.url ?? '';
  const isRemoteUrl =
    rasterUrl.startsWith('http://') || rasterUrl.startsWith('https://');

  // Cutline GeoJSON is assumed to be in EPSG:4326 (the canonical projection
  // for JupyterGIS sources). gdalwarp will reproject it to the raster's CRS
  // when -cutline_srs is provided.
  //
  // Output is written as a Cloud-Optimized GeoTIFF so the clipped layer
  // renders fast in OpenLayers via pyramid overviews instead of forcing the
  // browser to read every full-resolution strip. Multi-threaded warping
  // (-wo NUM_THREADS=ALL_CPUS, -multi) saturates available CPUs and overlaps
  // I/O with compute, which dominates runtime for /vsicurl/ COG sources.
  const buildOptions = (cutlinePath: string): string[] => {
    const opts: string[] = [
      // /vsicurl/ tuning. Defaults are tiny (16 KB chunks, 16 MB cache) which
      // forces hundreds of tiny range requests per warp. The flags below:
      //   - prefer HTTP/2 + multiplex so range requests run concurrently
      //   - merge nearby ranges into single fetches
      //   - skip directory listing / HEAD probes that S3 doesn't need
      //   - bump per-read chunk to 1 MB and the vsicurl cache to 512 MB
      // No effect for non-URL sources, all harmless.
      '--config',
      'GDAL_HTTP_VERSION',
      '2',
      '--config',
      'GDAL_HTTP_MULTIPLEX',
      'YES',
      '--config',
      'GDAL_HTTP_MERGE_CONSECUTIVE_RANGES',
      'YES',
      '--config',
      'GDAL_DISABLE_READDIR_ON_OPEN',
      'EMPTY_DIR',
      '--config',
      'CPL_VSIL_CURL_USE_HEAD',
      'NO',
      '--config',
      'CPL_VSIL_CURL_CHUNK_SIZE',
      '1048576',
      '--config',
      'CPL_VSIL_CURL_CACHE_SIZE',
      '536870912',
      // Block-level cache for decoded raster data.
      '--config',
      'GDAL_CACHEMAX',
      '1024',
      '-of',
      'COG',
      // LZW compresses faster than DEFLATE (and decompresses fast on the
      // client side too). Slightly larger output files, but the user's
      // bottleneck is wall-clock time, not disk.
      '-co',
      'COMPRESS=LZW',
      '-co',
      'BIGTIFF=IF_SAFER',
      // Parallel warp + 1 GB warp memory so each pass covers a larger output
      // area, reducing the number of /vsicurl/ round-trips.
      '-multi',
      '-wo',
      'NUM_THREADS=ALL_CPUS',
      '-wm',
      '1024',
      '-cutline',
      cutlinePath,
      '-cutline_srs',
      'EPSG:4326',
    ];
    if (cropToCutline) {
      opts.push('-crop_to_cutline');
    }
    if (nodata !== undefined) {
      opts.push('-dstnodata', nodata);
    }
    return opts;
  };

  const notification = createProcessingNotification('Clipping raster');

  const doClip = async (): Promise<Uint8Array<ArrayBuffer>> => {
    if (isRemoteUrl && isServerProcessingEnabled()) {
      // {cutlinePath} is substituted by the server with the temp path of the
      // cutline file it writes from `cutlineGeojson`.
      const controller = new AbortController();
      notification.attachCancel(() => controller.abort());
      const response = await runServerProcessingUrlWithCutline(
        {
          operation: 'gdalwarp',
          options: buildOptions('{cutlinePath}'),
          url: rasterUrl,
          cutlineGeojson: clipGeoJSON,
          outputName,
        },
        { onProgress: notification.onProgress, signal: controller.signal },
      );
      if (response.format !== 'base64') {
        throw new Error('Expected base64 response for raster output');
      }
      const binary = atob(response.result);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } else {
      const tiffBytes = await getRasterBytes(source, model, app);
      if (!tiffBytes) {
        throw new Error('Could not load raster data from source.');
      }

      console.debug(
        '[JupyterGIS] Clipping raster by vector via BROWSER WASM GDAL',
      );
      const t0 = performance.now();
      const Gdal = await getGdal();

      // Open both the raster and the cutline. gdal3.js writes each into the
      // WASM virtual filesystem; we reference the cutline by its VFS path.
      const tiffFile = new File(
        [new Blob([tiffBytes], { type: 'image/tiff' })],
        'input.tif',
        { type: 'image/tiff' },
      );
      const cutlineFile = new File(
        [new Blob([clipGeoJSON], { type: 'application/geo+json' })],
        'cutline.geojson',
        { type: 'application/geo+json' },
      );

      const rasterOpen = await Gdal.open(tiffFile);
      if (rasterOpen.datasets.length === 0) {
        throw new Error('Failed to open raster in GDAL.');
      }
      const rasterDataset = rasterOpen.datasets[0] as any;

      const cutlineOpen = await Gdal.open(cutlineFile);
      if (cutlineOpen.datasets.length === 0) {
        Gdal.close(rasterDataset);
        throw new Error('Failed to open cutline in GDAL.');
      }
      const cutlineDataset = cutlineOpen.datasets[0] as any;

      try {
        const options = buildOptions(cutlineDataset.path);
        const outputPath = await (Gdal as any).gdalwarp(
          rasterDataset,
          options,
          outputName,
        );
        const bytes = new Uint8Array(await Gdal.getFileBytes(outputPath));
        console.debug(
          `[JupyterGIS] BROWSER WASM GDAL raster clip-by-vector finished in ${(performance.now() - t0).toFixed(0)}ms`,
        );
        return bytes;
      } finally {
        Gdal.close(rasterDataset);
        Gdal.close(cutlineDataset);
      }
    }
  };

  let outputTiffBytes: Uint8Array<ArrayBuffer>;
  try {
    outputTiffBytes = await doClip();
  } catch (err: any) {
    if (err instanceof ProcessingCancelledError) {
      notification.cancelled();
      return;
    }
    notification.error(`Raster clip failed: ${err?.message ?? err}`);
    return;
  }
  notification.success('Raster clipped successfully.');

  const base64Content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(
      new Blob([outputTiffBytes as any], { type: 'image/tiff' }),
    );
  });

  let sourceUrl: string;
  if (embedOutputLayer) {
    sourceUrl = `data:image/tiff;base64,${base64Content}`;
  } else {
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
  const newSource: IJGISSource = {
    type: 'GeoTiffSource',
    name: `${selected.name} Clipped Source`,
    parameters: {
      urls: [{ url: sourceUrl, min: bandMin, max: bandMax, nodata }],
      normalize: sourceParams.normalize ?? true,
      wrapX: sourceParams.wrapX ?? false,
      interpolate: sourceParams.interpolate ?? false,
    },
  };

  const newLayer: IJGISLayer = {
    type: 'GeoTiffLayer',
    parameters: { source: newSourceId },
    visible: true,
    name: `${selected.name} Clipped`,
  };

  model.sharedModel.addSource(newSourceId, newSource);
  model.addLayer(UUID.uuid4(), newLayer);
}

/**
 * Compute the WKT of the union of all features in a GeoJSON string using WASM GDAL.
 */
async function computeUnionWkt(geojsonString: string): Promise<string | null> {
  const Gdal = await getGdal();
  const file = new File(
    [new Blob([geojsonString], { type: 'application/geo+json' })],
    'clip_data.geojson',
    { type: 'application/geo+json' },
  );
  const result = await Gdal.open(file);
  if (result.datasets.length === 0) {
    return null;
  }
  const dataset = result.datasets[0] as any;
  const layerName = dataset.info.layers[0].name;
  const options = [
    '-f',
    'CSV',
    '-dialect',
    'SQLITE',
    '-sql',
    `SELECT ST_AsText(ST_Union(geometry)) AS wkt FROM "${layerName}"`,
    'clip_union.csv',
  ];
  const outputPath = await (Gdal as any).ogr2ogr(dataset, options);
  const bytes = await Gdal.getFileBytes(outputPath);
  Gdal.close(dataset);
  const csv = new TextDecoder().decode(bytes);
  const lines = csv.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) {
    return null;
  }
  // ogr2ogr CSV wraps fields containing commas in double-quotes; strip them
  let wkt = lines[1].trim();
  if (wkt.startsWith('"') && wkt.endsWith('"')) {
    wkt = wkt.slice(1, -1).replace(/""/g, '"');
  }
  return wkt || null;
}

/**
 * Clip a vector layer by another vector layer using ST_Intersection.
 */
export async function clipVectorByMaskLayer(
  tracker: JupyterGISTracker,
  formSchemaRegistry: IJGISFormSchemaRegistry,
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
  let inputLayerId: string | undefined;
  if (processingInputs?.inputLayer) {
    inputLayerId = processingInputs.inputLayer as string;
    selected = layers[inputLayerId] ?? null;
  } else {
    selected = getSingleSelectedLayer(tracker);
    inputLayerId = Object.keys(
      model.sharedModel.awareness.getLocalState()?.selected?.value || {},
    )[0];
  }
  if (!selected) {
    return;
  }

  const inputGeoJSON = await getLayerGeoJSON(selected, sources, model);
  if (!inputGeoJSON) {
    return;
  }

  let clipLayerId: string;
  let embedOutputLayer = true;
  let outputLayerName = `${selected.name} Clipped`;

  if (processingInputs) {
    clipLayerId = processingInputs.clipLayer;
    embedOutputLayer = processingInputs.embedOutputLayer ?? true;
    outputLayerName =
      processingInputs.outputLayerName ?? `${selected.name} Clipped`;
  } else {
    const schema = {
      ...(formSchemaRegistry
        .getSchemas()
        .get('ClipVectorByMaskLayer') as IDict),
    };
    const formValues = await new Promise<IDict>(resolve => {
      const dialog = new ProcessingFormDialog({
        title: 'Clip',
        schema,
        model,
        sourceData: {
          inputLayer: inputLayerId,
          outputLayerName: `${selected.name} Clipped`,
        },
        formContext: 'create',
        processingType: 'ClipVectorByMaskLayer',
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

    clipLayerId = formValues.clipLayer;
    embedOutputLayer = formValues.embedOutputLayer;
    outputLayerName = formValues.outputLayerName;
  }

  if (clipLayerId === inputLayerId) {
    await showErrorMessage(
      'Clip failed',
      'The clip layer and input layer must be different.',
    );
    return;
  }

  const clipLayer = layers[clipLayerId];
  if (!clipLayer) {
    await showErrorMessage('Clip failed', 'Clip layer not found.');
    return;
  }

  const clipGeoJSON = await getLayerGeoJSON(clipLayer, sources, model);
  if (!clipGeoJSON) {
    await showErrorMessage(
      'Clip failed',
      'Could not read the clip layer geometry.',
    );
    return;
  }

  const clipWkt = await computeUnionWkt(clipGeoJSON);
  if (!clipWkt) {
    await showErrorMessage(
      'Clip failed',
      'Could not compute clip boundary geometry. The clip layer may be empty.',
    );
    return;
  }

  const Gdal = await getGdal();
  const inputFile = new File(
    [new Blob([inputGeoJSON], { type: 'application/geo+json' })],
    'data.geojson',
    { type: 'application/geo+json' },
  );
  const openResult = await Gdal.open(inputFile);
  const dataset = openResult.datasets[0] as any;
  const inputLayerName = dataset.info.layers[0].name;
  Gdal.close(dataset);

  const escapedWkt = clipWkt.replace(/'/g, "''");
  const sql = `SELECT ST_Intersection(geometry, ST_GeomFromText('${escapedWkt}')) AS geometry, * FROM "${inputLayerName}" WHERE ST_Intersects(geometry, ST_GeomFromText('${escapedWkt}'))`;
  const options = [
    '-f',
    'GeoJSON',
    '-dialect',
    'SQLITE',
    '-sql',
    sql,
    '{outputName}',
  ];

  await executeSQLProcessing(
    model,
    inputGeoJSON,
    'ogr2ogr',
    options,
    outputLayerName,
    'ClipVectorByMaskLayer',
    embedOutputLayer,
    tracker,
    app,
    outputLayerName,
  );
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
  exactLayerName?: string,
) {
  const notification = createProcessingNotification(`Running ${processingType}`);

  const doProcessing = async (): Promise<string> => {
    if (isServerProcessingEnabled()) {
      console.debug(
        `[JupyterGIS] Processing "${processingType}" via SERVER GDAL (${gdalFunction})`,
      );
      const t0 = performance.now();
      const outputName = 'output.geojson';
      const controller = new AbortController();
      notification.attachCancel(() => controller.abort());
      const response = await runServerProcessing(
        {
          operation: gdalFunction,
          options,
          geojson: geojsonString,
          outputName,
        },
        { onProgress: notification.onProgress, signal: controller.signal },
      );
      console.debug(
        `[JupyterGIS] SERVER GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return response.result;
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
        throw new Error('Could not open layer in GDAL.');
      }

      const dataset = result.datasets[0] as any;
      const wasmOptions = options.map(o =>
        o.replace('{outputName}', 'output.geojson'),
      );
      const outputFilePath = await Gdal[gdalFunction](dataset, wasmOptions);
      const processedBytes = await Gdal.getFileBytes(outputFilePath);
      const output = new TextDecoder().decode(processedBytes);
      Gdal.close(dataset);
      console.debug(
        `[JupyterGIS] BROWSER WASM GDAL "${processingType}" finished in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return output;
    }
  };

  let processedGeoJSONString: string;
  try {
    processedGeoJSONString = await doProcessing();
  } catch (err: any) {
    if (err instanceof ProcessingCancelledError) {
      notification.cancelled();
      return;
    }
    notification.error(`${processingType} failed: ${err?.message ?? err}`);
    return;
  }
  notification.success(`${processingType} completed.`);

  const layerName =
    exactLayerName ??
    `${layerNamePrefix} ${processingType.charAt(0).toUpperCase() + processingType.slice(1)}`;

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
