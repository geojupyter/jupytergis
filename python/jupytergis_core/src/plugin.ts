import { AnnotationModel, JupyterGISWidget } from '@jupytergis/base';
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
  IJupyterGISTracker
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator } from '@jupyterlab/translation';
import { IDocumentManager } from '@jupyterlab/docmanager';

import { JupyterGISExternalCommandRegistry } from './externalcommand';
import { JupyterGISLayerBrowserRegistry } from './layerBrowserRegistry';
import { JupyterGISFormSchemaRegistry } from './schemaregistry';

const NAME_SPACE = 'jupytergis';

export const trackerPlugin: JupyterFrontEndPlugin<IJupyterGISTracker> = {
  id: 'jupytergis:core:tracker',
  autoStart: true,
  requires: [ITranslator],
  optional: [IMainMenu],
  provides: IJupyterGISDocTracker,
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    mainMenu?: IMainMenu
  ): IJupyterGISTracker => {
    const tracker = new WidgetTracker<JupyterGISWidget>({
      namespace: NAME_SPACE
    });
    console.log('jupytergis:core:tracker is activated!');
    return tracker;
  }
};

export const formSchemaRegistryPlugin: JupyterFrontEndPlugin<IJGISFormSchemaRegistry> =
  {
    id: 'jupytergis:core:form-schema-registry',
    autoStart: true,
    requires: [IDocumentManager],
    provides: IJGISFormSchemaRegistryToken,
    activate: (
      app: JupyterFrontEnd,
      docmanager: IDocumentManager
    ): IJGISFormSchemaRegistry => {
      const registry = new JupyterGISFormSchemaRegistry(docmanager);
      return registry;
    }
  };

export const externalCommandRegistryPlugin: JupyterFrontEndPlugin<IJGISExternalCommandRegistry> =
  {
    id: 'jupytergis:core:external-command-registry',
    autoStart: true,
    requires: [],
    provides: IJGISExternalCommandRegistryToken,
    activate: (app: JupyterFrontEnd): IJGISExternalCommandRegistry => {
      const registry = new JupyterGISExternalCommandRegistry();
      return registry;
    }
  };

export const layerBrowserRegistryPlugin: JupyterFrontEndPlugin<IJGISLayerBrowserRegistry> =
  {
    id: 'jupytergis:core:layer-browser-registry',
    autoStart: true,
    requires: [],
    provides: IJGISLayerBrowserRegistryToken,
    activate: (app: JupyterFrontEnd) => {
      console.log('jupytergis:core:layer-browser-registry is activated');

      const registry = new JupyterGISLayerBrowserRegistry();
      return registry;
    }
  };

export const annotationPlugin: JupyterFrontEndPlugin<IAnnotationModel> = {
  id: 'jupytergis:core:annotation',
  autoStart: true,
  requires: [IJupyterGISDocTracker],
  provides: IAnnotationToken,
  activate: (app: JupyterFrontEnd, tracker: IJupyterGISTracker) => {
    const annotationModel = new AnnotationModel({
      context: tracker.currentWidget?.context
    });

    tracker.currentChanged.connect((_, changed) => {
      annotationModel.context = changed?.context || undefined;
    });
    return annotationModel;
  }
};
