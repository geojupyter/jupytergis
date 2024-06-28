import {
  Delta,
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
  IJGISLayerItem,
  IJGISLayers,
  IJGISLayerTree,
  IJGISOptions,
  IJGISSource,
  IJGISSources
} from './_interface/jgis';
import { IRasterSource } from './_interface/rastersource';

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
  layerTreeChange?: Delta<IJGISLayerItem[]>;
}

export interface IJGISSourceDocChange {
  sourceChange?: Array<{
    id: string;
    newValue: IJGISSource | undefined;
  }>;
}

export interface ISelection {
  type: 'layer' | 'source';
  parent?: string;
}

export interface IJupyterGISClientState {
  selected: { value?: { [key: string]: ISelection }; emitter?: string | null };
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
  layerTree: IJGISLayerTree;

  readonly editable: boolean;
  readonly toJGISEndpoint?: string;

  layerExists(id: string): boolean;
  getLayer(id: string): IJGISLayer | undefined;
  removeLayer(id: string): void;
  addLayer(
    id: string,
    value: IJGISLayer,
    groupName?: string,
    position?: number
  ): void;
  updateLayer(id: string, value: IJGISLayer): void;

  sourceExists(id: string): boolean;
  getSource(id: string): IJGISSource | undefined;
  removeSource(id: string): void;
  addSource(id: string, value: IJGISSource): void;
  updateSource(id: string, value: IJGISSource): void;

  addLayerTreeItem(index: number, item: IJGISLayerItem): void;
  updateLayerTreeItem(index: number, item: IJGISLayerItem): void;

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
  layerTreeChange?: Delta<IJGISLayerItem[]>;
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
  sharedLayerTreeChanged: ISignal<IJupyterGISDoc, IJGISLayerTreeDocChange>;
  sharedSourcesChanged: ISignal<IJupyterGISDoc, IJGISSourceDocChange>;

  getContent(): IJGISContent;
  getLayers(): IJGISLayers;
  getLayer(id: string): IJGISLayer | undefined;
  getSources(): IJGISSources;
  getSource(id: string): IJGISSource | undefined;
  getLayerTree(): IJGISLayerTree;
  addLayer(
    id: string,
    layer: IJGISLayer,
    groupName?: string,
    position?: number
  ): void;

  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void;
  syncSelectedPropField(data: {
    id: string | null;
    value: any;
    parentType: 'panel' | 'dialog';
  }): void;
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

export interface IRasterLayerGalleryEntry {
  name: string;
  thumbnail: string;
  source: IRasterSource;
}

export interface IJGISLayerBrowserRegistry {
  getProviders(): IRasterLayerGalleryEntry[];
  registerProvider(data: IRasterLayerGalleryEntry): void;
}
