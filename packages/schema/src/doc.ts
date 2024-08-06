import { Delta, MapChange, YDocument } from '@jupyter/ydoc';
import { JSONExt } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import * as Y from 'yjs';

import {
  IJGISFilterItem,
  IJGISFilters,
  IJGISLayer,
  IJGISLayerItem,
  IJGISLayerTree,
  IJGISLayers,
  IJGISOptions,
  IJGISSource,
  IJGISSources,
  IJGISTerrain
} from './_interface/jgis';
import {
  IDict,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISSourceDocChange,
  IJupyterGISDoc,
  IJupyterGISDocChange
} from './interfaces';

export class JupyterGISDoc
  extends YDocument<IJupyterGISDocChange>
  implements IJupyterGISDoc
{
  constructor() {
    super();

    this._options = this.ydoc.getMap<Y.Map<any>>('options');
    this._layers = this.ydoc.getMap<Y.Map<any>>('layers');
    this._layerTree = this.ydoc.getArray<IJGISLayerItem>('layerTree');
    this._sources = this.ydoc.getMap<Y.Map<any>>('sources');
    this._terrain = this.ydoc.getMap<IJGISTerrain>('terrain');
    this._filters = this.ydoc.getArray<IJGISFilterItem>('filters');

    this.undoManager.addToScope(this._layers);
    this.undoManager.addToScope(this._sources);
    this.undoManager.addToScope(this._layerTree);

    this._layers.observeDeep(this._layersObserver.bind(this));
    this._layerTree.observe(this._layerTreeObserver.bind(this));
    this._sources.observeDeep(this._sourcesObserver.bind(this));
    this._terrain.observe(this._terrainObserver.bind(this));
    this._options.observe(this._optionsObserver.bind(this));
    this._filters.observe(this._filtersObserver.bind(this));
  }

  dispose(): void {
    super.dispose();
  }

  get version(): string {
    return '0.1.0';
  }

  get layers(): IJGISLayers {
    return JSONExt.deepCopy(this._layers.toJSON());
  }

  set layers(layers: IJGISLayers) {
    this.transact(() => {
      for (const [key, value] of Object.entries(layers)) {
        this._layers.set(key, value);
      }
    });
  }

  set sources(sources: IJGISSources) {
    this.transact(() => {
      for (const [key, value] of Object.entries(sources)) {
        this._sources.set(key, value);
      }
    });
  }

  get sources(): IJGISSources {
    return JSONExt.deepCopy(this._sources.toJSON());
  }

  get layerTree(): IJGISLayerTree {
    return JSONExt.deepCopy(this._layerTree.toJSON());
  }

  set layerTree(layerTree: IJGISLayerTree) {
    this.transact(() => {
      this._layerTree.delete(0, this._layerTree.length);
      this._layerTree.push(layerTree);
    });
  }

  get terrain(): IJGISTerrain {
    return JSONExt.deepCopy(this._terrain.toJSON()) as IJGISTerrain;
  }

  set terrain(terrain: IJGISTerrain) {
    this.transact(() => {
      for (const [key, value] of Object.entries(terrain)) {
        this._terrain.set(key, value);
      }
    });
  }

  get filters(): IJGISFilters {
    return JSONExt.deepCopy(this._filters.toJSON());
  }

  set filters(filters: IJGISFilters) {
    this.transact(() => {
      this._filters.delete(0, this._filters.length);
      this._filters.push(filters);
    });
  }

  getLayer(id: string): IJGISLayer | undefined {
    if (!this._layers.has(id)) {
      return undefined;
    }
    return JSONExt.deepCopy(this._layers.get(id));
  }

  getSource(id: string): IJGISSource | undefined {
    if (!this._sources.has(id)) {
      return undefined;
    }
    return JSONExt.deepCopy(this._sources.get(id));
  }

  set options(options: IJGISOptions) {
    this.transact(() => {
      for (const [key, value] of Object.entries(options)) {
        this._options.set(key, value);
      }
    });
  }

  get options(): IJGISOptions {
    return JSONExt.deepCopy(this._options.toJSON()) as IJGISOptions;
  }

  get layersChanged(): ISignal<IJupyterGISDoc, IJGISLayerDocChange> {
    return this._layersChanged;
  }

  get layerTreeChanged(): ISignal<IJupyterGISDoc, IJGISLayerTreeDocChange> {
    return this._layerTreeChanged;
  }

  get sourcesChanged(): ISignal<IJupyterGISDoc, IJGISSourceDocChange> {
    return this._sourcesChanged;
  }

  get optionsChanged(): ISignal<IJupyterGISDoc, MapChange> {
    return this._optionsChanged;
  }

  get terrainChanged(): ISignal<IJupyterGISDoc, IJGISTerrain> {
    return this._terrainChanged;
  }

  get filtersChanged(): ISignal<IJupyterGISDoc, IJGISFilters> {
    return this._filtersChanged;
  }

  layerExists(id: string): boolean {
    return Boolean(this._getLayerAsYMap(id));
  }

  removeLayer(id: string): void {
    this.transact(() => {
      this._layers.delete(id);
    });
  }

  addLayer(id: string, value: IJGISLayer): void {
    this.transact(() => {
      this._layers.set(id, value);
    });
  }

  updateLayer(id: string, value: IJGISLayer): void {
    this.transact(() => {
      this._layers.set(id, value);
    });
  }

  addLayerTreeItem(index: number, item: IJGISLayerItem) {
    this.transact(() => {
      this._layerTree.insert(index, [item]);
    });
  }

  updateLayerTreeItem(index: number, item: IJGISLayerItem) {
    this.transact(() => {
      this._layerTree.delete(index);
      if (item) {
        this._layerTree.insert(index, [item]);
      }
    });
  }

  addFilterItem(item: IJGISFilterItem) {
    this.transact(() => {
      this._filters.insert(this._filters.length - 1, [item]);
    });
  }

  getObject(id: string): IJGISLayer | IJGISSource | undefined {
    const layer = this.getLayer(id);
    if (layer) {
      return layer;
    }

    const source = this.getSource(id);
    if (source) {
      return source;
    }
  }

  updateObjectParameters(
    id: string,
    value: IJGISLayer['parameters'] | IJGISSource['parameters']
  ) {
    const layer = this.getLayer(id);
    if (layer) {
      layer.parameters = {
        ...layer.parameters,
        ...value
      };

      this.updateLayer(id, layer);
    }

    const source = this.getSource(id);
    if (source) {
      source.parameters = {
        ...source.parameters,
        ...value
      };

      this.updateSource(id, source);
    }
  }

  sourceExists(id: string): boolean {
    return Boolean(this._getSourceAsYMap(id));
  }

  removeSource(id: string): void {
    this.transact(() => {
      this._sources.delete(id);
    });
  }

  addSource(id: string, value: IJGISSource): void {
    this.transact(() => {
      this._sources.set(id, value);
    });
  }

  updateSource(id: string, value: any): void {
    this.transact(() => this._sources.set(id, value));
  }

  getOption(key: keyof IJGISOptions): IDict | undefined {
    const content = this._options.get(key);
    if (!content) {
      return;
    }
    return JSONExt.deepCopy(content) as IDict;
  }

  setOption(key: keyof IJGISOptions, value: IDict): void {
    this.transact(() => void this._options.set(key, value));
  }

  static create(): IJupyterGISDoc {
    return new JupyterGISDoc();
  }

  editable = true;

  private _getLayerAsYMap(id: string): Y.Map<any> | undefined {
    if (this._layers.has(id)) {
      return this._layers.get(id);
    }
    return undefined;
  }

  private _getSourceAsYMap(id: string): Y.Map<any> | undefined {
    if (this._sources.has(id)) {
      return this._sources.get(id);
    }
    return undefined;
  }

  private _layersObserver(events: Y.YEvent<any>[]): void {
    const changes: Array<{
      id: string;
      newValue: IJGISLayer;
    }> = [];
    let needEmit = false;
    events.forEach(event => {
      event.keys.forEach((change, key) => {
        if (!needEmit) {
          needEmit = true;
        }
        changes.push({
          id: key as string,
          newValue: JSONExt.deepCopy(event.target.toJSON()[key])
        });
      });
    });
    needEmit = changes.length === 0 ? true : needEmit;
    if (needEmit) {
      this._layersChanged.emit({ layerChange: changes });
    }
  }

  private _layerTreeObserver(event: Y.YArrayEvent<IJGISLayerItem>): void {
    const layerTreeChanges = event.delta as Delta<IJGISLayerItem[]>;
    this._layerTreeChanged.emit({ layerTreeChange: layerTreeChanges });
  }

  private _sourcesObserver(events: Y.YEvent<any>[]): void {
    const changes: Array<{
      id: string;
      newValue: IJGISSource;
    }> = [];
    let needEmit = false;
    events.forEach(event => {
      event.keys.forEach((change, key) => {
        if (!needEmit) {
          needEmit = true;
        }
        changes.push({
          id: key as string,
          newValue: JSONExt.deepCopy(event.target.toJSON()[key])
        });
      });
    });
    needEmit = changes.length === 0 ? true : needEmit;
    if (needEmit) {
      this._sourcesChanged.emit({ sourceChange: changes });
    }
  }

  private _terrainObserver(event: Y.YMapEvent<IJGISTerrain>): void {
    this._terrainChanged.emit(this.terrain);
  }

  private _optionsObserver = (event: Y.YMapEvent<Y.Map<string>>): void => {
    this._optionsChanged.emit(event.keys);
  };

  private _filtersObserver = (event: Y.YArrayEvent<IJGISFilterItem>): void => {
    this._filtersChanged.emit(this.filters);
  };

  private _layers: Y.Map<any>;
  private _layerTree: Y.Array<IJGISLayerItem>;
  private _sources: Y.Map<any>;
  private _options: Y.Map<any>;
  private _terrain: Y.Map<IJGISTerrain>;
  private _filters: Y.Array<IJGISFilterItem>;

  private _optionsChanged = new Signal<IJupyterGISDoc, MapChange>(this);
  private _layersChanged = new Signal<IJupyterGISDoc, IJGISLayerDocChange>(
    this
  );
  private _layerTreeChanged = new Signal<
    IJupyterGISDoc,
    IJGISLayerTreeDocChange
  >(this);
  private _sourcesChanged = new Signal<IJupyterGISDoc, IJGISSourceDocChange>(
    this
  );
  private _terrainChanged = new Signal<IJupyterGISDoc, IJGISTerrain>(this);
  private _filtersChanged = new Signal<IJupyterGISDoc, IJGISFilters>(this);
}
