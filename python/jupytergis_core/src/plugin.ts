import { JupyterGISWidget } from '@jupytergis/base';
import {
  IJGISExternalCommandRegistry,
  IJGISExternalCommandRegistryToken,
  IJGISFormSchemaRegistry,
  IJGISFormSchemaRegistryToken,
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

import { JupyterGISFormSchemaRegistry } from './schemaregistry';
import { JupyterGISExternalCommandRegistry } from './externalcommand';

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
    requires: [],
    provides: IJGISFormSchemaRegistryToken,
    activate: (app: JupyterFrontEnd): IJGISFormSchemaRegistry => {
      const registry = new JupyterGISFormSchemaRegistry();
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
