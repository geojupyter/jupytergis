import {
  JupyterCadModel,
  IJupyterCadTracker,
  IJCadExternalCommandRegistry
} from '@jupytergis/schema';
import { ABCWidgetFactory, DocumentRegistry } from '@jupyterlab/docregistry';
import { CommandRegistry } from '@lumino/commands';

import {
  JupyterCadPanel,
  JupyterCadWidget,
  ToolbarWidget
} from '@jupytergis/base';

interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
  tracker: IJupyterCadTracker;
  commands: CommandRegistry;
  externalCommandRegistry: IJCadExternalCommandRegistry;
  backendCheck?: () => boolean;
}

export class JupyterCadWidgetFactory extends ABCWidgetFactory<
  JupyterCadWidget,
  JupyterCadModel
> {
  constructor(options: IOptions) {
    const { backendCheck, externalCommandRegistry, ...rest } = options;
    super(rest);
    this._backendCheck = backendCheck;
    this._commands = options.commands;
    this._externalCommandRegistry = externalCommandRegistry;
  }

  /**
   * Create a new widget given a context.
   *
   * @param context Contains the information of the file
   * @returns The widget
   */
  protected createNewWidget(
    context: DocumentRegistry.IContext<JupyterCadModel>
  ): JupyterCadWidget {
    if (this._backendCheck) {
      const checked = this._backendCheck();
      if (!checked) {
        throw new Error('Requested backend is not installed');
      }
    }
    const { model } = context;
    const content = new JupyterCadPanel({
      model
    });
    const toolbar = new ToolbarWidget({
      commands: this._commands,
      model,
      externalCommands: this._externalCommandRegistry.getCommands()
    });
    return new JupyterCadWidget({ context, content, toolbar });
  }

  private _commands: CommandRegistry;
  private _externalCommandRegistry: IJCadExternalCommandRegistry;
  private _backendCheck?: () => boolean;
}
