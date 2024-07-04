import { ICollaborativeDrive } from '@jupyter/docprovider';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { Dialog, WidgetTracker, showErrorMessage } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { ITranslator } from '@jupyterlab/translation';
import { redoIcon, undoIcon } from '@jupyterlab/ui-components';
import {
  IGeoJSONSource,
  IJGISFormSchemaRegistry,
  IJGISLayerBrowserRegistry,
  IJGISSource
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { Ajv } from 'ajv';
import * as geojson from 'geojson-schema/GeoJSON.json';

import { DataErrorDialog, DialogAddDataSourceBody } from './formdialog';
import { geoJSONIcon } from './icons';
import { LayerBrowserWidget } from './layerBrowser/layerBrowserDialog';
import { JupyterGISWidget } from './widget';

/**
 * The command IDs.
 */
export namespace CommandIDs {
  export const redo = 'jupytergis:redo';
  export const undo = 'jupytergis:undo';

  export const openLayerBrowser = 'jupytergis:openLayerBrowser';

  export const newGeoJSONData = 'jupytergis:newGeoJSONData';
}

/**
 * Add the commands to the application's command registry.
 */
export function addCommands(
  app: JupyterFrontEnd,
  tracker: WidgetTracker<JupyterGISWidget>,
  translator: ITranslator,
  formSchemaRegistry: IJGISFormSchemaRegistry,
  layerBrowserRegistry: IJGISLayerBrowserRegistry,
  drive?: ICollaborativeDrive
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

  commands.addCommand(CommandIDs.openLayerBrowser, {
    label: trans.__('Open Layer Browser'),
    isEnabled: () => {
      return tracker.currentWidget
        ? tracker.currentWidget.context.model.sharedModel.editable
        : false;
    },
    iconClass: 'fa fa-book-open',
    execute: Private.createLayerBrowser(
      tracker,
      layerBrowserRegistry,
      formSchemaRegistry
    )
  });

  if (drive) {
    commands.addCommand(CommandIDs.newGeoJSONData, {
      label: trans.__('Add GeoJSON data from file'),
      isEnabled: () => {
        return tracker.currentWidget
          ? tracker.currentWidget.context.model.sharedModel.editable
          : false;
      },
      icon: geoJSONIcon,
      execute: Private.createGeoJSONSource(tracker, drive)
    });
  }
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
        model: current.context.model,
        registry: layerBrowserRegistry.getRegistryLayers(),
        formSchemaRegistry
      });
      await dialog.launch();
    };
  }

  export function createGeoJSONSource(
    tracker: WidgetTracker<JupyterGISWidget>,
    drive: ICollaborativeDrive
  ) {
    const ajv = new Ajv();
    const validate = ajv.compile(geojson);

    return async (args: any) => {
      const current = tracker.currentWidget;

      if (!current) {
        return;
      }

      let filepath: string | null = (args.path as string) ?? null;
      let saveDataInShared: boolean = args.path ?? false;

      if (filepath === null) {
        const dialog = new Dialog({
          title: 'Path of the GeoJSON file',
          body: new DialogAddDataSourceBody()
        });
        const value = (await dialog.launch()).value;
        if (value) {
          filepath = value.path;
          saveDataInShared = value.saveDataInShared;
        }
      }

      if (!filepath) {
        return;
      }

      drive
        .get(filepath)
        .then(async contentModel => {
          const name = PathExt.basename(contentModel.name, '.json');
          const geoJSONData = JSON.parse(contentModel.content);
          const valid = validate(geoJSONData);
          if (!valid) {
            const dialog = new DataErrorDialog({
              title: 'GeoJSON data invalid',
              errors: validate.errors,
              saveDataInShared
            });
            const toContinue = await dialog.launch();
            if (!toContinue.button.accept || saveDataInShared) {
              return;
            }
          }

          const parameters: IGeoJSONSource = {};
          if (saveDataInShared) {
            parameters.data = geoJSONData;
          } else {
            (parameters.path = contentModel.path), (parameters.valid = valid);
          }

          const sourceModel: IJGISSource = {
            type: 'GeoJSON',
            name,
            parameters
          };

          current.context.model.sharedModel.addSource(
            UUID.uuid4(),
            sourceModel
          );
        })
        .catch(e => {
          showErrorMessage('Error opening GeoJSON file', e);
          return;
        });
    };
  }
}
