import {
  SCHEMA_VERSION,
  IJupyterGISDoc,
  JupyterGISDoc
} from '@jupytergis/schema';
import { JSONExt } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import * as Y from 'yjs';

export class JupyterGISGeoJSONDoc extends JupyterGISDoc {
  constructor() {
    super();

    this._source = this.ydoc.getText('source');
    this._source.observeDeep(this._sourceObserver);
  }

  set source(value: string) {
    this._source.insert(0, value);
  }

  get version(): string {
    return SCHEMA_VERSION;
  }

  get objectsChanged(): ISignal<IJupyterGISDoc, any> {
    return this._objectChanged;
  }

  get objects(): Array<any> {
    const source = this._source.toJSON();
    console.log("calling source");
    console.log(source);

    if (!source) {
      return [];
    }

    return [
      {
        name: 'GeoJSON File',
        visible: true,
        type: 'VectorTileLayer',
        parameters: {
          content: this._source.toJSON(),
          style: {
            color: '#3388ff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.2
          }
        }
      }
    ];
  }

  setSource(value: string): void {
    this._source.insert(0, value);
  }

  static create(): JupyterGISGeoJSONDoc {
    return new JupyterGISGeoJSONDoc();
  }

  editable = false;
  toJgisEndpoint = 'jupytergis/export';

  private _sourceObserver = (events: Y.YEvent<any>[]): void => {
    const changes: Array<{
      name: string;
      key: string;
      newValue: any;
    }> = [];
    events.forEach(event => {
      event.keys.forEach((change, key) => {
        changes.push({
          name: 'GeoJSON File',
          key: key as string,
          newValue: JSONExt.deepCopy(event.target.toJSON())
        });
      });
    });
    this._objectChanged.emit({ objectChange: changes });
    this._changed.emit({ layerChange: changes });
  };

  private _source: Y.Text;
  private _objectChanged = new Signal<IJupyterGISDoc, any>(this);
}
