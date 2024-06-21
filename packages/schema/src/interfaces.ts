import {
  DocumentChange,
  MapChange,
  StateChange,
  YDocument
} from '@jupyter/ydoc';
import { IWidgetTracker } from '@jupyterlab/apputils';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';
import { User } from '@jupyterlab/services';
import { ReactWidget } from '@jupyterlab/ui-components';
import { ISignal, Signal } from '@lumino/signaling';

import {
  IJGISContent,
  IJGISLayer,
  IJGISLayers,
  IJGISLayerGroup,
  IJGISOptions,
  IJGISSource,
  IJGISSources
} from './_interface/jgis';

export interface IDict<T = any> {
  [key: string]: T;
}

export interface IJGISLayerDocChange {
  layerChange?: Array<{
    id: string;
    newValue: IJGISLayer | undefined;
  }>;
}

export interface IJGISLayerTreeDocChange {
  layerTreeChange?: Array<{
    id: string;
    newValue: IJGISLayerGroup | string | undefined;
  }>;
}

export interface IJGISSourceDocChange {
  sourceChange?: Array<{
    id: string;
    newValue: IJGISSource | undefined;
  }>;
}

export interface IJupyterGISClientState {
  selectedPropField?: {
    id: string | null;
    value: any;
    parentType: 'panel' | 'dialog';
  };
  user: User.IIdentity;
  remoteUser?: number;
  toolbarForm?: IDict;
}

export interface IJupyterGISDoc extends YDocument<IJupyterGISDocChange> {
  options: IJGISOptions;
  layers: IJGISLayers;
  sources: IJGISSources;
  layerTree: IJGISLayerGroup;

  readonly editable: boolean;
  readonly toJGISEndpoint?: string;

  layerExists(id: string): boolean;
  getLayer(id: string): IJGISLayer | undefined;
  removeLayer(id: string): void;
  addLayer(id: string, value: IJGISLayer): void;
  updateLayer(id: string, value: IJGISLayer): void;

  getTreeLayers(): (IJGISLayerGroup | string)[];

  sourceExists(id: string): boolean;
  getSource(id: string): IJGISSource | undefined;
  removeSource(id: string): void;
  addSource(id: string, value: IJGISSource): void;
  updateSource(id: string, value: IJGISSource): void;

  updateObjectParameters(
    id: string,
    value: IJGISLayer['parameters'] | IJGISSource['parameters']
  ): void;
  getObject(id: string): IJGISLayer | IJGISSource | undefined;

  getOption(key: keyof IJGISOptions): IDict | undefined;
  setOption(key: keyof IJGISOptions, value: IDict): void;

  optionsChanged: ISignal<IJupyterGISDoc, MapChange>;
  layersChanged: ISignal<IJupyterGISDoc, IJGISLayerDocChange>;
  sourcesChanged: ISignal<IJupyterGISDoc, IJGISSourceDocChange>;
  layerTreeChanged: ISignal<IJupyterGISDoc, IJGISLayerTreeDocChange>;
}

export interface IJupyterGISDocChange extends DocumentChange {
  contextChange?: MapChange;
  contentChange?: MapChange;
  layerChange?: Array<{
    name: string;
    key: string;
    newValue: IJGISLayer | undefined;
  }>;
  layerTreeChange?: Array<{
    id: string;
    newValue: IJGISLayerGroup | string | undefined;
  }>;
  optionChange?: MapChange;
  stateChange?: StateChange<any>[];
}

export interface IJupyterGISModel extends DocumentRegistry.IModel {
  isDisposed: boolean;
  sharedModel: IJupyterGISDoc;
  localState: IJupyterGISClientState | null;

  themeChanged: Signal<
    IJupyterGISModel,
    IChangedArgs<string, string | null, string>
  >;
  clientStateChanged: ISignal<
    IJupyterGISModel,
    Map<number, IJupyterGISClientState>
  >;
  sharedOptionsChanged: ISignal<IJupyterGISDoc, MapChange>;
  sharedLayersChanged: ISignal<IJupyterGISDoc, IJGISLayerDocChange>;

  getContent(): IJGISContent;
  getLayers(): IJGISLayers;
  getLayer(id: string): IJGISLayer | undefined;
  getSources(): IJGISSources;
  getSource(id: string): IJGISSource | undefined;
  getTreeLayers(): (IJGISLayerGroup | string)[];

  syncSelectedPropField(data: {
    id: string | null;
    value: any;
    parentType: 'panel' | 'dialog';
  });
  setUserToFollow(userId?: number): void;
  syncFormData(form: any): void;

  getClientId(): number;

  disposed: ISignal<any, void>;
}

export interface IUserData {
  userId: number;
  userData: User.IIdentity;
}

export type IJupyterGISWidget = IDocumentWidget<ReactWidget, IJupyterGISModel>;

export type IJupyterGISTracker = IWidgetTracker<IJupyterGISWidget>;

export interface IJGISFormSchemaRegistry {
  /**
   *
   *
   * @return {*}  {IDict}
   * @memberof IJGISFormSchemaRegistry
   */
  getSchemas(): Map<string, IDict>;

  /**
   *
   *
   * @param {string} name
   * @param {IDict} schema
   * @memberof IJGISFormSchemaRegistry
   */
  registerSchema(name: string, schema: IDict): void;

  /**
   *
   *
   * @param {string} name
   * @return {*}  {boolean}
   * @memberof IJGISFormSchemaRegistry
   */
  has(name: string): boolean;
}

export interface IJGISExternalCommand {
  name: string;
  id: string;
  label?: string;
}

export interface IJGISExternalCommandRegistry {
  getCommands(): IJGISExternalCommand[];
  registerCommand(command: IJGISExternalCommand): void;
}
