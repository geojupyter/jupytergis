import { AnnotationModel, JupyterCadWidget } from '@jupytergis/base';
import {
  IAnnotationModel,
  IAnnotationToken,
  IJCadExternalCommandRegistry,
  IJCadExternalCommandRegistryToken,
  IJCadFormSchemaRegistry,
  IJCadFormSchemaRegistryToken,
  IJCadWorkerRegistry,
  IJCadWorkerRegistryToken,
  IJupyterCadDocTracker,
  IJupyterCadTracker
} from '@jupytergis/schema';
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { WidgetTracker } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator } from '@jupyterlab/translation';

import { JupyterCadWorkerRegistry } from './workerregistry';
import { JupyterCadFormSchemaRegistry } from './schemaregistry';
import { JupyterCadExternalCommandRegistry } from './externalcommand';

const NAME_SPACE = 'jupytercad';

export const trackerPlugin: JupyterFrontEndPlugin<IJupyterCadTracker> = {
  id: 'jupytercad:core:tracker',
  autoStart: true,
  requires: [ITranslator],
  optional: [IMainMenu],
  provides: IJupyterCadDocTracker,
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    mainMenu?: IMainMenu
  ): IJupyterCadTracker => {
    const tracker = new WidgetTracker<JupyterCadWidget>({
      namespace: NAME_SPACE
    });
    console.log('jupytercad:core:tracker is activated!');
    return tracker;
  }
};

export const annotationPlugin: JupyterFrontEndPlugin<IAnnotationModel> = {
  id: 'jupytercad:core:annotation',
  autoStart: true,
  requires: [IJupyterCadDocTracker],
  provides: IAnnotationToken,
  activate: (app: JupyterFrontEnd, tracker: IJupyterCadTracker) => {
    const annotationModel = new AnnotationModel({
      context: tracker.currentWidget?.context
    });

    tracker.currentChanged.connect((_, changed) => {
      annotationModel.context = changed?.context || undefined;
    });
    return annotationModel;
  }
};

export const workerRegistryPlugin: JupyterFrontEndPlugin<IJCadWorkerRegistry> =
  {
    id: 'jupytercad:core:worker-registry',
    autoStart: true,
    requires: [],
    provides: IJCadWorkerRegistryToken,
    activate: (app: JupyterFrontEnd): IJCadWorkerRegistry => {
      const workerRegistry = new JupyterCadWorkerRegistry();
      return workerRegistry;
    }
  };

export const formSchemaRegistryPlugin: JupyterFrontEndPlugin<IJCadFormSchemaRegistry> =
  {
    id: 'jupytercad:core:form-schema-registry',
    autoStart: true,
    requires: [],
    provides: IJCadFormSchemaRegistryToken,
    activate: (app: JupyterFrontEnd): IJCadFormSchemaRegistry => {
      const registry = new JupyterCadFormSchemaRegistry();
      return registry;
    }
  };

export const externalCommandRegistryPlugin: JupyterFrontEndPlugin<IJCadExternalCommandRegistry> =
  {
    id: 'jupytercad:core:external-command-registry',
    autoStart: true,
    requires: [],
    provides: IJCadExternalCommandRegistryToken,
    activate: (app: JupyterFrontEnd): IJCadExternalCommandRegistry => {
      const registry = new JupyterCadExternalCommandRegistry();
      return registry;
    }
  };
