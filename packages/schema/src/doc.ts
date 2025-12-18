import { convertYMapEventToMapChange, Delta, MapChange, YDocument } from '@jupyter/ydoc';
import { JSONExt, JSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import * as Y from 'yjs';

import {
  IJGISLayer,
  IJGISLayerItem,
  IJGISLayerTree,
  IJGISLayers,
  IJGISOptions,
  IJGISSource,
  IJGISSources,
  IJGISStoryMap,
} from './_interface/project/jgis';
import { SCHEMA_VERSION } from './_interface/version';
import {
  IDict,
  IJGISLayerDocChange,
  IJGISLayerTreeDocChange,
  IJGISSourceDocChange,
  IJGISStoryMapDocChange,
  IJGISStoryMaps,
  IJupyterGISDoc,
  IJupyterGISDocChange,
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
    this._stories = this.ydoc.getMap<Y.Map<any>>('stories');
    this._metadata = this.ydoc.getMap<string>('metadata');

    this.undoManager.addToScope(this._layers);
    this.undoManager.addToScope(this._sources);
    this.undoManager.addToScope(this._stories);
    this.undoManager.addToScope(this._layerTree);

    this._layers.observeDeep(this._layersObserver.bind(this));
    this._layerTree.observe(this._layerTreeObserver.bind(this));
    this._sources.observeDeep(this._sourcesObserver.bind(this));
    this._stories.observeDeep(this._storyMapsObserver.bind(this));
    this._options.observe(this._optionsObserver.bind(this));
    this._metadata.observe(this._metaObserver.bind(this));
  }

  getSource(): JSONObject {
    const layers = this._layers.toJSON();
    const layerTree = this._layerTree.toJSON();
    const options = this._options.toJSON();
    const sources = this._sources.toJSON();
    const stories = this._stories.toJSON();
    const metadata = this._metadata.toJSON();

    return { layers, layerTree, sources, stories, options, metadata };
  }

  setSource(value: JSONObject | string): void {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      value = JSON.parse(value);
    }
    value = value as JSONObject;
    this.transact(() => {
      const layers = value['layers'] ?? {};
      Object.entries(layers).forEach(([key, val]) =>
        this._layers.set(key, val as string),
      );

      const layerTree =
        (value['layerTree'] as unknown as Array<IJGISLayerItem>) ?? [];
      layerTree.forEach(layer => {
        this._layerTree.push([layer]);
      });

      const options = value['options'] ?? {};
      Object.entries(options).forEach(([key, val]) =>
        this._options.set(key, val),
      );

      const sources = value['sources'] ?? {};
      Object.entries(sources).forEach(([key, val]) =>
        this._sources.set(key, val),
      );

      const stories = value['stories'] ?? {};
      Object.entries(stories).forEach(([key, val]) =>
        this._stories.set(key, val),
      );

      const metadata = value['metadata'] ?? {};
      Object.entries(metadata).forEach(([key, val]) =>
        this._metadata.set(key, val as string),
      );
    });
  }

  dispose(): void {
    super.dispose();
  }

  get version(): string {
    return SCHEMA_VERSION;
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

  set stories(stories: IJGISStoryMaps) {
    this.transact(() => {
      for (const [key, value] of Object.entries(stories)) {
        this._stories.set(key, value);
      }
    });
  }

  get stories(): IJGISStoryMaps {
    return JSONExt.deepCopy(this._stories.toJSON());
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

  getLayer(id: string): IJGISLayer | undefined {
    if (!this._layers.has(id)) {
      return undefined;
    }
    return JSONExt.deepCopy(this._layers.get(id));
  }

  getLayerSource(id: string): IJGISSource | undefined {
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

  get storyMapsChanged(): ISignal<IJupyterGISDoc, IJGISStoryMapDocChange> {
    return this._storyMapsChanged;
  }

  get optionsChanged(): ISignal<IJupyterGISDoc, MapChange> {
    return this._optionsChanged;
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

  getObject(id: string): IJGISLayer | IJGISSource | undefined {
    const layer = this.getLayer(id);
    if (layer) {
      return layer;
    }

    const source = this.getLayerSource(id);
    if (source) {
      return source;
    }
  }

  updateObjectParameters(
    id: string,
    value: IJGISLayer['parameters'] | IJGISSource['parameters'],
  ) {
    const layer = this.getLayer(id);
    if (layer) {
      layer.parameters = {
        ...layer.parameters,
        ...value,
      };

      this.updateLayer(id, layer);
    }

    const source = this.getLayerSource(id);
    if (source) {
      source.parameters = {
        ...source.parameters,
        ...value,
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

  removeStoryMap(id: string): void {
    this.transact(() => {
      this._stories.delete(id);
    });
  }

  addStoryMap(id: string, value: IJGISStoryMap): void {
    this.transact(() => {
      this._stories.set(id, value);
    });
  }

  updateStoryMap(id: string, value: any): void {
    this.transact(() => this._stories.set(id, value));
  }

  getStoryMap(id: string): IJGISStoryMap | undefined {
    if (!this._stories.has(id)) {
      return undefined;
    }
    return JSONExt.deepCopy(this._stories.get(id));
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

  getMetadata(key: string): string | undefined {
    return this._metadata.get(key);
  }

  setMetadata(key: string, value: string): void {
    this.transact(() => void this._metadata.set(key, value));
  }

  removeMetadata(key: string): void {
    if (this._metadata.has(key)) {
      this._metadata.delete(key);
    }
  }

  get metadata(): JSONObject {
    return JSONExt.deepCopy(this._metadata.toJSON());
  }

  set metadata(metadata: { [k: string]: string }) {
    this.transact(() => {
      for (const [key, value] of Object.entries(metadata)) {
        this._metadata.set(key, value);
      }
    });
  }

  get metadataChanged(): ISignal<IJupyterGISDoc, MapChange> {
    return this._metadataChanged;
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
      oldValue: IDict;
      newValue: IJGISLayer;
    }> = [];
    let needEmit = false;
    events.forEach(event => {
      event.keys.forEach((change, key) => {
        if (!needEmit) {
          needEmit = true;
        }
        changes.push({
          id: key,
          oldValue: change.oldValue,
          newValue: JSONExt.deepCopy(event.target.toJSON()[key]),
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
          id: key,
          newValue: JSONExt.deepCopy(event.target.toJSON()[key]),
        });
      });
    });
    needEmit = changes.length === 0 ? true : needEmit;
    if (needEmit) {
      this._sourcesChanged.emit({ sourceChange: changes });
    }
  }

  private _storyMapsObserver(events: Y.YEvent<any>[]): void {
    const changes: Array<{
      id: string;
      newValue: IJGISStoryMap;
    }> = [];
    let needEmit = false;
    events.forEach(event => {
      event.keys.forEach((change, key) => {
        if (!needEmit) {
          needEmit = true;
        }
        changes.push({
          id: key,
          newValue: JSONExt.deepCopy(event.target.toJSON()[key]),
        });
      });
    });
    needEmit = changes.length === 0 ? true : needEmit;
    if (needEmit) {
      this._storyMapsChanged.emit({ storyMapChange: changes });
    }
  }

  private _optionsObserver = (event: Y.YMapEvent<Y.Map<string>>): void => {
    this._optionsChanged.emit(convertYMapEventToMapChange(event));
  };

  private _metaObserver = (event: Y.YMapEvent<string>): void => {
    this._metadataChanged.emit(convertYMapEventToMapChange(event));
  };

  private _layers: Y.Map<any>;
  private _layerTree: Y.Array<IJGISLayerItem>;
  private _sources: Y.Map<any>;
  private _stories: Y.Map<any>;
  private _options: Y.Map<any>;
  private _metadata: Y.Map<string>;

  private _optionsChanged = new Signal<IJupyterGISDoc, MapChange>(this);
  private _layersChanged = new Signal<IJupyterGISDoc, IJGISLayerDocChange>(
    this,
  );
  private _layerTreeChanged = new Signal<
    IJupyterGISDoc,
    IJGISLayerTreeDocChange
  >(this);
  private _sourcesChanged = new Signal<IJupyterGISDoc, IJGISSourceDocChange>(
    this,
  );
  private _storyMapsChanged = new Signal<
    IJupyterGISDoc,
    IJGISStoryMapDocChange
  >(this);
  private _metadataChanged = new Signal<IJupyterGISDoc, MapChange>(this);
}
