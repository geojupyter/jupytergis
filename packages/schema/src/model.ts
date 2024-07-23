import { ICollaborativeDrive } from '@jupyter/docprovider';
import { MapChange } from '@jupyter/ydoc';
import { IChangedArgs, PathExt } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { PartialJSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import Ajv from 'ajv';

import { GeoJSON } from './_interface/geojsonsource';
import {
  IJGISContent,
  IJGISLayer,
  IJGISLayerGroup,
  IJGISLayerItem,
  IJGISLayerTree,
  IJGISLayers,
  IJGISOptions,
  IJGISSource,
  IJGISSources,
  IJGISTerrain
} from './_interface/jgis';
import { JupyterGISDoc } from './doc';
import {
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
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

  get sharedLayerTreeChanged(): ISignal<
    IJupyterGISDoc,
    IJGISLayerTreeDocChange
  > {
    return this.sharedModel.layerTreeChanged;
  }

  get sharedSourcesChanged(): ISignal<IJupyterGISDoc, IJGISSourceDocChange> {
    return this.sharedModel.sourcesChanged;
  }

  get terrainChanged(): ISignal<IJupyterGISDoc, IJGISTerrain> {
    return this.sharedModel.terrainChanged;
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
      this.sharedModel.layerTree = jsonData.layerTree ?? [];
      this.sharedModel.terrain = jsonData.terrain ?? {
        source: '',
        exaggeration: 1
      };
      this.sharedModel.options = jsonData.options ?? {
        latitude: 0,
        longitude: 0,
        zoom: 0
      };
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
      layerTree: this.sharedModel.layerTree,
      options: this.sharedModel.options,
      terrain: this.sharedModel.terrain
    };
  }

  setDrive(value: ICollaborativeDrive, filePath: string): void {
    this._drive = value;
    this._filePath = filePath;
  }

  getLayers(): IJGISLayers {
    return this.sharedModel.layers;
  }

  getSources(): IJGISSources {
    return this.sharedModel.sources;
  }

  getLayerTree(): IJGISLayerTree {
    return this.sharedModel.layerTree;
  }

  getLayer(id: string): IJGISLayer | undefined {
    return this.sharedModel.getLayer(id);
  }

  getSource(id: string): IJGISSource | undefined {
    return this.sharedModel.getSource(id);
  }

  /**
   * Get a {[key: id]: name} dictionary of sources for a given source type
   * @param type The required source type
   */
  getSourcesByType(type: string): { [key: string]: string } {
    const sources: { [key: string]: string } = {};
    for (const sourceId of Object.keys(this.getSources() || {})) {
      const source = this.getSource(sourceId);
      if (source?.type === type) {
        sources[sourceId] = source.name;
      }
    }
    return sources;
  }

  /**
   * Get the list of layers using a source.
   *
   * @param id - the source id.
   * @returns a list of layer ids that use the source.
   */
  getLayersBySource(id: string): string[] {
    const usingLayers: string[] = [];
    Object.entries(this.getLayers() || {}).forEach(([layerId, layer]) => {
      if (layer.parameters?.source === id) {
        usingLayers.push(layerId);
      }
    });
    return usingLayers;
  }

  /**
   * Read a GeoJSON file.
   *
   * @param filepath - the path of the GeoJSON file.
   * @returns a promise to the GeoJSON data.
   */
  async readGeoJSON(filepath: string): Promise<GeoJSON | undefined> {
    if (!this._drive) {
      return;
    }

    let dir = PathExt.dirname(this._filePath);
    if (dir.includes(':')) {
      dir = dir.split(':')[1];
    }
    const absolutePath = PathExt.join(dir, filepath);

    return this._drive
      .get(absolutePath)
      .then(contentModel => {
        return JSON.parse(contentModel.content);
      })
      .catch(e => {
        throw e;
      });
  }

  /**
   * Add a layer group in the layer tree.
   *
   * @param name - the name of the group.
   * @param groupName - (optional) the name of the parent group in which to include the
   *   new group.
   * @param position - (optional) the index of the new group in its parent group or
   *   from root of layer tree.
   */
  addGroup(name: string, groupName?: string, position?: number): void {
    const indexesPath = Private.findGroupPath(this.getLayerTree(), name);
    if (indexesPath.length) {
      console.warn(`The group "${groupName}" already exist in the layer tree`);
      return;
    }
    const item: IJGISLayerGroup = {
      name,
      layers: []
    };
    this._addLayerTreeItem(item, groupName, position);
  }

  /**
   * Add a layer in the layer tree and the layers list.
   *
   * @param id - the ID of the layer.
   * @param layer - the layer object.
   * @param groupName - (optional) the name of the group in which to include the new
   *   layer.
   * @param position - (optional) the index of the new layer in its parent group or
   *   from root of layer tree.
   */
  addLayer(
    id: string,
    layer: IJGISLayer,
    groupName?: string,
    position?: number
  ): void {
    if (!this.getLayer(id)) {
      this.sharedModel.addLayer(id, layer);
    }

    this._addLayerTreeItem(id, groupName, position);
  }

  setTerrain(terrain: IJGISTerrain) {
    this._sharedModel.terrain = terrain;
  }

  setOptions(value: IJGISOptions) {
    this._sharedModel.options = value;
  }

  getOptions(): IJGISOptions {
    return this._sharedModel.options;
  }

  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('selected', {
      value,
      emitter: emitter
    });
  }

  setUserToFollow(userId?: number): void {
    if (this._sharedModel) {
      this._sharedModel.awareness.setLocalStateField('remoteUser', userId);
    }
  }

  getClientId(): number {
    return this.sharedModel.awareness.clientID;
  }

  /**
   * Add an item in the layer tree.
   *
   * @param item - the item to add.
   * @param groupName - (optional) the name of the parent group in which to include the
   *   new item.
   * @param index - (optional) the index of the new item in its parent group or
   *   from root of layer tree.
   */
  private _addLayerTreeItem(
    item: IJGISLayerItem,
    groupName?: string,
    index?: number
  ): void {
    if (groupName) {
      const layerTreeInfo = this._getLayerTreeInfo(groupName);

      if (layerTreeInfo) {
        layerTreeInfo.workingGroup.layers.splice(
          index ?? layerTreeInfo.workingGroup.layers.length,
          0,
          item
        );

        this._sharedModel.updateLayerTreeItem(
          layerTreeInfo.mainGroupIndex,
          layerTreeInfo.mainGroup
        );
      }
    } else {
      this.sharedModel.addLayerTreeItem(
        index ?? this.getLayerTree().length,
        item
      );
    }
  }

  moveSelectedLayersToGroup(
    selected: { [key: string]: ISelection },
    groupName: string
  ) {
    const layerTree = this.getLayerTree();
    for (const item in selected) {
      this._removeLayerTreeLayer(layerTree, item);
    }

    for (const item in selected) {
      this._addLayerTreeItem(item, groupName);
    }
  }

  addNewLayerGroup(
    selected: { [key: string]: ISelection },
    group: IJGISLayerGroup
  ) {
    const layerTree = this.getLayerTree();
    for (const item in selected) {
      this._removeLayerTreeLayer(layerTree, item);
    }

    this._addLayerTreeItem(group);
  }

  private _removeLayerTreeLayer(
    layerTree: IJGISLayerTree,
    layerIdToRemove: string
  ) {
    // Iterate over each item in the layerTree
    for (let i = 0; i < layerTree.length; i++) {
      const currentItem = layerTree[i];

      // Check if the current item is a string and matches the target
      if (typeof currentItem === 'string' && currentItem === layerIdToRemove) {
        // Remove the item from the array
        layerTree.splice(i, 1);
        // Decrement i to ensure the next iteration processes the remaining items correctly
        i--;
      } else if (typeof currentItem !== 'string' && 'layers' in currentItem) {
        // If the current item is a group, recursively call the function on its layers
        this._removeLayerTreeLayer(currentItem.layers, layerIdToRemove);
      }
    }

    this.sharedModel.layerTree = layerTree;
  }

  renameLayerGroup(groupName: string, newName: string): void {
    const layerTreeInfo = this._getLayerTreeInfo(groupName);

    if (layerTreeInfo) {
      layerTreeInfo.workingGroup.name = newName;
      this._sharedModel.updateLayerTreeItem(
        layerTreeInfo.mainGroupIndex,
        layerTreeInfo.mainGroup
      );
    } else {
      console.log('Something went wrong when renaming layer');
    }
  }

  removeLayerGroup(groupName: string) {
    const layerTree = this.getLayerTree();
    const layerTreeInfo = this._getLayerTreeInfo(groupName);
    const updatedLayerTree = removeLayerGroupEntry(layerTree, groupName);

    function removeLayerGroupEntry(
      layerTree: IJGISLayerItem[],
      groupName: string
    ): IJGISLayerItem[] {
      const result: IJGISLayerItem[] = [];

      for (const item of layerTree) {
        if (typeof item === 'string') {
          result.push(item); // Push layer IDs directly
        } else if (item.name !== groupName) {
          const filteredLayers = removeLayerGroupEntry(item.layers, groupName);
          result.push({ ...item, layers: filteredLayers }); // Update layers with filtered list
        }
      }

      return result;
    }

    if (layerTreeInfo) {
      this._sharedModel.updateLayerTreeItem(
        layerTreeInfo.mainGroupIndex,
        updatedLayerTree[layerTreeInfo.mainGroupIndex]
      );
    }
  }

  private _getLayerTreeInfo(groupName: string):
    | {
        mainGroup: IJGISLayerGroup;
        workingGroup: IJGISLayerGroup;
        mainGroupIndex: number;
      }
    | undefined {
    const layerTree = this.getLayerTree();
    const indexesPath = Private.findGroupPath(layerTree, groupName);
    if (!indexesPath.length) {
      console.warn(`The group "${groupName}" does not exist in the layer tree`);
      return;
    }

    const mainGroupIndex = indexesPath.shift();
    if (mainGroupIndex === undefined) {
      return;
    }
    const mainGroup = layerTree[mainGroupIndex] as IJGISLayerGroup;
    let workingGroup = mainGroup;
    while (indexesPath.length) {
      const groupIndex = indexesPath.shift();
      if (groupIndex === undefined) {
        break;
      }
      workingGroup = workingGroup.layers[groupIndex] as IJGISLayerGroup;
    }

    return {
      mainGroup,
      workingGroup,
      mainGroupIndex
    };
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
  private _filePath: string;
  private _drive?: ICollaborativeDrive;
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
    return Private.layerTreeRecursion(model.sharedModel.layerTree);
  }
}

namespace Private {
  /**
   * Recursive function through the layer tree to retrieve the flattened layers order.
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
   * Recursive function through the layer tree to retrieve the indexes path to a group.
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
        const foundIndexes = findGroupPath(
          item.layers,
          groupName,
          workingIndexes
        );
        if (foundIndexes.length > workingIndexes.length) {
          return foundIndexes;
        }
      }
    }
    return indexes;
  }
}
