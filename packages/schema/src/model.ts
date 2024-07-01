import { MapChange } from '@jupyter/ydoc';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { PartialJSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import Ajv from 'ajv';

import {
  IJGISContent,
  IJGISLayer,
  IJGISLayerItem,
  IJGISLayers,
  IJGISLayersGroup,
  IJGISLayersTree,
  IJGISSource,
  IJGISSources
} from './_interface/jgis';
import { JupyterGISDoc } from './doc';
import {
  IJGISLayerDocChange,
  IJGISLayersTreeDocChange,
  IJGISSourceDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  ISelection,
  IUserData
} from './interfaces';
import jgisSchema from './schema/jgis.json';

export class JupyterGISModel implements IJupyterGISModel {
  constructor(options: DocumentRegistry.IModelOptions<IJupyterGISDoc>) {
    const { sharedModel } = options;
    if (sharedModel) {
      this._sharedModel = sharedModel;
    } else {
      this._sharedModel = JupyterGISDoc.create();
      this._sharedModel.changed.connect(this._onSharedModelChanged);
    }
    this.sharedModel.awareness.on('change', this._onClientStateChanged);
  }

  private _onSharedModelChanged = (sender: any, changes: any): void => {
    if (changes && changes?.objectChange?.length) {
      this._contentChanged.emit(void 0);
      this.dirty = true;
    }
  };

  readonly collaborative = true;

  get sharedModel(): IJupyterGISDoc {
    return this._sharedModel;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get contentChanged(): ISignal<this, void> {
    return this._contentChanged;
  }

  get stateChanged(): ISignal<this, IChangedArgs<any, any, string>> {
    return this._stateChanged;
  }

  get themeChanged(): Signal<
    this,
    IChangedArgs<string, string | null, string>
  > {
    return this._themeChanged;
  }

  get currentUserId(): number | undefined {
    return this.sharedModel?.awareness.clientID;
  }

  get users(): IUserData[] {
    this._usersMap = this._sharedModel?.awareness.getStates();
    const users: IUserData[] = [];
    if (this._usersMap) {
      this._usersMap.forEach((val, key) => {
        users.push({ userId: key, userData: val.user });
      });
    }
    return users;
  }

  get userChanged(): ISignal<this, IUserData[]> {
    return this._userChanged;
  }

  get dirty(): boolean {
    return this._dirty;
  }
  set dirty(value: boolean) {
    this._dirty = value;
  }

  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(value: boolean) {
    this._readOnly = value;
  }

  get localState(): IJupyterGISClientState | null {
    return this.sharedModel.awareness.getLocalState() as IJupyterGISClientState | null;
  }

  get clientStateChanged(): ISignal<this, Map<number, IJupyterGISClientState>> {
    return this._clientStateChanged;
  }

  get sharedOptionsChanged(): ISignal<IJupyterGISDoc, MapChange> {
    return this.sharedModel.optionsChanged;
  }

  get sharedLayersChanged(): ISignal<IJupyterGISDoc, IJGISLayerDocChange> {
    return this.sharedModel.layersChanged;
  }

  get sharedLayersTreeChanged(): ISignal<
    IJupyterGISDoc,
    IJGISLayersTreeDocChange
  > {
    return this.sharedModel.layersTreeChanged;
  }

  get sharedSourcesChanged(): ISignal<IJupyterGISDoc, IJGISSourceDocChange> {
    return this.sharedModel.sourcesChanged;
  }

  get disposed(): ISignal<JupyterGISModel, void> {
    return this._disposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._sharedModel.dispose();
    this._disposed.emit();
    Signal.clearData(this);
  }

  toString(): string {
    return JSON.stringify(this.getContent(), null, 2);
  }

  fromString(data: string): void {
    const jsonData: IJGISContent = JSON.parse(data);
    const ajv = new Ajv();
    const validate = ajv.compile(jgisSchema);
    const valid = validate(jsonData);

    if (!valid) {
      throw Error('File format error');
    }

    this.sharedModel.transact(() => {
      this.sharedModel.sources = jsonData.sources ?? {};
      this.sharedModel.layers = jsonData.layers ?? {};
      this.sharedModel.layersTree = jsonData.layersTree ?? [];
      this.sharedModel.options = jsonData.options ?? {};
    });
    this.dirty = true;
  }

  toJSON(): PartialJSONObject {
    return JSON.parse(this.toString());
  }

  fromJSON(data: PartialJSONObject): void {
    // nothing to do
  }

  initialize(): void {
    //
  }

  getWorker(): Worker {
    return JupyterGISModel.worker;
  }

  getContent(): IJGISContent {
    return {
      sources: this.sharedModel.sources,
      layers: this.sharedModel.layers,
      layersTree: this.sharedModel.layersTree,
      options: this.sharedModel.options
    };
  }

  getLayers(): IJGISLayers {
    return this.sharedModel.layers;
  }

  getSources(): IJGISSources {
    return this.sharedModel.sources;
  }

  getLayersTree(): IJGISLayersTree {
    return this.sharedModel.layersTree;
  }

  getLayer(id: string): IJGISLayer | undefined {
    return this.sharedModel.getLayer(id);
  }

  getSource(id: string): IJGISSource | undefined {
    return this.sharedModel.getSource(id);
  }

  addGroup(name: string, groupName?: string, position?: number): void {
    const item: IJGISLayersGroup = {
      name,
      layers: []
    };
    this._addLayersTreeItem(item, groupName, position);
  }

  addLayer(id: string, layer: IJGISLayer, groupName?: string, position?: number): void {
    if (!this.getLayer(id)) {
      this.sharedModel.addLayer(id, layer);
    }

    this._addLayersTreeItem(id, groupName, position);
  }

  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('selected', {
      value,
      emitter: emitter
    });
  }

  syncSelectedPropField(data: {
    id: string | null;
    value: any;
    parentType: 'panel' | 'dialog';
  }): void {
    this.sharedModel.awareness.setLocalStateField('selectedPropField', data);
  }

  setUserToFollow(userId?: number): void {
    if (this._sharedModel) {
      this._sharedModel.awareness.setLocalStateField('remoteUser', userId);
    }
  }

  syncFormData(form: any): void {
    if (this._sharedModel) {
      this._sharedModel.awareness.setLocalStateField('toolbarForm', form);
    }
  }

  getClientId(): number {
    return this.sharedModel.awareness.clientID;
  }

  private _addLayersTreeItem(item: IJGISLayerItem, groupName?: string, index?: number) {
    if (groupName) {
      const layersTree = this.getLayersTree();
      const indexesPath = Private.findGroupPath(layersTree, groupName);
      if (!indexesPath.length) {
        console.warn(`The group "${groupName}" does not exist in the layers tree`);
        return;
      }

      const mainGroupIndex = indexesPath.shift();
      if (mainGroupIndex === undefined) {
        return;
      }
      const mainGroup = layersTree[mainGroupIndex] as IJGISLayersGroup;
      let workingGroup = mainGroup;
      while(indexesPath.length) {
        const groupIndex = indexesPath.shift();
        if (groupIndex === undefined) {
          break;
        }
        workingGroup = workingGroup.layers[groupIndex] as IJGISLayersGroup;
      }
      workingGroup.layers.splice(index ?? workingGroup.layers.length, 0, item);

      this._sharedModel.updateLayersTreeItem(mainGroupIndex, mainGroup);
    } else {
      this.sharedModel.addLayersTreeItem(index ?? this.getLayersTree.length, item);
    }
  }

  private _onClientStateChanged = changed => {
    const clients = this.sharedModel.awareness.getStates() as Map<
      number,
      IJupyterGISClientState
    >;

    this._clientStateChanged.emit(clients);

    this._sharedModel.awareness.on('change', update => {
      if (update.added.length || update.removed.length) {
        this._userChanged.emit(this.users);
      }
    });
  };

  readonly defaultKernelName: string = '';
  readonly defaultKernelLanguage: string = '';

  private _sharedModel: IJupyterGISDoc;

  private _dirty = false;
  private _readOnly = false;
  private _isDisposed = false;

  private _userChanged = new Signal<this, IUserData[]>(this);
  private _usersMap?: Map<number, any>;

  private _disposed = new Signal<this, void>(this);
  private _contentChanged = new Signal<this, void>(this);
  private _stateChanged = new Signal<this, IChangedArgs<any>>(this);
  private _themeChanged = new Signal<this, IChangedArgs<any>>(this);
  private _clientStateChanged = new Signal<
    this,
    Map<number, IJupyterGISClientState>
  >(this);

  static worker: Worker;
}

export namespace JupyterGISModel {
  /**
   * Function to get the ordered list of layers according to the tree.
   */
  export function getOrderedLayerIds(model: IJupyterGISModel): string[] {
    return Private.layerTreeRecursion(model.sharedModel.layersTree);
  }
}

namespace Private {
  /**
   * Recursive function through the layers tree to retrieve the flattened layers order.
   *
   * @param items - the items list being scanned.
   * @param current - the current flattened layers.
   */
  export function layerTreeRecursion(
    items: IJGISLayerItem[],
    current: string[] = []
  ): string[] {
    for (const layer of items) {
      if (typeof layer === 'string') {
        current.push(layer);
      } else {
        current.push(...layerTreeRecursion(layer.layers));
      }
    }
    return current;
  }

  /**
   * Recursive function through the layers tree to retrieve the indexes path to a group.
   *
   * @param items - the items list being scanned.
   * @param groupName - the target group name.
   * @param indexes - the current indexes path to the group
   */
  export function findGroupPath(
    items: IJGISLayerItem[],
    groupName: string,
    indexes: number[] = []
  ): number[] {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (typeof item === 'string') {
        continue;
      } else {
        const workingIndexes = [...indexes];
        workingIndexes.push(index);
        if (item.name === groupName) {
          return workingIndexes;
        }
        const foundIndexes = findGroupPath(item.layers, groupName, workingIndexes);
        if (foundIndexes.length > workingIndexes.length) {
          return foundIndexes;
        }
      }
    }
    return indexes;
  }
}
