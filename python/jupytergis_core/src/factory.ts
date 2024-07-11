import { ICollaborativeDrive } from '@jupyter/docprovider';
import {
  JupyterGISModel,
  IJupyterGISTracker,
  IJGISExternalCommandRegistry
} from '@jupytergis/schema';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { CommandRegistry } from '@lumino/commands';

import {
  JupyterGISPanel,
  JupyterGISWidget,
  ToolbarWidget
} from '@jupytergis/base';

interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
  tracker: IJupyterGISTracker;
  commands: CommandRegistry;
  externalCommandRegistry: IJGISExternalCommandRegistry;
  backendCheck?: () => boolean;
  drive?: ICollaborativeDrive | null;
}

export class JupyterGISWidgetFactory extends ABCWidgetFactory<
  JupyterGISWidget,
  JupyterGISModel
> {
  constructor(options: IOptions) {
    const { backendCheck, externalCommandRegistry, ...rest } = options;
    super(rest);
    this._backendCheck = backendCheck;
    this._commands = options.commands;
    this._externalCommandRegistry = externalCommandRegistry;
    this._drive = options.drive;
  }

  /**
   * Create a new widget given a context.
   *
   * @param context Contains the information of the file
   * @returns The widget
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<JupyterGISModel>
  ): JupyterGISWidget {
    if (this._backendCheck) {
      const checked = this._backendCheck();
      if (!checked) {
        throw new Error('Requested backend is not installed');
      }
    }
    const { model } = context;
    if (this._drive) {
      model.setDrive(this._drive, context.path);
    }

    const content = new JupyterGISPanel({
      model
    });
    const toolbar = new ToolbarWidget({
      commands: this._commands,
      model,
      externalCommands: this._externalCommandRegistry.getCommands()
    });
    return new JupyterGISWidget({ context, content, toolbar });
  }

  private _commands: CommandRegistry;
  private _externalCommandRegistry: IJGISExternalCommandRegistry;
  private _backendCheck?: () => boolean;
  private _drive?: ICollaborativeDrive | null;
}
