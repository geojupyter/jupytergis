import {
  IJGISFormSchemaRegistry,
  IJGISLayerBrowserRegistry,
  IJGISLayerGroup,
  IJGISLayerItem,
  IJupyterGISModel,
  SelectionType
} from '@jupytergis/schema';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { showErrorMessage, WidgetTracker } from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';

import { CommandIDs, icons } from './constants';
import { LayerBrowserWidget } from './dialogs/layerBrowserDialog';
import { CreationFormDialog } from './dialogs/formdialog';
import { JupyterGISWidget } from './widget';

/**
 * Add the commands to the application's command registry.
 */
export function addCommands(
  app: JupyterFrontEnd,
  tracker: WidgetTracker<JupyterGISWidget>,
  translator: ITranslator,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  layerBrowserRegistry: IJGISLayerBrowserRegistry
): void {
  const trans = translator.load('jupyterlab');
  const { commands } = app;

  commands.addCommand(CommandIDs.redo, {
    label: trans.__('Redo'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: args => {
      const current = tracker.currentWidget;

      if (current) {
        return current.context.model.sharedModel.redo();
      }
    },
    ...icons.get(CommandIDs.redo)?.icon
  });

  commands.addCommand(CommandIDs.undo, {
    label: trans.__('Undo'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: args => {
      const current = tracker.currentWidget;

      if (current) {
        return current.context.model.sharedModel.undo();
      }
    },
    ...icons.get(CommandIDs.undo)
  });

  /**
   * SOURCES and LAYERS creation commands.
   */
  commands.addCommand(CommandIDs.openLayerBrowser, {
    label: trans.__('Open Layer Browser'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: Private.createLayerBrowser(
      tracker,
      layerBrowserRegistry,
      formSchemaRegistry
    ),
    ...icons.get(CommandIDs.openLayerBrowser)
  });

  commands.addCommand(CommandIDs.newGeoJSONLayer, {
    label: trans.__('New geoJSON layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: Private.createGeoJSONLayer(tracker, formSchemaRegistry),
    ...icons.get(CommandIDs.newGeoJSONLayer)
  });

  commands.addCommand(CommandIDs.newVectorTileLayer, {
    label: trans.__('New vector tile layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: Private.createVectorTileLayer(tracker, formSchemaRegistry),
    ...icons.get(CommandIDs.newVectorTileLayer)
  });

  /**
   * SOURCES only commands.
   */
  commands.addCommand(CommandIDs.newGeoJSONSource, {
    label: args =>
      args.from === 'contextMenu'
        ? trans.__('GeoJSON')
        : trans.__('Add GeoJSON data from file'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: Private.createGeoJSONSource(tracker, formSchemaRegistry),
    ...icons.get(CommandIDs.newGeoJSONSource)?.icon
  });

  commands.addCommand(CommandIDs.removeSource, {
    label: trans.__('Remove Source'),
    execute: () => {
      const model = tracker.currentWidget?.context.model;
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

  commands.addCommand(CommandIDs.renameSource, {
    label: trans.__('Rename Source'),
    execute: async () => {
      const model = tracker.currentWidget?.context.model;
      await Private.renameSelectedItem(model, 'source', (sourceId, newName) => {
        const source = model?.getSource(sourceId);
        if (source) {
          source.name = newName;
          model?.sharedModel.updateSource(sourceId, source);
        }
      });
    }
  });
  /**
   * LAYERS and LAYER GROUPS only commands.
   */
  commands.addCommand(CommandIDs.removeLayer, {
    label: trans.__('Remove Layer'),
    execute: () => {
      const model = tracker.currentWidget?.context.model;
      Private.removeSelectedItems(model, 'layer', selection => {
        model?.sharedModel.removeLayer(selection);
      });
    }
  });

  commands.addCommand(CommandIDs.renameLayer, {
    label: trans.__('Rename Layer'),
    execute: async () => {
      const model = tracker.currentWidget?.context.model;
      await Private.renameSelectedItem(model, 'layer', (layerId, newName) => {
        const layer = model?.getLayer(layerId);
        if (layer) {
          layer.name = newName;
          model?.sharedModel.updateLayer(layerId, layer);
        }
      });
    }
  });

  commands.addCommand(CommandIDs.removeGroup, {
    label: trans.__('Remove Group'),
    execute: async () => {
      const model = tracker.currentWidget?.context.model;
      Private.removeSelectedItems(model, 'group', selection => {
        model?.removeLayerGroup(selection);
      });
    }
  });

  commands.addCommand(CommandIDs.renameGroup, {
    label: trans.__('Rename Group'),
    execute: async () => {
      const model = tracker.currentWidget?.context.model;
      await Private.renameSelectedItem(model, 'group', (groupName, newName) => {
        model?.renameLayerGroup(groupName, newName);
      });
    }
  });

  commands.addCommand(CommandIDs.moveLayersToGroup, {
    label: args =>
      args['label'] ? (args['label'] as string) : trans.__('Move to Root'),
    execute: args => {
      const model = tracker.currentWidget?.context.model;
      const groupName = args['label'] as string;

      const selectedLayers = model?.localState?.selected?.value;

      if (!selectedLayers) {
        return;
      }

      model.moveSelectedLayersToGroup(selectedLayers, groupName);
    }
  });

  commands.addCommand(CommandIDs.moveLayerToNewGroup, {
    label: trans.__('Move Layers to New Group'),
    execute: async () => {
      const model = tracker.currentWidget?.context.model;
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

  commands.addCommand(CommandIDs.newVectorLayer, {
    label: trans.__('New vector layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    execute: Private.createVectorLayer(tracker, formSchemaRegistry),
    ...icons.get(CommandIDs.newVectorLayer)
  });

  commands.addCommand(CommandIDs.newTerrain, {
    label: trans.__('New Terrain'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    iconClass: 'fa fa-mountain',
    execute: Private.createTerrain(tracker)
  });
}

namespace Private {
  export function createLayerBrowser(
    tracker: WidgetTracker<JupyterGISWidget>,
    layerBrowserRegistry: IJGISLayerBrowserRegistry,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new LayerBrowserWidget({
        context: current.context,
        registry: layerBrowserRegistry.getRegistryLayers(),
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  /**
   * Command to create a GeoJSON source and vector layer.
   */
  export function createGeoJSONLayer(
    tracker: WidgetTracker<JupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new CreationFormDialog({
        context: current.context,
        title: 'Create GeoJSON Layer',
        createLayer: true,
        createSource: true,
        sourceData: {
          minZoom: 0,
          maxZoom: 0
        },
        layerData: {
          name: 'Custom GeoJSON Layer'
        },
        sourceType: 'GeoJSONSource',
        layerType: 'VectorLayer',
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  export function createVectorTileLayer(
    tracker: WidgetTracker<JupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new CreationFormDialog({
        context: current.context,
        title: 'Create Vector Tile Layer',
        createLayer: true,
        createSource: true,
        sourceData: {
          minZoom: 0,
          maxZoom: 0
        },
        layerData: {
          name: 'Custom Vector Tile Layer'
        },
        sourceType: 'VectorTileSource',
        layerType: 'VectorLayer',
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  /**
   * Command to create a GeoJSON source.
   *
   * This is currently not used.
   */
  export function createGeoJSONSource(
    tracker: WidgetTracker<JupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    return async () => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new CreationFormDialog({
        context: current.context,
        title: 'Create GeoJSON Source',
        createLayer: false,
        createSource: true,
        sourceData: {
          name: 'Custom GeoJSON Source'
        },
        sourceType: 'GeoJSONSource',
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  /**
   * Command to create a Vector layer.
   *
   * This is currently not used.
   */
  export function createVectorLayer(
    tracker: WidgetTracker<JupyterGISWidget>,
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new CreationFormDialog({
        context: current.context,
        title: 'Create Vector Layer',
        createLayer: true,
        createSource: false,
        layerData: {
          name: 'Custom Vector Layer'
        },
        sourceType: 'GeoJSONSource',
        layerType: 'VectorLayer',
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
    const selected = model?.localState?.selected.value;

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

  export function createTerrain(tracker: WidgetTracker<JupyterGISWidget>) {
    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const form = {
        title: 'Terrain Parameters',
        default: (model: IJupyterGISModel) => {
          return {
            name: 'Terrain tile source',
            tileSize: 256,
            url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
            source: '',
            exaggeration: 1
          };
        }
      };

      const dialog = new FormDialog({
        context: current.context,
        title: form.title,
        sourceData: form.default(current.context.model),
        schema: FORM_SCHEMA['RasterDemSource'],
        syncData: (props: IDict) => {
          const sharedModel = current.context.model.sharedModel;
          if (!sharedModel) {
            return;
          }

          const { name, ...parameters } = props;

          const sourceId = UUID.uuid4();

          const sourceModel: IJGISSource = {
            type: 'RasterDemSource',
            name,
            parameters: {
              url: parameters.url,
              tileSize: parameters.tileSize
            }
          };

          sharedModel.addSource(sourceId, sourceModel);
        }
      });
      await dialog.launch();
    };
  }
}
