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
import { JSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';

import {
  IJGISContent,
  IJGISLayers,
  IJGISLayer,
  IJGISOptions
} from './_interface/jgis';

export interface IDict<T = any> {
  [key: string]: T;
}

export interface IJGISLayerDocChange {
  layerChange?: Array<{
    name: string;
    key: keyof IJGISLayer;
    newValue: IJGISLayer | undefined;
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
  layers: Array<IJGISLayer>;
  options: JSONObject;

  readonly editable: boolean;
  readonly toJGISEndpoint?: string;

  layerExists(name: string): boolean;
  getLayerByName(name: string): IJGISLayer | undefined;
  removeLayerByName(name: string): void;
  addLayer(value: IJGISLayer): void;
  addLayers(value: Array<IJGISLayer>): void;
  updateLayerByName(name: string, key: string, value: any): void;

  getOption(key: keyof IJGISOptions): IDict | undefined;
  setOption(key: keyof IJGISOptions, value: IDict): void;
  setOptions(options: IJGISOptions): void;

  optionsChanged: ISignal<IJupyterGISDoc, MapChange>;
  layersChanged: ISignal<IJupyterGISDoc, IJGISLayerDocChange>;
}

export interface IJupyterGISDocChange extends DocumentChange {
  contextChange?: MapChange;
  contentChange?: MapChange;
  layerChange?: Array<{
    name: string;
    key: string;
    newValue: IJGISLayer | undefined;
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
