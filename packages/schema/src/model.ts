import { MapChange } from '@jupyter/ydoc';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { PartialJSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import Ajv from 'ajv';
import { Contents } from '@jupyterlab/services';
import {
  IJGISContent,
  IJGISLayer,
  IJGISLayerGroup,
  IJGISLayerItem,
  IJGISLayerTree,
  IJGISLayers,
  IJGISOptions,
  IJGISSource,
  IJGISSources
} from './_interface/jgis';
import { JupyterGISDoc } from './doc';
import {
  IAnnotationModel,
  IDict,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISSourceDocChange,
  IJupyterGISClientState,
  IJupyterGISDoc,
  IJupyterGISModel,
  ISelection,
  IUserData,
  IViewPortState,
  Pointer
} from './interfaces';
import jgisSchema from './schema/jgis.json';

export class JupyterGISModel implements IJupyterGISModel {
  constructor(options: JupyterGISModel.IOptions) {
    const { annotationModel, sharedModel } = options;

    if (sharedModel) {
      this._sharedModel = sharedModel;
    } else {
      this._sharedModel = JupyterGISDoc.create();
      this._sharedModel.changed.connect(this._onSharedModelChanged);
    }
    this.sharedModel.awareness.on('change', this._onClientStateChanged);
    this._sharedModel.metadataChanged.connect(
      this._metadataChangedHandler,
      this
    );
    this.annotationModel = annotationModel;
  }

  private _onSharedModelChanged = (sender: any, changes: any): void => {
    if (changes && changes?.objectChange?.length) {
      this._contentChanged.emit(void 0);
      this.dirty = true;
    }
  };

  readonly collaborative =
    document.querySelectorAll('[data-jupyter-lite-root]')[0] === undefined;

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

  get disposed(): ISignal<JupyterGISModel, void> {
    return this._disposed;
  }

  get sharedMetadataChanged(): ISignal<this, MapChange> {
    return this._sharedMetadataChanged;
  }

  get zoomToPositionSignal(): ISignal<this, string> {
    return this._zoomToPositionSignal;
  }

  set isIdentifying(isIdentifying: boolean) {
    this._isIdentifying = isIdentifying;
  }

  get isIdentifying(): boolean {
    return this._isIdentifying;
  }

  set isTemporal(isTemporal: boolean) {
    this._isTemporal = isTemporal;
  }

  get isTemporal(): boolean {
    return this._isTemporal;
  }

  centerOnPosition(id: string) {
    this._zoomToPositionSignal.emit(id);
  }

  private _metadataChangedHandler(_: IJupyterGISDoc, args: MapChange) {
    this._sharedMetadataChanged.emit(args);
  }

  addMetadata(key: string, value: string): void {
    this.sharedModel.setMetadata(key, value);
  }

  removeMetadata(key: string): void {
    this.sharedModel.removeMetadata(key);
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
      let errorMsg = 'JupyterGIS format errors:\n';
      for (const error of validate.errors || []) {
        errorMsg = `${errorMsg}- ${error.instancePath} ${error.message}\n`;
      }
      console.warn(errorMsg);
    }

    this.sharedModel.transact(() => {
      this.sharedModel.sources = jsonData.sources ?? {};
      this.sharedModel.layers = jsonData.layers ?? {};
      this.sharedModel.layerTree = jsonData.layerTree ?? [];
      this.sharedModel.options = jsonData.options ?? {
        latitude: 0,
        longitude: 0,
        zoom: 0,
        bearing: 0,
        pitch: 0,
        projection: 'EPSG:3857'
      };
      this.sharedModel.metadata = jsonData.metadata ?? {};
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
      metadata: this.sharedModel.metadata
    };
  }

  /**
   * Getter for the contents manager.
   */
  get contentsManager(): Contents.IManager | undefined {
    return this._contentsManager;
  }

  /**
   * Setter for the contents manager.
   * Also updates the file path.
   */
  set contentsManager(manager: Contents.IManager | undefined) {
    this._contentsManager = manager;
  }

  /**
   * Getter for the file path associated with the contents manager.
   */
  get filePath(): string {
    return this._filePath;
  }

  /**
   * Setter for the file path associated with the contents manager.
   */
  set filePath(path: string) {
    this._filePath = path;
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
    return this.sharedModel.getLayerSource(id);
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
   * Add a layer group in the layer tree.
   *
   * @param name - the name of the group.
   * @param groupName - (optional) the name of the parent group in which to include the
   *   new group.
   * @param position - (optional) the index of the new group in its parent group or
   *   from root of layer tree.
   */
  addGroup(name: string, groupName?: string, position?: number): void {
    const indexesPath = Private.findItemPath(this.getLayerTree(), name);
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

  removeLayer(layer_id: string) {
    this._removeLayerTreeLayer(this.getLayerTree(), layer_id);
    this.sharedModel.removeLayer(layer_id);
  }

  setOptions(value: IJGISOptions) {
    this._sharedModel.options = value;
  }

  getOptions(): IJGISOptions {
    return this._sharedModel.options;
  }

  syncViewport(viewport?: IViewPortState, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('viewportState', {
      value: viewport,
      emitter
    });
  }

  syncPointer(pointer?: Pointer, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('pointer', {
      value: pointer,
      emitter
    });
  }

  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('selected', {
      value,
      emitter
    });
  }

  syncIdentifiedFeatures(features: IDict<any>, emitter?: string): void {
    this.sharedModel.awareness.setLocalStateField('identifiedFeatures', {
      value: features,
      emitter
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

  moveItemsToGroup(items: string[], groupName: string, index?: number) {
    const layerTree = this.getLayerTree();
    for (const item of items) {
      if (this.getLayer(item)) {
        // the item is a layer, remove and add it at the correct position.
        this._removeLayerTreeLayer(layerTree, item);
        this._addLayerTreeItem(item, groupName, index);
      } else {
        // the item is a group, let's copy it before removing it.
        const treeInfo = this._getLayerTreeInfo(item);
        if (treeInfo === undefined) {
          continue;
        }
        const group = { ...treeInfo.workingGroup };
        this._removeLayerTreeGroup(layerTree, item);
        this._addLayerTreeItem(group, groupName, index);
      }
    }
  }

  moveItemRelatedTo(item: string, relativeItem: string, after: boolean) {
    const layerTree = this.getLayerTree();
    let insertedItem: string | IJGISLayerGroup;
    if (this.getLayer(item)) {
      this._removeLayerTreeLayer(layerTree, item);
      insertedItem = item;
    } else {
      const treeInfo = this._getLayerTreeInfo(item);
      if (treeInfo === undefined) {
        return;
      }
      insertedItem = { ...treeInfo.workingGroup };
      this._removeLayerTreeGroup(layerTree, item);
    }
    const indexesPath = Private.findItemPath(layerTree, relativeItem);
    const insertedIndex = (indexesPath.pop() ?? 0) + (after ? 1 : 0);
    let parentGroupName = '';
    let workingGroupId = indexesPath.shift();
    if (workingGroupId !== undefined) {
      let workingGroup = layerTree[workingGroupId] as IJGISLayerGroup;
      while (indexesPath.length) {
        workingGroupId = indexesPath.shift();
        if (workingGroupId === undefined) {
          break;
        }
        workingGroup = workingGroup.layers[workingGroupId] as IJGISLayerGroup;
      }
      parentGroupName = workingGroup.name;
    }
    this._addLayerTreeItem(insertedItem, parentGroupName, insertedIndex);
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
    layerTree: IJGISLayerItem[],
    layerIdToRemove: string
  ) {
    this._removeLayerTreeItem(layerTree, layerIdToRemove, true);
    this.sharedModel.layerTree = layerTree;
  }

  private _removeLayerTreeGroup(
    layerTree: IJGISLayerItem[],
    groupName: string
  ) {
    this._removeLayerTreeItem(layerTree, groupName, false);
    this.sharedModel.layerTree = layerTree;
  }

  private _removeLayerTreeItem(
    layerTree: IJGISLayerItem[],
    target: string,
    isLayer: boolean
  ) {
    // Iterate over each item in the layerTree
    for (let i = 0; i < layerTree.length; i++) {
      const currentItem = layerTree[i];
      const matches = isLayer
        ? typeof currentItem === 'string' && currentItem === target
        : typeof currentItem !== 'string' && currentItem.name === target;

      // Check if the current item is a string and matches the target
      if (matches) {
        // Remove the item from the array
        layerTree.splice(i, 1);
        // Decrement i to ensure the next iteration processes the remaining items correctly
        i--;
      } else if (typeof currentItem !== 'string' && 'layers' in currentItem) {
        // If the current item is a group, recursively call the function on its layers
        this._removeLayerTreeItem(currentItem.layers, target, isLayer);
      }
    }
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

  toggleIdentify() {
    this._isIdentifying = !this._isIdentifying;
  }

  toggleTemporal(emitter: string) {
    this._isTemporal = !this._isTemporal;

    this.sharedModel.awareness.setLocalStateField('isTemporal', {
      value: this._isTemporal,
      emitter
    });
  }

  private _getLayerTreeInfo(groupName: string):
    | {
        mainGroup: IJGISLayerGroup;
        workingGroup: IJGISLayerGroup;
        mainGroupIndex: number;
      }
    | undefined {
    const layerTree = this.getLayerTree();
    const indexesPath = Private.findItemPath(layerTree, groupName);
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

  private _onClientStateChanged = (changed: any) => {
    const clients = this.sharedModel.awareness.getStates() as Map<
      number,
      IJupyterGISClientState
    >;

    this._clientStateChanged.emit(clients);

    if (changed.added.length || changed.removed.length) {
      this._userChanged.emit(this.users);
    }
  };

  addTimeFeature = (id: string, selectedFeature: string) => {
    this.addFeaturesSignal.emit(JSON.stringify({ id, selectedFeature }));
  };

  get addFeaturesSignal() {
    return this._addFeaturesSignal;
  }

  get updateLayersSignal() {
    return this._updateLayersSignal;
  }

  updateLayersOnCommand = (layerId: string, layer: IJGISLayer) => {
    this.updateLayersSignal.emit(JSON.stringify({ layerId, layer }));
  };

  readonly defaultKernelName: string = '';
  readonly defaultKernelLanguage: string = '';
  readonly annotationModel?: IAnnotationModel;

  private _sharedModel: IJupyterGISDoc;
  private _filePath: string;
  private _contentsManager?: Contents.IManager;
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
  private _sharedMetadataChanged = new Signal<this, MapChange>(this);
  private _zoomToPositionSignal = new Signal<this, string>(this);

  private _addFeaturesSignal = new Signal<this, string>(this);

  private _updateLayersSignal = new Signal<this, string>(this);

  private _isIdentifying = false;
  private _isTemporal = false;

  static worker: Worker;
}

export namespace JupyterGISModel {
  /**
   * Function to get the ordered list of layers according to the tree.
   */
  export function getOrderedLayerIds(model: IJupyterGISModel): string[] {
    return Private.layerTreeRecursion(model.sharedModel.layerTree);
  }

  export interface IOptions
    extends DocumentRegistry.IModelOptions<IJupyterGISDoc> {
    annotationModel?: IAnnotationModel;
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
   * Recursive function through the layer tree to retrieve the indexes path to a group
   * or a layer.
   *
   * @param items - the items list being scanned.
   * @param itemId - the target group name or layer ID.
   * @param indexes - the current indexes path to the group
   */
  export function findItemPath(
    items: IJGISLayerItem[],
    itemId: string,
    indexes: number[] = []
  ): number[] {
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (typeof item === 'string') {
        if (item === itemId) {
          const workingIndexes = [...indexes];
          workingIndexes.push(index);
          return workingIndexes;
        }
      } else {
        const workingIndexes = [...indexes];
        workingIndexes.push(index);
        if (item.name === itemId) {
          return workingIndexes;
        }
        const foundIndexes = findItemPath(item.layers, itemId, workingIndexes);
        if (foundIndexes.length > workingIndexes.length) {
          return foundIndexes;
        }
      }
    }
    return indexes;
  }
}
