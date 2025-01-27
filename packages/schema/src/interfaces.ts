import {
  Delta,
  DocumentChange,
  MapChange,
  StateChange,
  YDocument
} from '@jupyter/ydoc';
import { IWidgetTracker, MainAreaWidget } from '@jupyterlab/apputils';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';
import { Contents, User } from '@jupyterlab/services';
import { JSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { SplitPanel } from '@lumino/widgets';

import {
  IJGISContent,
  IJGISLayer,
  IJGISLayerGroup,
  IJGISLayerItem,
  IJGISLayers,
  IJGISLayerTree,
  IJGISOptions,
  IJGISSource,
  IJGISSources,
  SourceType
} from './_interface/jgis';
import { IRasterSource } from './_interface/rastersource';
export { IGeoJSONSource } from './_interface/geojsonsource';

export type JgisCoordinates = { x: number; y: number };

export interface IViewPortState {
  coordinates: JgisCoordinates;
  zoom: number;
}

export type Pointer = {
  coordinates: { x: number; y: number };
};
export interface IDict<T = any> {
  [key: string]: T;
}

export interface IJGISLayerDocChange {
  layerChange?: Array<{
    id: string;
    oldValue: IDict;
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

export type SelectionType = 'layer' | 'source' | 'group';

export interface ISelection {
  type: SelectionType;
  parent?: string;
  selectedNodeId?: string;
}

export interface IJupyterGISClientState {
  selected: { value?: { [key: string]: ISelection }; emitter?: string | null };
  viewportState: { value?: IViewPortState; emitter?: string | null };
  pointer: { value?: Pointer; emitter?: string | null };
  identifiedFeatures: { value?: any; emitter?: string | null };
  user: User.IIdentity;
  remoteUser?: number;
  toolbarForm?: IDict;
}

export interface IJupyterGISDoc extends YDocument<IJupyterGISDocChange> {
  options: IJGISOptions;
  layers: IJGISLayers;
  sources: IJGISSources;
  layerTree: IJGISLayerTree;
  metadata: any;

  readonly editable: boolean;
  readonly toJGISEndpoint?: string;

  getSource(): JSONObject;
  setSource(value: JSONObject | string): void;

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
  getLayerSource(id: string): IJGISSource | undefined;
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

  getMetadata(key: string): string | undefined;
  setMetadata(key: string, value: string): void;
  removeMetadata(key: string): void;

  optionsChanged: ISignal<IJupyterGISDoc, MapChange>;
  layersChanged: ISignal<IJupyterGISDoc, IJGISLayerDocChange>;
  sourcesChanged: ISignal<IJupyterGISDoc, IJGISSourceDocChange>;
  layerTreeChanged: ISignal<IJupyterGISDoc, IJGISLayerTreeDocChange>;
  metadataChanged: ISignal<IJupyterGISDoc, MapChange>;
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
  annotationModel?: IAnnotationModel;

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
  sharedMetadataChanged: ISignal<IJupyterGISModel, MapChange>;
  zoomToPositionSignal: ISignal<IJupyterGISModel, string>;

  contentsManager: Contents.IManager | undefined;
  filePath: string;

  getContent(): IJGISContent;
  getLayers(): IJGISLayers;
  getLayer(id: string): IJGISLayer | undefined;
  getSources(): IJGISSources;
  getSource(id: string): IJGISSource | undefined;
  getSourcesByType(type: SourceType): { [key: string]: string };
  getLayersBySource(id: string): string[];
  getLayerTree(): IJGISLayerTree;
  addLayer(
    id: string,
    layer: IJGISLayer,
    groupName?: string,
    position?: number
  ): void;
  removeLayer(id: string): void;
  getOptions(): IJGISOptions;
  setOptions(value: IJGISOptions): void;

  removeLayerGroup(groupName: string): void;
  renameLayerGroup(groupName: string, newName: string): void;
  moveItemsToGroup(items: string[], groupName: string, index?: number): void;
  moveItemRelatedTo(item: string, relativeItem: string, after: boolean): void;
  addNewLayerGroup(
    selected: { [key: string]: ISelection },
    group: IJGISLayerGroup
  ): void;

  syncViewport(viewport?: IViewPortState, emitter?: string): void;
  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void;
  syncPointer(pointer?: Pointer, emitter?: string): void;
  syncIdentifiedFeatures(features: IDict<any>, emitter?: string): void;
  setUserToFollow(userId?: number): void;

  getClientId(): number;

  addMetadata(key: string, value: string): void;
  removeMetadata(key: string): void;
  centerOnPosition(id: string): void;

  toggleIdentify(): void;
  isIdentifying: boolean;
  isTemporal: boolean;
  toggleTemporal(): void;

  disposed: ISignal<any, void>;
}

export interface IUserData {
  userId: number;
  userData: User.IIdentity;
}

export interface IJupyterGISDocumentWidget
  extends IDocumentWidget<SplitPanel, IJupyterGISModel> {
  readonly model: IJupyterGISModel;
}

export interface IJupyterGISOutputWidget extends MainAreaWidget {
  model: IJupyterGISModel;
}

export type IJupyterGISWidget =
  | IJupyterGISDocumentWidget
  | IJupyterGISOutputWidget;

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

  getDocManager(): IDocumentManager;
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

/**
 * Defines the structure for entries in a raster layer gallery.
 * Each entry consists of a name, a thumbnail URL, and source information.
 * The source information is expected to conform to the IRasterSource interface.
 *
 * @interface IRasterLayerGalleryEntry
 */
export interface IRasterLayerGalleryEntry {
  name: string;
  thumbnail: string;
  source: IRasterSource;
}

export interface IJGISLayerBrowserRegistry {
  getRegistryLayers(): IRasterLayerGalleryEntry[];
  addRegistryLayer(data: IRasterLayerGalleryEntry): void;
  removeRegistryLayer(name: string): void;
  clearRegistry(): void;
}

export interface IAnnotationModel {
  updateSignal: ISignal<this, null>;
  user: User.IIdentity | undefined;

  model: IJupyterGISModel | undefined;
  modelChanged: ISignal<this, void>;

  update(): void;

  getAnnotation(id: string): IAnnotation | undefined;

  getAnnotationIds(): string[];

  addAnnotation(key: string, value: IAnnotation): void;

  removeAnnotation(key: string): void;

  addContent(id: string, value: string): void;
}

export interface IAnnotationContent {
  user?: User.IIdentity;
  value: string;
}

export interface IAnnotation {
  label: string;
  position: { x: number; y: number };
  zoom: number;
  contents: IAnnotationContent[];
  parent: string;
}
