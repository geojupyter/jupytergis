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

import { JupyterCadFormSchemaRegistry } from './schemaregistry';
import { JupyterCadExternalCommandRegistry } from './externalcommand';

const NAME_SPACE = 'jupytercad';

export const trackerPlugin: JupyterFrontEndPlugin<IJupyterGISTracker> = {
  id: 'jupytercad:core:tracker',
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
    console.log('jupytercad:core:tracker is activated!');
    return tracker;
  }
};

export const formSchemaRegistryPlugin: JupyterFrontEndPlugin<IJGISFormSchemaRegistry> =
  {
    id: 'jupytercad:core:form-schema-registry',
    autoStart: true,
    requires: [],
    provides: IJGISFormSchemaRegistryToken,
    activate: (app: JupyterFrontEnd): IJGISFormSchemaRegistry => {
      const registry = new JupyterCadFormSchemaRegistry();
      return registry;
    }
  };

export const externalCommandRegistryPlugin: JupyterFrontEndPlugin<IJGISExternalCommandRegistry> =
  {
    id: 'jupytercad:core:external-command-registry',
    autoStart: true,
    requires: [],
    provides: IJGISExternalCommandRegistryToken,
    activate: (app: JupyterFrontEnd): IJGISExternalCommandRegistry => {
      const registry = new JupyterCadExternalCommandRegistry();
      return registry;
    }
  };
