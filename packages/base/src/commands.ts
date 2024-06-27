import { JupyterFrontEnd } from '@jupyterlab/application';
import { Dialog, WidgetTracker } from '@jupyterlab/apputils';
import { ITranslator } from '@jupyterlab/translation';
import { redoIcon, undoIcon } from '@jupyterlab/ui-components';

import {
  IDict,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJGISSource,
  IJupyterGISModel
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { FormDialog } from './formdialog';

import RASTER_LAYER_GALLERY from '../rasterlayer_gallery/raster_layer_gallery.json';
import { LayerBrowserWidget } from './layerBrowser/layerBrowserDialog';
import { IRasterLayerGalleryEntry } from './types';
import { JupyterGISWidget } from './widget';

const RASTER_THUMBNAILS: { [key: string]: string } = {};

// @ts-ignore Load all images from the 'raster_thumbnails' directory
const importAll = (r: __WebpackModuleApi.RequireContext) => {
  r.keys().forEach(key => {
    const imageName = key.replace('./', '').replace(/\.\w+$/, '');
    // const img = new Image();
    // img.src = r(key);
    RASTER_THUMBNAILS[imageName] = r(key);
  });
};

// @ts-ignore
const context = require.context(
  '../rasterlayer_gallery',
  false,
  /\.(png|jpe?g|gif|svg)$/
);
importAll(context);

export function getRasterLayerGallery(): IRasterLayerGalleryEntry[] {
  const gallery: IRasterLayerGalleryEntry[] = [];
  for (const entry of Object.keys(RASTER_LAYER_GALLERY)) {
    const xyzprovider = RASTER_LAYER_GALLERY[entry];

    if ('url' in xyzprovider) {
      addToGallery(gallery, entry, xyzprovider);
    } else {
      Object.keys(xyzprovider).forEach(mapName => {
        addToGallery(
          gallery,
          xyzprovider[mapName]['name'],
          xyzprovider[mapName],
          entry
        );
      });
    }
  }

  console.log('gallery', gallery);
  return gallery;
}

// TODO: These need better names
function addToGallery(
  gallery: IRasterLayerGalleryEntry[],
  entry: string,
  xyzprovider: { [x: string]: any },
  provider?: string | undefined
) {
  gallery.push({
    name: entry,
    thumbnail: RASTER_THUMBNAILS[xyzprovider['name'].replace('.', '-')],
    source: {
      url: xyzprovider['url'],
      minZoom: xyzprovider['min_zoom'] || 0,
      maxZoom: xyzprovider['max_zoom'] || 24,
      attribution: xyzprovider['attribution'] || '',
      provider: provider ?? entry,
      time: encodeURIComponent(new Date().toISOString()),
      variant: xyzprovider['variant'] || '',
      tileMatrixSet: xyzprovider['tilematrixset'] || '',
      format: xyzprovider['format'] || ''
    }
  });
}

/**
 * Add the commands to the application's command registry.
 */
export function addCommands(
  app: JupyterFrontEnd,
  tracker: WidgetTracker<JupyterGISWidget>,
  translator: ITranslator,
  formSchemaRegistry: IJGISFormSchemaRegistry
): void {
  Private.updateFormSchema(formSchemaRegistry);
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
    icon: redoIcon
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
    icon: undoIcon
  });

  commands.addCommand(CommandIDs.newRasterLayer, {
    label: trans.__('New Tile Layer'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    iconClass: 'fa fa-map',
    execute: Private.createRasterSourceAndLayer(tracker)
  });

  commands.addCommand(CommandIDs.openLayerBrowser, {
    label: trans.__('Open Layer Browser'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    iconClass: 'fa fa-book-open',
    execute: Private.createLayerBrowser(tracker)
  });
}

/**
 * The command IDs.
 */
export namespace CommandIDs {
  export const redo = 'jupytergis:redo';
  export const undo = 'jupytergis:undo';

  export const newRasterLayer = 'jupytergis:newRasterLayer';
  export const openLayerBrowser = 'jupytergis:openLayerBrowser';
}

namespace Private {
  export const FORM_SCHEMA = {};

  export function updateFormSchema(
    formSchemaRegistry: IJGISFormSchemaRegistry
  ) {
    if (Object.keys(FORM_SCHEMA).length > 0) {
      return;
    }
    const formSchema = formSchemaRegistry.getSchemas();
    formSchema.forEach((val, key) => {
      const value = (FORM_SCHEMA[key] = JSON.parse(JSON.stringify(val)));
      value['required'] = ['name', ...value['required']];
      value['properties'] = {
        name: { type: 'string', description: 'The name of the layer/source' },
        ...value['properties']
      };
    });
  }

  export function createLayerBrowser(tracker: WidgetTracker<JupyterGISWidget>) {
    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const dialog = new Dialog({
        body: new LayerBrowserWidget(current.context.model),
        buttons: [Dialog.cancelButton(), Dialog.okButton()]
      });
      await dialog.launch();
    };
  }

  // TODO Allow for creating only a source (e.g. loading a CSV file)
  // TODO Allow for creating only a layer (e.g. creating a vector layer given a source selected from a dropdown)
  export function createRasterSourceAndLayer(
    tracker: WidgetTracker<JupyterGISWidget>
  ) {
    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      const form = {
        title: 'Raster Layer parameters',
        default: (model: IJupyterGISModel) => {
          return {
            name: 'RasterSource',
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxZoom: 24,
            minZoom: 0
          };
        }
      };

      current.context.model.syncFormData(form);

      const syncSelectedField = (
        id: string | null,
        value: any,
        parentType: 'panel' | 'dialog'
      ): void => {
        let property: string | null = null;
        if (id) {
          const prefix = id.split('_')[0];
          property = id.substring(prefix.length);
        }
        current.context.model.syncSelectedPropField({
          id: property,
          value,
          parentType
        });
      };

      const dialog = new FormDialog({
        context: current.context,
        title: form.title,
        sourceData: form.default(current.context.model),
        schema: FORM_SCHEMA['RasterSource'],
        syncData: (props: IDict) => {
          const sharedModel = current.context.model.sharedModel;
          if (!sharedModel) {
            return;
          }

          const { name, ...parameters } = props;

          const sourceId = UUID.uuid4();

          const sourceModel: IJGISSource = {
            type: 'RasterSource',
            name,
            parameters: {
              url: parameters.url,
              minZoom: parameters.minZoom,
              maxZoom: parameters.maxZoom
            }
          };

          const layerModel: IJGISLayer = {
            type: 'RasterLayer',
            parameters: {
              source: sourceId
            },
            visible: true,
            name: name + ' Layer'
          };

          sharedModel.addSource(sourceId, sourceModel);
          current.context.model.addLayer(UUID.uuid4(), layerModel);
        },
        cancelButton: () => {
          current.context.model.syncFormData(undefined);
        },
        syncSelectedPropField: syncSelectedField
      });
      await dialog.launch();
    };
  }
}
