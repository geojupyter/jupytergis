import {
  IJGISExternalCommand,
  IJGISExternalCommandRegistry
} from '@jupytergis/schema';

export class JupyterGISExternalCommandRegistry
  implements IJGISExternalCommandRegistry
{
  constructor() {
    this._registry = new Set();
  }

  registerCommand(cmd: IJGISExternalCommand): void {
    this._registry.add(cmd);
  }

  getCommands(): IJGISExternalCommand[] {
    return [...this._registry];
  }

  private _registry: Set<IJGISExternalCommand>;
}
