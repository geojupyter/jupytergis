import { JupyterCadWidget } from '@jupytergis/base';
import {
  IJCadExternalCommandRegistry,
  IJCadExternalCommandRegistryToken,
  IJCadFormSchemaRegistry,
  IJCadFormSchemaRegistryToken,
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
