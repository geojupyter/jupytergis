import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayerBrowserRegistry,
  IJGISLayerGroup,
  IJGISLayerItem,
  IJupyterGISModel,
  JgisCoordinates,
  LayerType,
  SourceType,
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ICompletionProviderManager } from '@jupyterlab/completer';
import { IStateDB } from '@jupyterlab/statedb';
import { ITranslator } from '@jupyterlab/translation';
import { CommandRegistry } from '@lumino/commands';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { Coordinate } from 'ol/coordinate';
import { fromLonLat } from 'ol/proj';

import { CommandIDs, icons } from '../constants';
import { ProcessingFormDialog } from '../dialogs/ProcessingFormDialog';
import { LayerBrowserWidget } from '../dialogs/layerBrowserDialog';
import { LayerCreationFormDialog } from '../dialogs/layerCreationFormDialog';
import { SymbologyWidget } from '../dialogs/symbology/symbologyDialog';
import { targetWithCenterIcon } from '../icons';
import keybindings from '../keybindings.json';
import { getSingleSelectedLayer } from '../processing/index';
import { addProcessingCommands } from '../processing/processingCommands';
import { getGeoJSONDataFromLayerSource, downloadFile } from '../tools';
import { JupyterGISTracker, SYMBOLOGY_VALID_LAYER_TYPES } from '../types';
import { JupyterGISDocumentWidget } from '../widget';

const POINT_SELECTION_TOOL_CLASS = 'jGIS-point-selection-tool';

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
      selector: binding.selector,
    });
  });
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
  completionProviderManager: ICompletionProviderManager | undefined,
): void {
  const trans = translator.load('jupyterlab');
  const { commands } = app;

  /**
   * Wraps a command definition to automatically disable it in Specta mode
   */
  const createSpectaAwareCommand = (
    command: CommandRegistry.ICommandOptions,
  ): CommandRegistry.ICommandOptions => {
    const originalIsEnabled = command.isEnabled;

    return {
      ...command,
      isEnabled: (args?: ReadonlyPartialJSONObject) => {
        // First check if we're in Specta mode
        const currentModel = tracker.currentWidget?.model;
        if (currentModel?.isSpectaMode()) {
          return false;
        }
        // Then check the original isEnabled if it exists
        if (originalIsEnabled) {
          return originalIsEnabled(args ?? {});
        }
        // Default to enabled if no original check
        return true;
      },
    };
  };

  // Override addCommand to automatically wrap all commands
  const originalAddCommand = commands.addCommand.bind(commands);
  commands.addCommand = (
    id: string,
    options: CommandRegistry.ICommandOptions,
  ) => {
    return originalAddCommand(id, createSpectaAwareCommand(options));
  };

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

      const isValidLayer = SYMBOLOGY_VALID_LAYER_TYPES.includes(layer.type);

      return isValidLayer;
    },
    execute: Private.createSymbologyDialog(tracker, state),

    ...icons.get(CommandIDs.symbology),
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
    ...icons.get(CommandIDs.redo)?.icon,
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
    ...icons.get(CommandIDs.undo),
  });

  commands.addCommand(CommandIDs.identify, {
    label: trans.__('Identify'),
    isToggled: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return false;
      }

      const selectedLayer = getSingleSelectedLayer(tracker);
      if (!selectedLayer) {
        return false;
      }
      const canIdentify = [
        'VectorLayer',
        'ShapefileLayer',
        'WebGlLayer',
        'VectorTileLayer',
      ].includes(selectedLayer.type);

      if (current.model.currentMode === 'identifying' && !canIdentify) {
        current.model.currentMode = 'panning';
        current.node.classList.remove(POINT_SELECTION_TOOL_CLASS);
        return false;
      }

      return current.model.currentMode === 'identifying';
    },
    isEnabled: () => {
      if (tracker.currentWidget?.model.jgisSettings.identifyDisabled) {
        return false;
      }
      const selectedLayer = getSingleSelectedLayer(tracker);
      if (!selectedLayer) {
        return false;
      }
      return [
        'VectorLayer',
        'ShapefileLayer',
        'WebGlLayer',
        'VectorTileLayer',
      ].includes(selectedLayer.type);
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
          current.model.currentMode = 'panning';
          current.node.classList.remove(POINT_SELECTION_TOOL_CLASS);
          commands.notifyCommandChanged(CommandIDs.identify);
          return;
        }
      }

      current.node.classList.toggle(POINT_SELECTION_TOOL_CLASS);
      current.model.toggleMode('identifying');

      commands.notifyCommandChanged(CommandIDs.identify);
    },
    ...icons.get(CommandIDs.identify),
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
    ...icons.get(CommandIDs.temporalController),
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
      formSchemaRegistry,
    ),
    ...icons.get(CommandIDs.openLayerBrowser),
  });

  /**
   * Source and layers
   */
  commands.addCommand(CommandIDs.newRasterEntry, {
    label: trans.__('New Raster Tile Layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create Raster Tile Layer',
      createLayer: true,
      createSource: true,
      sourceData: {
        minZoom: 0,
        maxZoom: 24,
      },
      layerData: { name: 'Custom Raster Tile Layer' },
      sourceType: 'RasterSource',
      layerType: 'RasterLayer',
    }),
    ...icons.get(CommandIDs.newRasterEntry),
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
      layerType: 'VectorTileLayer',
    }),
    ...icons.get(CommandIDs.newVectorTileEntry),
  });

  commands.addCommand(CommandIDs.newGeoParquetEntry, {
    label: trans.__('New GeoParquet Layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: Private.createEntry({
      tracker,
      formSchemaRegistry,
      title: 'Create GeoParquet Layer',
      createLayer: true,
      createSource: true,
      sourceData: { name: 'Custom GeoParquet Source' },
      layerData: { name: 'Custom GeoParquet Layer' },
      sourceType: 'GeoParquetSource',
      layerType: 'VectorLayer',
    }),
    ...icons.get(CommandIDs.newGeoParquetEntry),
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
      layerType: 'VectorLayer',
    }),
    ...icons.get(CommandIDs.newGeoJSONEntry),
  });

  //Add processing commands
  addProcessingCommands(app, commands, tracker, trans, formSchemaRegistry);

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
      layerType: 'HillshadeLayer',
    }),
    ...icons.get(CommandIDs.newHillshadeEntry),
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
          [-80.425, 37.936],
        ],
      },
      layerData: { name: 'Custom Image Layer' },
      sourceType: 'ImageSource',
      layerType: 'ImageLayer',
    }),
    ...icons.get(CommandIDs.newImageEntry),
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
          'https://static-assets.mapbox.com/mapbox-gl-js/drone.webm',
        ],
        coordinates: [
          [-122.51596391201019, 37.56238816766053],
          [-122.51467645168304, 37.56410183312965],
          [-122.51309394836426, 37.563391708549425],
          [-122.51423120498657, 37.56161849366671],
        ],
      },
      layerData: { name: 'Custom Video Layer' },
      sourceType: 'VideoSource',
      layerType: 'RasterLayer',
    }),
    ...icons.get(CommandIDs.newVideoEntry),
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
        urls: [{}],
      },
      layerData: { name: 'Custom GeoTiff Layer' },
      sourceType: 'GeoTiffSource',
      layerType: 'WebGlLayer',
    }),
    ...icons.get(CommandIDs.newGeoTiffEntry),
  });

  commands.addCommand(CommandIDs.newShapefileEntry, {
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
      layerType: 'VectorLayer',
    }),
    ...icons.get(CommandIDs.newShapefileEntry),
  });

  /**
   * LAYERS and LAYER GROUP actions.
   */
  commands.addCommand(CommandIDs.renameSelected, {
    label: trans.__('Rename'),
    isEnabled: () => {
      const model = tracker.currentWidget?.model;
      const selected = model?.localState?.selected?.value;
      return !!selected && Object.keys(selected).length === 1;
    },
    execute: async () => {
      const model = tracker.currentWidget?.model;
      const selected = model?.localState?.selected?.value;

      if (!model || !selected) {
        return;
      }

      await Private.renameSelectedItem(model);
    },
    ...icons.get(CommandIDs.renameSelected),
  });

  commands.addCommand(CommandIDs.removeSelected, {
    label: trans.__('Remove'),
    isEnabled: () => {
      const model = tracker.currentWidget?.model;
      const selected = model?.localState?.selected?.value;
      return !!selected && Object.keys(selected).length > 0;
    },
    execute: async () => {
      const model = tracker.currentWidget?.model;
      const selected = model?.localState?.selected?.value;

      if (!model || !selected) {
        return;
      }

      await Private.removeSelectedItems(model);
    },
    ...icons.get(CommandIDs.removeSelected),
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
    },
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
        layers: layers,
      };

      model.addNewLayerGroup(selectedLayers, newLayerGroup);
    },
  });

  /**
   * Source actions
   */
  commands.addCommand(CommandIDs.renameSource, {
    label: trans.__('Rename Source'),
    execute: async () => {
      const model = tracker.currentWidget?.model;
      await Private.renameSelectedItem(model);
    },
  });

  commands.addCommand(CommandIDs.removeSource, {
    label: trans.__('Remove Source'),
    execute: () => {
      const model = tracker.currentWidget?.model;
      Private.removeSelectedSources(model);
    },
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
    isToggled: () => {
      if (tracker.currentWidget instanceof JupyterGISDocumentWidget) {
        return tracker.currentWidget?.content.consoleOpened === true;
      } else {
        return false;
      }
    },
    execute: async () => {
      await Private.toggleConsole(tracker);
      commands.notifyCommandChanged(CommandIDs.toggleConsole);
    },
  });
  commands.addCommand(CommandIDs.executeConsole, {
    label: trans.__('Execute console'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: () => Private.executeConsole(tracker),
  });
  commands.addCommand(CommandIDs.removeConsole, {
    label: trans.__('Remove console'),
    isVisible: () => tracker.currentWidget instanceof JupyterGISDocumentWidget,
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.model.sharedModel.editable
        : false;
    },
    execute: () => Private.removeConsole(tracker),
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
    },
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
    },
  });

  commands.addCommand(CommandIDs.zoomToLayer, {
    label: trans.__('Zoom to Layer'),
    execute: () => {
      const currentWidget = tracker.currentWidget;
      if (!currentWidget || !completionProviderManager) {
        return;
      }
      const model = tracker.currentWidget.model;
      const selectedItems = model.localState?.selected.value;

      if (!selectedItems) {
        return;
      }

      const layerId = Object.keys(selectedItems)[0];
      model.centerOnPosition(layerId);
    },
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
        ...(formSchemaRegistry
          .getSchemas()
          .get('ExportGeoJSONSchema') as IDict),
      };

      const formValues = await new Promise<IDict>(resolve => {
        const dialog = new ProcessingFormDialog({
          title: 'Download GeoJSON',
          schema: exportSchema,
          model,
          sourceData: { exportFormat: 'GeoJSON' },
          formContext: 'create',
          processingType: 'Export',
          syncData: (props: IDict) => {
            resolve(props);
            dialog.dispose();
          },
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
        'application/geo+json',
      );
    },
  });

  commands.addCommand(CommandIDs.getGeolocation, {
    label: trans.__('Center on Geolocation'),
    execute: async () => {
      const viewModel = tracker.currentWidget?.model;
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };
      const success = (pos: any) => {
        const location: Coordinate = fromLonLat([
          pos.coords.longitude,
          pos.coords.latitude,
        ]);
        const Jgislocation: JgisCoordinates = {
          x: location[0],
          y: location[1],
        };
        if (viewModel) {
          viewModel.geolocationChanged.emit(Jgislocation);
        }
      };
      const error = (err: any) => {
        console.warn(`ERROR(${err.code}): ${err.message}`);
      };
      navigator.geolocation.getCurrentPosition(success, error, options);
    },
    icon: targetWithCenterIcon,
  });

  // Panel visibility commands
  commands.addCommand(CommandIDs.toggleLeftPanel, {
    label: trans.__('Toggle Left Panel'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () => {
      const current = tracker.currentWidget;
      return current ? !current.model.jgisSettings.leftPanelDisabled : false;
    },
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      try {
        const settings = await current.model.getSettings();
        const currentValue =
          settings?.composite?.leftPanelDisabled ??
          current.model.jgisSettings.leftPanelDisabled ??
          false;
        await settings?.set('leftPanelDisabled', !currentValue);
        commands.notifyCommandChanged(CommandIDs.toggleLeftPanel);
      } catch (err) {
        console.error('Failed to toggle Left Panel:', err);
      }
    },
  });

  commands.addCommand(CommandIDs.toggleRightPanel, {
    label: trans.__('Toggle Right Panel'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () => {
      const current = tracker.currentWidget;
      return current ? !current.model.jgisSettings.rightPanelDisabled : false;
    },
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      try {
        const settings = await current.model.getSettings();
        const currentValue =
          settings?.composite?.rightPanelDisabled ??
          current.model.jgisSettings.rightPanelDisabled ??
          false;
        await settings?.set('rightPanelDisabled', !currentValue);
        commands.notifyCommandChanged(CommandIDs.toggleRightPanel);
      } catch (err) {
        console.error('Failed to toggle Right Panel:', err);
      }
    },
  });

  // Left panel tabs
  commands.addCommand(CommandIDs.showLayersTab, {
    label: trans.__('Show Layers Tab'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () =>
      tracker.currentWidget
        ? !tracker.currentWidget.model.jgisSettings.layersDisabled
        : false,
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const settings = await current.model.getSettings();
      const currentValue =
        settings?.composite?.layersDisabled ??
        current.model.jgisSettings.layersDisabled ??
        false;
      await settings?.set('layersDisabled', !currentValue);
      commands.notifyCommandChanged(CommandIDs.showLayersTab);
    },
  });

  commands.addCommand(CommandIDs.showStacBrowserTab, {
    label: trans.__('Show STAC Browser Tab'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () =>
      tracker.currentWidget
        ? !tracker.currentWidget.model.jgisSettings.stacBrowserDisabled
        : false,
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const settings = await current.model.getSettings();
      const currentValue =
        settings?.composite?.stacBrowserDisabled ??
        current.model.jgisSettings.stacBrowserDisabled ??
        false;
      await settings?.set('stacBrowserDisabled', !currentValue);
      commands.notifyCommandChanged(CommandIDs.showStacBrowserTab);
    },
  });

  commands.addCommand(CommandIDs.showFiltersTab, {
    label: trans.__('Show Filters Tab'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () =>
      tracker.currentWidget
        ? !tracker.currentWidget.model.jgisSettings.filtersDisabled
        : false,
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const settings = await current.model.getSettings();
      const currentValue =
        settings?.composite?.filtersDisabled ??
        current.model.jgisSettings.filtersDisabled ??
        false;
      await settings?.set('filtersDisabled', !currentValue);
      commands.notifyCommandChanged(CommandIDs.showFiltersTab);
    },
  });

  // Right panel tabs
  commands.addCommand(CommandIDs.showObjectPropertiesTab, {
    label: trans.__('Show Object Properties Tab'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () =>
      tracker.currentWidget
        ? !tracker.currentWidget.model.jgisSettings.objectPropertiesDisabled
        : false,
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const settings = await current.model.getSettings();
      const currentValue =
        settings?.composite?.objectPropertiesDisabled ??
        current.model.jgisSettings.objectPropertiesDisabled ??
        false;
      await settings?.set('objectPropertiesDisabled', !currentValue);
      commands.notifyCommandChanged(CommandIDs.showObjectPropertiesTab);
    },
  });

  commands.addCommand(CommandIDs.showAnnotationsTab, {
    label: trans.__('Show Annotations Tab'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () =>
      tracker.currentWidget
        ? !tracker.currentWidget.model.jgisSettings.annotationsDisabled
        : false,
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const settings = await current.model.getSettings();
      const currentValue =
        settings?.composite?.annotationsDisabled ??
        current.model.jgisSettings.annotationsDisabled ??
        false;
      await settings?.set('annotationsDisabled', !currentValue);
      commands.notifyCommandChanged(CommandIDs.showAnnotationsTab);
    },
  });

  commands.addCommand(CommandIDs.showIdentifyPanelTab, {
    label: trans.__('Show Identify Panel Tab'),
    isEnabled: () => Boolean(tracker.currentWidget),
    isToggled: () =>
      tracker.currentWidget
        ? !tracker.currentWidget.model.jgisSettings.identifyDisabled
        : false,
    execute: async () => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      const settings = await current.model.getSettings();
      const currentValue =
        settings?.composite?.identifyDisabled ??
        current.model.jgisSettings.identifyDisabled ??
        false;
      await settings?.set('identifyDisabled', !currentValue);
      commands.notifyCommandChanged(CommandIDs.showIdentifyPanelTab);
    },
  });

  commands.addCommand(CommandIDs.addMarker, {
    label: trans.__('Add Marker'),
    isToggled: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return false;
      }

      return current.model.currentMode === 'marking';
    },
    isEnabled: () => {
      // TODO should check if at least one layer exists?
      return true;
    },
    execute: args => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      current.node.classList.toggle(POINT_SELECTION_TOOL_CLASS);
      current.model.toggleMode('marking');

      commands.notifyCommandChanged(CommandIDs.addMarker);
    },
    ...icons.get(CommandIDs.addMarker),
  });

  commands.addCommand(CommandIDs.addStorySegment, {
    label: trans.__('Add Story Segment'),
    isEnabled: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return false;
      }
      return (
        current.model.sharedModel.editable &&
        !current.model.jgisSettings.storyMapsDisabled
      );
    },
    execute: args => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }
      current.model.addStorySegment();
      commands.notifyCommandChanged(CommandIDs.toggleStoryPresentationMode);
    },
    ...icons.get(CommandIDs.addStorySegment),
  });

  commands.addCommand(CommandIDs.toggleStoryPresentationMode, {
    label: trans.__('Toggle Story Presentation Mode'),
    isToggled: () => {
      const current = tracker.currentWidget;
      if (!current) {
        return false;
      }

      const { storyMapPresentationMode } = current.model.getOptions();

      return storyMapPresentationMode ?? false;
    },
    isEnabled: () => {
      const storySegments =
        tracker.currentWidget?.model.getSelectedStory().story?.storySegments;

      if (
        tracker.currentWidget?.model.jgisSettings.storyMapsDisabled ||
        !storySegments ||
        storySegments.length < 1
      ) {
        return false;
      }

      return true;
    },
    execute: args => {
      const current = tracker.currentWidget;
      if (!current) {
        return;
      }

      const currentOptions = current.model.getOptions();

      current.model.setOptions({
        ...currentOptions,
        storyMapPresentationMode: !currentOptions.storyMapPresentationMode,
      });

      commands.notifyCommandChanged(CommandIDs.toggleStoryPresentationMode);
    },
    ...icons.get(CommandIDs.toggleStoryPresentationMode),
  });

  /* Needs to be enabled in Specta mode, so add without Specta-aware wrapper */
  originalAddCommand(CommandIDs.storyPrev, {
    label: trans.__('Previous Story Segment'),
    isEnabled: () => {
      const model = tracker.currentWidget?.model;
      const storySegments = model?.getSelectedStory().story?.storySegments;

      if (
        !model ||
        model.jgisSettings.storyMapsDisabled ||
        !storySegments ||
        storySegments.length < 1
      ) {
        return false;
      }

      if (!model.isSpectaMode()) {
        return false;
      }

      return model.getCurrentSegmentIndex() > 0;
    },
    execute: () => {
      const model = tracker.currentWidget?.model;
      if (!model) {
        return;
      }
      const current = model.getCurrentSegmentIndex() ?? 0;
      model.setCurrentSegmentIndex(current - 1);
    },
  });

  originalAddCommand(CommandIDs.storyNext, {
    label: trans.__('Next Story Segment'),
    isEnabled: () => {
      const model = tracker.currentWidget?.model;
      const storySegments = model?.getSelectedStory().story?.storySegments;

      if (
        !model ||
        model.jgisSettings.storyMapsDisabled ||
        !storySegments ||
        storySegments.length < 1
      ) {
        return false;
      }

      const isSpecta = model.isSpectaMode();
      if (!isSpecta) {
        return false;
      }

      const current = model.getCurrentSegmentIndex() ?? 0;

      return current < storySegments.length - 1;
    },
    execute: () => {
      const model = tracker.currentWidget?.model;
      if (!model) {
        return;
      }
      const current = model.getCurrentSegmentIndex() ?? 0;
      model.setCurrentSegmentIndex(current + 1);
    },
  });

  loadKeybindings(commands, keybindings);
}

namespace Private {
  export function createLayerBrowser(
    tracker: JupyterGISTracker,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    formSchemaRegistry: IJGISFormSchemaRegistry,
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new LayerBrowserWidget({
        model: current.model,
        registry: layerBrowserRegistry.getRegistryLayers(),
        formSchemaRegistry,
      });
      await dialog.launch();
    };
  }

  export function createSymbologyDialog(
    tracker: JupyterGISTracker,
    state: IStateDB,
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new SymbologyWidget({
        model: current.model,
        state,
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
    layerType,
  }: ICreateEntry) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new LayerCreationFormDialog({
        model: current.model,
        title,
        createLayer,
        createSource,
        sourceData,
        sourceType,
        layerData,
        layerType,
        formSchemaRegistry,
      });
      await dialog.launch();
    };
  }

  export function removeSelectedItems(model: IJupyterGISModel | undefined) {
    const selected = model?.localState?.selected?.value;

    if (!selected || !model) {
      console.error('Failed to remove selected item -- nothing selected');
      return;
    }

    for (const id of Object.keys(selected)) {
      const item = selected[id];

      switch (item.type) {
        case 'layer':
          model.removeLayer(id);
          break;
        case 'group':
          model.removeLayerGroup(id);
          break;
      }
    }
  }

  export async function renameSelectedItem(
    model: IJupyterGISModel | undefined,
  ) {
    const selectedItems = model?.localState?.selected?.value;

    if (!selectedItems || !model) {
      console.error('No item selected');
      return;
    }

    const ids = Object.keys(selectedItems);
    if (ids.length === 0) {
      return;
    }

    const itemId = ids[0];
    const item = selectedItems[itemId];

    if (!item.type) {
      return;
    }

    model.setEditingItem(item.type, itemId);
  }

  export function removeSelectedSources(model: IJupyterGISModel | undefined) {
    const selected = model?.localState?.selected?.value;

    if (!selected || !model) {
      return;
    }

    for (const id of Object.keys(selected)) {
      if (model.getLayersBySource(id).length > 0) {
        showErrorMessage(
          'Remove source error',
          'The source is used by a layer.',
        );
        continue;
      }

      model.sharedModel.removeSource(id);
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
    tracker: JupyterGISTracker,
  ): Promise<void> {
    const current = tracker.currentWidget;

    if (!current || !(current instanceof JupyterGISDocumentWidget)) {
      return;
    }

    await current.content.toggleConsole(current.model.filePath);
  }
}
