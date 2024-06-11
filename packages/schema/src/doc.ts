import { MapChange, YDocument } from '@jupyter/ydoc';
import { JSONExt, JSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import * as Y from 'yjs';

import { IJGISLayer, IJGISOptions } from './_interface/jgis';
import {
  IDict,
  IJGISLayerDocChange,
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
    this._layers = this.ydoc.getArray<Y.Map<any>>('layers');
    this.undoManager.addToScope(this._layers);

    this._layers.observeDeep(this._layersObserver);
    this._options.observe(this._optionsObserver);
  }

  dispose(): void {
    super.dispose();
  }

  get version(): string {
    return '0.1.0';
  }

  get layers(): Array<IJGISLayer> {
    const objs = this._layers.map(
      obj => JSONExt.deepCopy(obj.toJSON()) as IJGISLayer
    );
    return objs;
  }

  get options(): JSONObject {
    return JSONExt.deepCopy(this._options.toJSON());
  }

  get layersChanged(): ISignal<IJupyterGISDoc, IJGISLayerDocChange> {
    return this._layersChanged;
  }

  get optionsChanged(): ISignal<IJupyterGISDoc, MapChange> {
    return this._optionsChanged;
  }

  layerExists(name: string): boolean {
    return Boolean(this._getLayertAsYMapByName(name));
  }

  getLayerByName(name: string): IJGISLayer | undefined {
    const obj = this._getLayertAsYMapByName(name);
    if (obj) {
      return JSONExt.deepCopy(obj.toJSON()) as IJGISLayer;
    }
    return undefined;
  }

  removeLayerByName(name: string): void {
    let index = 0;
    for (const obj of this._layers) {
      if (obj.get('name') === name) {
        break;
      }
      index++;
    }

    if (this._layers.length > index) {
      this.transact(() => {
        this._layers.delete(index);
      });
    }
  }

  addLayer(value: IJGISLayer): void {
    this.addLayers([value]);
  }

  addLayers(value: Array<IJGISLayer>): void {
    this.transact(() => {
      value.map(obj => {
        if (!this.layerExists(obj.name)) {
          this._layers.push([new Y.Map(Object.entries(obj))]);
        } else {
          console.error('There is already a layer with the name:', obj.name);
        }
      });
    });
  }

  updateLayerByName(name: string, key: string, value: any): void {
    const obj = this._getLayertAsYMapByName(name);
    if (!obj) {
      return;
    }
    this.transact(() => obj.set(key, value));
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

  setOptions(options: IJGISOptions): void {
    this.transact(() => {
      for (const [key, value] of Object.entries(options)) {
        this._options.set(key, value);
      }
    });
  }

  static create(): IJupyterGISDoc {
    return new JupyterGISDoc();
  }

  editable = true;

  private _getLayertAsYMapByName(name: string): Y.Map<any> | undefined {
    for (const obj of this._layers) {
      if (obj.get('name') === name) {
        return obj;
      }
    }
    return undefined;
  }

  private _layersObserver = (events: Y.YEvent<any>[]): void => {
    const changes: Array<{
      name: string;
      key: keyof IJGISLayer;
      newValue: IJGISLayer;
    }> = [];
    let needEmit = false;
    events.forEach(event => {
      const name = event.target.get('name');

      if (name) {
        event.keys.forEach((change, key) => {
          if (!needEmit) {
            needEmit = true;
          }
          changes.push({
            name,
            key: key as any,
            newValue: JSONExt.deepCopy(event.target.toJSON())
          });
        });
      }
    });
    needEmit = changes.length === 0 ? true : needEmit;
    if (needEmit) {
      this._layersChanged.emit({ layerChange: changes });
    }
    this._changed.emit({ layerChange: changes });
  };

  private _optionsObserver = (event: Y.YMapEvent<Y.Map<string>>): void => {
    this._optionsChanged.emit(event.keys);
  };

  private _layers: Y.Array<Y.Map<any>>;
  private _options: Y.Map<any>;
  private _optionsChanged = new Signal<IJupyterGISDoc, MapChange>(this);
  private _layersChanged = new Signal<IJupyterGISDoc, IJGISLayerDocChange>(
    this
  );
}
