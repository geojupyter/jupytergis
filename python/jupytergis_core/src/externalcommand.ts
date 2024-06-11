import {
  IJCadExternalCommand,
  IJCadExternalCommandRegistry
} from '@jupytergis/schema';

export class JupyterCadExternalCommandRegistry
  implements IJCadExternalCommandRegistry
{
  constructor() {
    this._registry = new Set();
  }

  registerCommand(cmd: IJCadExternalCommand): void {
    this._registry.add(cmd);
  }

  getCommands(): IJCadExternalCommand[] {
    return [...this._registry];
  }

  private _registry: Set<IJCadExternalCommand>;
}
