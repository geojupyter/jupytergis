import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayerBrowserRegistry,
  IJGISLayerGroup,
  IJGISLayerItem,
  IJupyterGISModel,
  LayerType,
  SelectionType,
  SourceType
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { IStateDB } from '@jupyterlab/statedb';
import { ITranslator } from '@jupyterlab/translation';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { CommandIDs, icons } from './constants';
import { CreationFormDialog } from './dialogs/formdialog';
import { LayerBrowserWidget } from './dialogs/layerBrowserDialog';
import { SymbologyWidget } from './dialogs/symbology/symbologyDialog';
import keybindings from './keybindings.json';
import { JupyterGISTracker } from './types';
import { JupyterGISDocumentWidget } from './widget';
import { getGdal } from './gdal';
import { getGeoJSONDataFromLayerSource, downloadFile } from './tools';
import { IJGISLayer, IJGISSource } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { FormDialog } from './formbuilder/formdialog';

interface ICreateEntry {
  tracker: JupyterGISTracker;
  formSchemaRegistry: IJGISFormSchemaRegistry;
  title: string;
  createLayer: boolean;
  createSource: boolean;
  sourceData?: IDict;
  layerData?: IDict;
  sourceType: SourceType;
  layerType?: LayerType;
}

function loadKeybindings(commands: CommandRegistry, keybindings: any[]) {
  keybindings.forEach(binding => {
    commands.addKeyBinding({
      command: binding.command,
      keys: binding.keys,
      selector: binding.selector
    });
  });
}

/**
 * Get the currently selected layer from the shared model. Returns null if there is no selection or multiple layer is selected.
 */
function getSingleSelectedLayer(tracker: JupyterGISTracker): IJGISLayer | null {
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
 * Add the commands to the application's command registry.
 */
export function addCommands(
  app: JupyterFrontEnd,
  tracker: JupyterGISTracker,
  translator: ITranslator,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  layerBrowserRegistry: IJGISLayerBrowserRegistry,
  state: IStateDB,
  completionProviderManager: ICompletionProviderManager | undefined
): void {
  const trans = translator.load('jupyterlab');
  const { commands } = app;

  commands.addCommand(CommandIDs.symbology, {
    label: trans.__('Edit Symbology'),
    isEnabled: () => {
      const model = tracker.currentWidget?.model;
      const localState = model?.sharedModel.awareness.getLocalState();

      if (!model || !localState || !localState['selected']?.value) {
        return false;
      }

      const selectedLayers = localState['selected'].value;

      // Can't open more than one symbology dialog at once
      if (Object.keys(selectedLayers).length > 1) {
        return false;
      }

      const layerId = Object.keys(selectedLayers)[0];
      const layer = model.getLayer(layerId);

      if (!layer) {
        return false;
      }

      const isValidLayer = [
        'VectorLayer',
        'VectorTileLayer',
        'WebGlLayer',
        'HeatmapLayer'
      ].includes(layer.type);

      return isValidLayer;
    },
    execute: Private.createSymbologyDialog(tracker, state),

    ...icons.get(CommandIDs.symbology)
  });

  commands.addCommand(CommandIDs.redo, {
    label: trans.__('Redo'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: () => {
      const current = tracker.currentWidget;

      if (current) {
        return current.model.sharedModel.redo();
      }
    },
    ...icons.get(CommandIDs.redo)?.icon
  });

  commands.addCommand(CommandIDs.undo, {
    label: trans.__('Undo'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: () => {
      const current = tracker.currentWidget;

      if (current) {
        return current.model.sharedModel.undo();
      }
    },
    ...icons.get(CommandIDs.undo)
  });

  commands.addCommand(CommandIDs.identify, {
    label: trans.__('Identify'),
    isToggled: () => {
      return tracker.currentWidget?.model.isIdentifying || false;
    },
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: args => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      const luminoEvent = args['_luminoEvent'] as
        | ReadonlyPartialJSONObject
        | undefined;

      if (luminoEvent) {
        const keysPressed = luminoEvent.keys as string[] | undefined;
        if (keysPressed?.includes('Escape')) {
          current.model.isIdentifying = false;
          current.node.classList.remove('jGIS-identify-tool');
          commands.notifyCommandChanged(CommandIDs.identify);
          return;
        }
      }

      current.node.classList.toggle('jGIS-identify-tool');
      current.model.toggleIdentify();
      commands.notifyCommandChanged(CommandIDs.identify);
    },
    ...icons.get(CommandIDs.identify)
  });

  commands.addCommand(CommandIDs.temporalController, {
    label: trans.__('Temporal Controller'),
    isToggled: () => {
      return tracker.currentWidget?.model.isTemporalControllerActive || false;
    },
    isEnabled: () => {
      const model = tracker.currentWidget?.model;
      if (!model) {
        return false;
      }

      const selectedLayers = model.localState?.selected?.value;
      if (!selectedLayers) {
        return false;
      }

      const layerId = Object.keys(selectedLayers)[0];
      const layerType = model.getLayer(layerId)?.type;
      if (!layerType) {
        return false;
      }

      // Selection should only be one vector or heatmap layer
      const isSelectionValid =
        Object.keys(selectedLayers).length === 1 &&
        !model.getSource(layerId) &&
        ['VectorLayer', 'HeatmapLayer'].includes(layerType);

      if (!isSelectionValid && model.isTemporalControllerActive) {
        model.toggleTemporalController();
        commands.notifyCommandChanged(CommandIDs.temporalController);

        return false;
      }

      return true;
    },
    execute: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      current.model.toggleTemporalController();
      commands.notifyCommandChanged(CommandIDs.temporalController);
    },
    ...icons.get(CommandIDs.temporalController)
  });

  /**
   * SOURCES and LAYERS creation commands.
   */
  commands.addCommand(CommandIDs.openLayerBrowser, {
    label: trans.__('Open Layer Browser'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createLayerBrowser(
      tracker,
      layerBrowserRegistry,
      formSchemaRegistry
    ),
    ...icons.get(CommandIDs.openLayerBrowser)
  });

  /**
   * Source and layers
   */
  commands.addCommand(CommandIDs.newRasterEntry, {
    label: trans.__('New Raster Layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Raster Layer',
      createLayer: true,
      createSource: true,
      sourceData: {
        minZoom: 0,
        maxZoom: 24
      },
      layerData: { name: 'Custom Raster Layer' },
      sourceType: 'RasterSource',
      layerType: 'RasterLayer'
    }),
    ...icons.get(CommandIDs.newRasterEntry)
  });

  commands.addCommand(CommandIDs.newVectorTileEntry, {
    label: trans.__('New Vector Tile Layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Vector Tile Layer',
      createLayer: true,
      createSource: true,
      sourceData: { minZoom: 0, maxZoom: 24 },
      layerData: { name: 'Custom Vector Tile Layer' },
      sourceType: 'VectorTileSource',
      layerType: 'VectorTileLayer'
    }),
    ...icons.get(CommandIDs.newVectorTileEntry)
  });

  commands.addCommand(CommandIDs.buffer, {
    label: trans.__('Buffer'),
    isEnabled: () => {
      const selectedLayer = getSingleSelectedLayer(tracker);
      if (!selectedLayer) {
        return false;
      }
      return ['VectorLayer', 'ShapefileLayer'].includes(selectedLayer.type);
    },
    execute: async () => {
      const selected = getSingleSelectedLayer(tracker);
      if (!selected) {
        console.error('No valid selected layer.');
        return;
      }
      const layers = tracker.currentWidget?.model.sharedModel.layers ?? {};
      const sources = tracker.currentWidget?.model.sharedModel.sources ?? {};

      const schema = {
        ...(formSchemaRegistry.getSchemas().get('Buffer') as IDict)
      };

      const model = tracker.currentWidget?.model;
      const localState = model?.sharedModel.awareness.getLocalState();
      if (!model || !localState || !localState['selected']?.value) {
        return;
      }
      const selectedLayer = localState['selected'].value;
      const selectedLayerId = Object.keys(selectedLayer)[0];

      // Open form and get user input
      const formValues = await new Promise<IDict>(resolve => {
        const dialog = new FormDialog({
          title: 'Buffer',
          schema: schema,
          model: model,
          sourceData: {
            inputLayer: selectedLayerId,
            bufferDistance: 10,
            projection: 'EPSG:4326'
          },
          cancelButton: false,
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

      const bufferDistance = formValues.bufferDistance;
      const inputLayerId = formValues.inputLayer;
      const inputLayer = layers[inputLayerId];

      if (!inputLayer.parameters) {
        console.error('Selected layer not found.');
        return;
      }

      const sourceId = inputLayer.parameters.source;
      const source = sources[sourceId];

      if (!source || !source.parameters) {
        console.error(`Source with ID ${sourceId} not found or missing path.`);
        return;
      }

      const geojsonString = await getGeoJSONDataFromLayerSource(source, model);
      if (!geojsonString) {
        return;
      }

      const fileBlob = new Blob([geojsonString], {
        type: 'application/geo+json'
      });
      const geoFile = new File([fileBlob], 'data.geojson', {
        type: 'application/geo+json'
      });

      const Gdal = await getGdal();
      const result = await Gdal.open(geoFile);

      if (result.datasets.length > 0) {
        const dataset = result.datasets[0] as any;
        const layerName = dataset.info.layers[0].name;

        const sqlQuery = `
          SELECT ST_Union(ST_Buffer(geometry, ${bufferDistance})) AS geometry, *
          FROM "${layerName}"
        `;

        const options = [
          '-f',
          'GeoJSON',
          '-t_srs',
          formValues.projection,
          '-dialect',
          'SQLITE',
          '-sql',
          sqlQuery,
          'output.geojson'
        ];

        const outputFilePath = await Gdal.ogr2ogr(dataset, options);
        const bufferedBytes = await Gdal.getFileBytes(outputFilePath);
        const bufferedGeoJSONString = new TextDecoder().decode(bufferedBytes);
        Gdal.close(dataset);

        const bufferedGeoJSON = JSON.parse(bufferedGeoJSONString);

        // Store in shared model
        const newSourceId = UUID.uuid4();
        const sourceModel: IJGISSource = {
          type: 'GeoJSONSource',
          name: inputLayer.name + ' Buffer',
          parameters: { data: bufferedGeoJSON }
        };

        const layerModel: IJGISLayer = {
          type: 'VectorLayer',
          parameters: { source: newSourceId },
          visible: true,
          name: inputLayer.name + ' Buffer'
        };

        model.sharedModel.addSource(newSourceId, sourceModel);
        model.addLayer(UUID.uuid4(), layerModel);
      }
    }
  });

  commands.addCommand(CommandIDs.dissolve, {
    label: trans.__('Dissolve'),
    isEnabled: () => {
      const selectedLayer = getSingleSelectedLayer(tracker);
      if (!selectedLayer) {
        return false;
      }
      return ['VectorLayer', 'ShapefileLayer'].includes(selectedLayer.type);
    },
    execute: async () => {
      const selected = getSingleSelectedLayer(tracker);
      if (!selected) {
        console.error('No valid selected layer.');
        return;
      }

      const sources = tracker.currentWidget?.model.sharedModel.sources ?? {};
      const model = tracker.currentWidget?.model;
      const localState = model?.sharedModel.awareness.getLocalState();

      if (!model || !localState || !localState['selected']?.value || !selected.parameters) {
        return;
      }


      const sourceId = selected.parameters.source;
      const source = sources[sourceId];

      if (!source || !source.parameters) {
        console.error(`Source with ID ${sourceId} not found or missing path.`);
        return;
      }

      // Load GeoJSON data
      const geojsonString = await getGeoJSONDataFromLayerSource(source, model);
      if (!geojsonString) {
        return;
      }

      const geojson = JSON.parse(geojsonString);
      if (!geojson.features || geojson.features.length === 0) {
        console.error('Invalid GeoJSON: No features found.');
        return;
      }

      // Extract field names from the first feature's properties
      const properties = geojson.features[0].properties;
      const fieldNames = Object.keys(properties);

      if (fieldNames.length === 0) {
        console.error('No attribute fields found in GeoJSON.');
        return;
      }

      // Retrieve dissolve schema and update fields dynamically
      const schema = {
        ...(formSchemaRegistry.getSchemas().get('Dissolve') as IDict),
        properties: {
          ...formSchemaRegistry.getSchemas().get('Dissolve')?.properties,
          dissolveField: {
            type: 'string',
            enum: fieldNames, // Populate dropdown with field names
            description: 'Select the field for dissolving features.'
          }
        }
      };

      const selectedLayer = localState['selected'].value;
      const selectedLayerId = Object.keys(selectedLayer)[0];

      // Open form and get user input
      const formValues = await new Promise<IDict>(resolve => {
        const dialog = new FormDialog({
          title: 'Dissolve',
          schema: schema,
          model: model,
          sourceData: {
            inputLayer: selectedLayerId,
            dissolveField: fieldNames[0] // Default to the first field
          },
          cancelButton: false,
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

      const dissolveField = formValues.dissolveField;
      const fileBlob = new Blob([geojsonString], {
        type: 'application/geo+json'
      });
      const geoFile = new File([fileBlob], 'data.geojson', {
        type: 'application/geo+json'
      });

      const Gdal = await getGdal();
      const result = await Gdal.open(geoFile);

      if (result.datasets.length > 0) {
        const dataset = result.datasets[0] as any;
        const layerName = dataset.info.layers[0].name;

        const sqlQuery = `
          SELECT ST_Union(geometry) AS geometry, ${dissolveField}
          FROM ${layerName}
          GROUP BY ${dissolveField}
        `;

        const options = [
          '-f',
          'GeoJSON',
          '-nlt',
          'PROMOTE_TO_MULTI',
          '-dialect',
          'sqlite',
          '-sql',
          sqlQuery,
          'output.geojson'
        ];

        const outputFilePath = await Gdal.ogr2ogr(dataset, options);
        const dissolvedBytes = await Gdal.getFileBytes(outputFilePath);
        const dissolvedGeoJSONString = new TextDecoder().decode(dissolvedBytes);
        Gdal.close(dataset);

        const dissolvedGeoJSON = JSON.parse(dissolvedGeoJSONString);

        const newSourceId = UUID.uuid4();
        const sourceModel: IJGISSource = {
          type: 'GeoJSONSource',
          name: selected.name + ' Dissolved',
          parameters: { data: dissolvedGeoJSON }
        };

        const layerModel: IJGISLayer = {
          type: 'VectorLayer',
          parameters: { source: newSourceId },
          visible: true,
          name: selected.name + ' Dissolved'
        };

        model.sharedModel.addSource(newSourceId, sourceModel);
        model.addLayer(UUID.uuid4(), layerModel);
      }
    }
  });

  commands.addCommand(CommandIDs.newGeoJSONEntry, {
    label: trans.__('New GeoJSON layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create GeoJSON Layer',
      createLayer: true,
      createSource: true,
      layerData: { name: 'Custom GeoJSON Layer' },
      sourceType: 'GeoJSONSource',
      layerType: 'VectorLayer'
    }),
    ...icons.get(CommandIDs.newGeoJSONEntry)
  });

  commands.addCommand(CommandIDs.newHillshadeEntry, {
    label: trans.__('New Hillshade layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Hillshade Layer',
      createLayer: true,
      createSource: true,
      layerData: { name: 'Custom Hillshade Layer' },
      sourceType: 'RasterDemSource',
      layerType: 'HillshadeLayer'
    }),
    ...icons.get(CommandIDs.newHillshadeEntry)
  });

  commands.addCommand(CommandIDs.newImageEntry, {
    label: trans.__('New Image layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Image Layer',
      createLayer: true,
      createSource: true,
      sourceData: {
        name: 'Custom Image Source',
        path: 'https://maplibre.org/maplibre-gl-js/docs/assets/radar.gif',
        coordinates: [
          [-80.425, 46.437],
          [-71.516, 46.437],
          [-71.516, 37.936],
          [-80.425, 37.936]
        ]
      },
      layerData: { name: 'Custom Image Layer' },
      sourceType: 'ImageSource',
      layerType: 'ImageLayer'
    }),
    ...icons.get(CommandIDs.newImageEntry)
  });

  commands.addCommand(CommandIDs.newVideoEntry, {
    label: trans.__('New Video layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Video Layer',
      createLayer: true,
      createSource: true,
      sourceData: {
        name: 'Custom Video Source',
        urls: [
          'https://static-assets.mapbox.com/mapbox-gl-js/drone.mp4',
          'https://static-assets.mapbox.com/mapbox-gl-js/drone.webm'
        ],
        coordinates: [
          [-122.51596391201019, 37.56238816766053],
          [-122.51467645168304, 37.56410183312965],
          [-122.51309394836426, 37.563391708549425],
          [-122.51423120498657, 37.56161849366671]
        ]
      },
      layerData: { name: 'Custom Video Layer' },
      sourceType: 'VideoSource',
      layerType: 'RasterLayer'
    }),
    ...icons.get(CommandIDs.newVideoEntry)
  });

  commands.addCommand(CommandIDs.newShapefileSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Shapefile')
        : trans.__('Add Shapefile Source'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Shapefile Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom Shapefile Source' },
      sourceType: 'ShapefileSource'
    }),
    ...icons.get(CommandIDs.newShapefileSource)
  });

  commands.addCommand(CommandIDs.newGeoTiffEntry, {
    label: trans.__('New GeoTiff layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create GeoTiff Layer',
      createLayer: true,
      createSource: true,
      sourceData: {
        name: 'Custom GeoTiff Source',
        urls: [{}]
      },
      layerData: { name: 'Custom GeoTiff Layer' },
      sourceType: 'GeoTiffSource',
      layerType: 'WebGlLayer'
    }),
    ...icons.get(CommandIDs.newGeoTiffEntry)
  });

  /**
   * SOURCES only commands.
   */
  commands.addCommand(CommandIDs.newRasterSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Raster')
        : trans.__('New Raster Source'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Raster Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom Raster Source', minZoom: 0, maxZoom: 24 },
      sourceType: 'RasterSource'
    }),
    ...icons.get(CommandIDs.newRasterSource)
  });

  commands.addCommand(CommandIDs.newRasterDemSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Raster DEM')
        : trans.__('New Raster DEM Source'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Raster Dem Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom Raster DEM Source' },
      sourceType: 'RasterDemSource'
    }),
    ...icons.get(CommandIDs.newRasterDemSource)
  });

  commands.addCommand(CommandIDs.newVectorSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Vector')
        : trans.__('New Vector Source'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Vector Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom Vector Source', minZoom: 0, maxZoom: 24 },
      sourceType: 'VectorTileSource'
    }),
    ...icons.get(CommandIDs.newVectorSource)
  });

  commands.addCommand(CommandIDs.newGeoJSONSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('GeoJSON')
        : trans.__('Add GeoJSON data from file'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create GeoJson Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom GeoJSON Source' },
      sourceType: 'GeoJSONSource'
    }),
    ...icons.get(CommandIDs.newGeoJSONSource)
  });

  commands.addCommand(CommandIDs.newImageSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Image')
        : trans.__('Add Image Source'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Image Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom Image Source' },
      sourceType: 'ImageSource'
    }),
    ...icons.get(CommandIDs.newImageSource)
  });

  commands.addCommand(CommandIDs.newVideoSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Video')
        : trans.__('Add Video Source'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Video Source',
      createLayer: false,
      createSource: true,
      sourceData: { name: 'Custom Video Source' },
      sourceType: 'VideoSource'
    }),
    ...icons.get(CommandIDs.newVideoSource)
  });

  // Layers only
  commands.addCommand(CommandIDs.newRasterLayer, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Raster')
        : trans.__('Add Raster layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Raster Layer',
      createLayer: true,
      createSource: false,
      layerData: {
        name: 'Custom Raster Layer'
      },
      sourceType: 'RasterSource',
      layerType: 'RasterLayer'
    }),
    ...icons.get(CommandIDs.newVectorLayer)
  });

  commands.addCommand(CommandIDs.newVectorLayer, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Vector')
        : trans.__('Add New Vector layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Vector Layer',
      createLayer: true,
      createSource: false,
      layerData: {
        name: 'Custom Vector Layer'
      },
      sourceType: 'VectorTileSource',
      layerType: 'VectorTileLayer'
    }),
    ...icons.get(CommandIDs.newVectorLayer)
  });

  commands.addCommand(CommandIDs.newHillshadeLayer, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Hillshade')
        : trans.__('Add Hillshade layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Hillshade Layer',
      createLayer: true,
      createSource: false,
      layerData: {
        name: 'Custom Hillshade Layer'
      },
      sourceType: 'RasterDemSource',
      layerType: 'HillshadeLayer'
    }),
    ...icons.get(CommandIDs.newHillshadeLayer)
  });

  commands.addCommand(CommandIDs.newImageLayer, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Image')
        : trans.__('Add Image layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Image Layer',
      createLayer: true,
      createSource: false,
      layerData: {
        name: 'Custom Image Layer'
      },
      sourceType: 'ImageSource',
      layerType: 'RasterLayer'
    }),
    ...icons.get(CommandIDs.newImageLayer)
  });

  commands.addCommand(CommandIDs.newVideoLayer, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Video')
        : trans.__('Add Video layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Video Layer',
      createLayer: true,
      createSource: false,
      layerData: {
        name: 'Custom Video Layer'
      },
      sourceType: 'VideoSource',
      layerType: 'RasterLayer'
    }),
    ...icons.get(CommandIDs.newVideoLayer)
  });

  commands.addCommand(CommandIDs.newShapefileLayer, {
    label: trans.__('New Shapefile Layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Shapefile Layer',
      createLayer: true,
      createSource: true,
      sourceData: { name: 'Custom Shapefile Source' },
      layerData: { name: 'Custom Shapefile Layer' },
      sourceType: 'ShapefileSource',
      layerType: 'VectorLayer'
    }),
    ...icons.get(CommandIDs.newShapefileLayer)
  });

  commands.addCommand(CommandIDs.newHeatmapLayer, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('Heatmap')
        : trans.__('Add HeatmapLayer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Heatmap Layer',
      createLayer: true,
      createSource: false,
      layerData: { name: 'Custom Heatmap Layer' },
      sourceType: 'GeoJSONSource',
      layerType: 'HeatmapLayer'
    }),
    ...icons.get(CommandIDs.newHeatmapLayer)
  });

  /**
   * LAYERS and LAYER GROUP actions.
   */
  commands.addCommand(CommandIDs.renameLayer, {
    label: trans.__('Rename Layer'),
    execute: async () => {
      const model = tracker.currentWidget?.model;
      await Private.renameSelectedItem(model, 'layer', (layerId, newName) => {
        const layer = model?.getLayer(layerId);
        if (layer) {
          layer.name = newName;
          model?.sharedModel.updateLayer(layerId, layer);
        }
      });
    }
  });

  commands.addCommand(CommandIDs.removeLayer, {
    label: trans.__('Remove Layer'),
    execute: () => {
      const model = tracker.currentWidget?.model;
      Private.removeSelectedItems(model, 'layer', selection => {
        model?.removeLayer(selection);
      });
    }
  });

  commands.addCommand(CommandIDs.renameGroup, {
    label: trans.__('Rename Group'),
    execute: async () => {
      const model = tracker.currentWidget?.model;
      await Private.renameSelectedItem(model, 'group', (groupName, newName) => {
        model?.renameLayerGroup(groupName, newName);
      });
    }
  });

  commands.addCommand(CommandIDs.removeGroup, {
    label: trans.__('Remove Group'),
    execute: async () => {
      const model = tracker.currentWidget?.model;
      Private.removeSelectedItems(model, 'group', selection => {
        model?.removeLayerGroup(selection);
      });
    }
  });

  commands.addCommand(CommandIDs.moveLayersToGroup, {
    label: args =>
      args['label'] ? (args['label'] as string) : trans.__('Move to Root'),
    execute: args => {
      const model = tracker.currentWidget?.model;
      const groupName = args['label'] as string;

      const selectedLayers = model?.localState?.selected?.value;

      if (!selectedLayers) {
        return;
      }

      model.moveItemsToGroup(Object.keys(selectedLayers), groupName);
    }
  });

  commands.addCommand(CommandIDs.moveLayerToNewGroup, {
    label: trans.__('Move Selected Layers to New Group'),
    execute: async () => {
      const model = tracker.currentWidget?.model;
      const selectedLayers = model?.localState?.selected?.value;

      if (!selectedLayers) {
        return;
      }

      function newGroupName() {
        const input = document.createElement('input');
        input.classList.add('jp-gis-left-panel-input');
        input.style.marginLeft = '26px';
        const panel = document.getElementById('jp-gis-layer-tree');
        if (!panel) {
          return;
        }

        panel.appendChild(input);
        input.focus();

        return new Promise<string>(resolve => {
          input.addEventListener('blur', () => {
            panel.removeChild(input);
            resolve(input.value);
          });

          input.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
              event.stopPropagation();
              event.preventDefault();
              input.blur();
            } else if (event.key === 'Escape') {
              event.stopPropagation();
              event.preventDefault();
              input.blur();
            }
          });
        });
      }

      const newName = await newGroupName();
      if (!newName) {
        console.warn('New name cannot be empty');
        return;
      }

      const layers: IJGISLayerItem[] = [];

      Object.keys(selectedLayers).forEach(key => {
        layers.push(key);
      });

      const newLayerGroup: IJGISLayerGroup = {
        name: newName,
        layers: layers
      };

      model.addNewLayerGroup(selectedLayers, newLayerGroup);
    }
  });

  /**
   * Source actions
   */
  commands.addCommand(CommandIDs.renameSource, {
    label: trans.__('Rename Source'),
    execute: async () => {
      const model = tracker.currentWidget?.model;
      await Private.renameSelectedItem(model, 'source', (sourceId, newName) => {
        const source = model?.getSource(sourceId);
        if (source) {
          source.name = newName;
          model?.sharedModel.updateSource(sourceId, source);
        }
      });
    }
  });

  commands.addCommand(CommandIDs.removeSource, {
    label: trans.__('Remove Source'),
    execute: () => {
      const model = tracker.currentWidget?.model;
      Private.removeSelectedItems(model, 'source', selection => {
        if (!(model?.getLayersBySource(selection).length ?? true)) {
          model?.sharedModel.removeSource(selection);
        } else {
          showErrorMessage(
            'Remove source error',
            'The source is used by a layer.'
          );
        }
      });
    }
  });

  // Console commands
  commands.addCommand(CommandIDs.toggleConsole, {
    label: trans.__('Toggle console'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: async () => await Private.toggleConsole(tracker)
  });
  commands.addCommand(CommandIDs.executeConsole, {
    label: trans.__('Execute console'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: () => Private.executeConsole(tracker)
  });
  commands.addCommand(CommandIDs.removeConsole, {
    label: trans.__('Remove console'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: () => Private.removeConsole(tracker)
  });

  commands.addCommand(CommandIDs.invokeCompleter, {
    label: trans.__('Display the completion helper.'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    execute: () => {
      const currentWidget = tracker.currentWidget;
      if (
        !currentWidget ||
        !completionProviderManager ||
        !(currentWidget instanceof JupyterGISDocumentWidget)
      ) {
        return;
      }
      const id = currentWidget.content.consolePanel?.id;
      if (id) {
        return completionProviderManager.invoke(id);
      }
    }
  });

  commands.addCommand(CommandIDs.selectCompleter, {
    label: trans.__('Select the completion suggestion.'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    execute: () => {
      const currentWidget = tracker.currentWidget;
      if (
        !currentWidget ||
        !completionProviderManager ||
        !(currentWidget instanceof JupyterGISDocumentWidget)
      ) {
        return;
      }
      const id = currentWidget.content.consolePanel?.id;
      if (id) {
        return completionProviderManager.select(id);
      }
    }
  });

  commands.addCommand(CommandIDs.zoomToLayer, {
    label: trans.__('Zoom to Layer'),
    execute: () => {
      const currentWidget = tracker.currentWidget;
      if (!currentWidget || !completionProviderManager) {
        return;
      }
      console.log('zooming');
      const model = tracker.currentWidget.model;
      const selectedItems = model.localState?.selected.value;

      if (!selectedItems) {
        return;
      }

      const layerId = Object.keys(selectedItems)[0];
      model.centerOnPosition(layerId);
    }
  });

  commands.addCommand(CommandIDs.downloadGeoJSON, {
    label: trans.__('Download as GeoJSON'),
    isEnabled: () => {
      const selectedLayer = getSingleSelectedLayer(tracker);
      return selectedLayer
        ? ['VectorLayer', 'ShapefileLayer'].includes(selectedLayer.type)
        : false;
    },
    execute: async () => {
      const selectedLayer = getSingleSelectedLayer(tracker);
      if (!selectedLayer) {
        return;
      }
      const model = tracker.currentWidget?.model as IJupyterGISModel;
      const sources = model.sharedModel.sources ?? {};

      const exportSchema = {
        ...(formSchemaRegistry.getSchemas().get('ExportGeoJSONSchema') as IDict)
      };

      const formValues = await new Promise<IDict>(resolve => {
        const dialog = new FormDialog({
          title: 'Download GeoJSON',
          schema: exportSchema,
          model,
          sourceData: { exportFormat: 'GeoJSON' },
          cancelButton: false,
          syncData: (props: IDict) => {
            resolve(props);
            dialog.dispose();
          }
        });

        dialog.launch();
      });

      if (!formValues || !selectedLayer.parameters) {
        return;
      }

      const exportFileName = formValues.exportFileName;
      const sourceId = selectedLayer.parameters.source;
      const source = sources[sourceId];

      const geojsonString = await getGeoJSONDataFromLayerSource(source, model);
      if (!geojsonString) {
        return;
      }

      downloadFile(
        geojsonString,
        `${exportFileName}.geojson`,
        'application/geo+json'
      );
    }
  });

  loadKeybindings(commands, keybindings);
}

namespace Private {
  export function createLayerBrowser(
    tracker: JupyterGISTracker,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new LayerBrowserWidget({
        model: current.model,
        registry: layerBrowserRegistry.getRegistryLayers(),
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  export function createSymbologyDialog(
    tracker: JupyterGISTracker,
    state: IStateDB
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new SymbologyWidget({
        model: current.model,
        state
      });
      await dialog.launch();
    };
  }

  export function createEntry({
    tracker,
    formSchemaRegistry,
    title,
    createLayer,
    createSource,
    sourceData,
    layerData,
    sourceType,
    layerType
  }: ICreateEntry) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new CreationFormDialog({
        model: current.model,
        title,
        createLayer,
        createSource,
        sourceData,
        sourceType,
        layerData,
        layerType,
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  export async function getUserInputForRename(
    text: HTMLElement,
    input: HTMLInputElement,
    original: string
  ): Promise<string> {
    const parent = text.parentElement as HTMLElement;
    parent.replaceChild(input, text);
    input.value = original;
    input.select();
    input.focus();

    return new Promise<string>(resolve => {
      input.addEventListener('blur', () => {
        parent.replaceChild(text, input);
        resolve(input.value);
      });

      input.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.stopPropagation();
          event.preventDefault();
          input.blur();
        } else if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          input.value = original;
          input.blur();
          text.focus();
        }
      });
    });
  }

  export function removeSelectedItems(
    model: IJupyterGISModel | undefined,
    itemTypeToRemove: SelectionType,
    removeFunction: (id: string) => void
  ) {
    const selected = model?.localState?.selected?.value;

    if (!selected) {
      console.info('Nothing selected');
      return;
    }

    for (const selection in selected) {
      if (selected[selection].type === itemTypeToRemove) {
        removeFunction(selection);
      }
    }
  }

  export async function renameSelectedItem(
    model: IJupyterGISModel | undefined,
    itemType: SelectionType,
    callback: (itemId: string, newName: string) => void
  ) {
    const selectedItems = model?.localState?.selected.value;

    if (!selectedItems) {
      console.error(`No ${itemType} selected`);
      return;
    }

    let itemId = '';

    // If more then one item is selected, only rename the first
    for (const id in selectedItems) {
      if (selectedItems[id].type === itemType) {
        itemId = id;
        break;
      }
    }

    if (!itemId) {
      return;
    }

    const nodeId = selectedItems[itemId].selectedNodeId;
    if (!nodeId) {
      return;
    }

    const node = document.getElementById(nodeId);
    if (!node) {
      console.warn(`Node with ID ${nodeId} not found`);
      return;
    }

    const edit = document.createElement('input');
    edit.classList.add('jp-gis-left-panel-input');
    const originalName = node.innerText;
    const newName = await Private.getUserInputForRename(
      node,
      edit,
      originalName
    );

    if (!newName) {
      console.warn('New name cannot be empty');
      return;
    }

    if (newName !== originalName) {
      callback(itemId, newName);
    }
  }

  export function executeConsole(tracker: JupyterGISTracker): void {
    const current = tracker.currentWidget;
    if (!current || !(current instanceof JupyterGISDocumentWidget)) {
      return;
    }
    current.content.executeConsole();
  }

  export function removeConsole(tracker: JupyterGISTracker): void {
    const current = tracker.currentWidget;

    if (!current || !(current instanceof JupyterGISDocumentWidget)) {
      return;
    }
    current.content.removeConsole();
  }

  export async function toggleConsole(
    tracker: JupyterGISTracker
  ): Promise<void> {
    const current = tracker.currentWidget;

    if (!current || !(current instanceof JupyterGISDocumentWidget)) {
      return;
    }

    await current.content.toggleConsole(current.model.filePath);
  }
}
