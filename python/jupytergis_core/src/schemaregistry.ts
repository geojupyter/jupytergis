import { IDict, IJGISFormSchemaRegistry } from '@jupytergis/schema';
import formSchema from '@jupytergis/schema/lib/_interface/forms.json';
import { IDocumentManager } from '@jupyterlab/docmanager';

export class JupyterGISFormSchemaRegistry implements IJGISFormSchemaRegistry {
  private _docManager: IDocumentManager;

  constructor(docManager: IDocumentManager) {
    this._registry = new Map<string, IDict>(Object.entries(formSchema));
    this._docManager = docManager;
  }

  registerSchema(name: string, schema: IDict): void {
    if (!this._registry.has(name)) {
      this._registry.set(name, schema);
    } else {
      console.error('Worker is already registered!');
    }
  }

  has(name: string): boolean {
    return this._registry.has(name);
  }

  getSchemas(): Map<string, IDict> {
    return this._registry;
  }

  getDocManager(): IDocumentManager {
    return this._docManager;
  }

  private _registry: Map<string, IDict>;
}
