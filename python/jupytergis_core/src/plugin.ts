import {
  AnnotationModel,
  LocalStorageOpenEOTokensProvider,
} from '@jupytergis/base';
import {
  IAnnotationModel,
  IAnnotationToken,
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  IJGISFormSchemaRegistry,
  IJGISFormSchemaRegistryToken,
  IJGISLayerBrowserRegistry,
  IJGISLayerBrowserRegistryToken,
  IJupyterGISDocTracker,
  IJupyterGISTracker,
  IJupyterGISWidget,
  IOpenEOTokensProvider,
  IOpenEOTokensProviderToken,
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { SqljsAdapter } from '@ngageoint/geopackage';
import wasmURL from 'rtree-sql.js/dist/sql-wasm.wasm';

import { JupyterGISExternalCommandRegistry } from './externalcommand';
import { JupyterGISLayerBrowserRegistry } from './layerBrowserRegistry';
import { JupyterGISFormSchemaRegistry } from './schemaregistry';

SqljsAdapter.setSqljsWasmLocateFile(() => {
  return wasmURL;
});

const NAME_SPACE = 'jupytergis';

export const trackerPlugin: JupyterFrontEndPlugin<IJupyterGISTracker> = {
  id: 'jupytergis:core:tracker',
  autoStart: true,
  requires: [],
  provides: IJupyterGISDocTracker,
  activate: (_app: JupyterFrontEnd): IJupyterGISTracker => {
    const tracker = new WidgetTracker<IJupyterGISWidget>({
      namespace: NAME_SPACE,
    });
    console.debug('jupytergis:core:tracker is activated!');
    return tracker;
  },
};

export const formSchemaRegistryPlugin: JupyterFrontEndPlugin<IJGISFormSchemaRegistry> =
  {
    id: 'jupytergis:core:form-schema-registry',
    autoStart: true,
    requires: [IDocumentManager],
    provides: IJGISFormSchemaRegistryToken,
    activate: (
      _app: JupyterFrontEnd,
      docmanager: IDocumentManager,
    ): IJGISFormSchemaRegistry => {
      const registry = new JupyterGISFormSchemaRegistry(docmanager);
      return registry;
    },
  };

export const externalCommandRegistryPlugin: JupyterFrontEndPlugin<IJGISExternalCommandRegistry> =
  {
    id: 'jupytergis:core:external-command-registry',
    autoStart: true,
    requires: [],
    provides: IJGISExternalCommandRegistryToken,
  activate: (_app: JupyterFrontEnd): IJGISExternalCommandRegistry => {
      const registry = new JupyterGISExternalCommandRegistry();
      return registry;
    },
  };

export const layerBrowserRegistryPlugin: JupyterFrontEndPlugin<IJGISLayerBrowserRegistry> =
  {
    id: 'jupytergis:core:layer-browser-registry',
    autoStart: true,
    requires: [],
    provides: IJGISLayerBrowserRegistryToken,
  activate: (_app: JupyterFrontEnd) => {
      console.debug('jupytergis:core:layer-browser-registry is activated');
      const registry = new JupyterGISLayerBrowserRegistry();
      return registry;
    },
  };

export const annotationPlugin: JupyterFrontEndPlugin<IAnnotationModel> = {
  id: 'jupytergis:core:annotation',
  autoStart: true,
  requires: [IJupyterGISDocTracker],
  provides: IAnnotationToken,
  activate: (app: JupyterFrontEnd, tracker: IJupyterGISTracker) => {
    const annotationModel = new AnnotationModel({
      model: tracker.currentWidget?.model,
    });

    tracker.currentChanged.connect((_, changed) => {
      annotationModel.model = changed?.model || undefined;
    });
    return annotationModel;
  },
};

/**
 * Keeps the openEO sign-in across reloads. A deployment that cannot keep
 * credentials in the browser disables this plugin and provides its own store.
 */
export const openEOTokensPlugin: JupyterFrontEndPlugin<IOpenEOTokensProvider> =
  {
    id: 'jupytergis:core:openeo-tokens',
    autoStart: true,
    requires: [],
    provides: IOpenEOTokensProviderToken,
  activate: (_app: JupyterFrontEnd) => {
      // Allow providing the openEOTokensProvider globally
      if (window.openEOTokensProvider) {
        return window.openEOTokensProvider;
      }

      return new LocalStorageOpenEOTokensProvider();
    },
  };
