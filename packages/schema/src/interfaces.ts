import {
  Delta,
  DocumentChange,
  MapChange,
  StateChange,
  YDocument,
} from '@jupyter/ydoc';
import { IWidgetTracker, MainAreaWidget } from '@jupyterlab/apputils';
import { IChangedArgs } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { DocumentRegistry, IDocumentWidget } from '@jupyterlab/docregistry';
import { Contents, User } from '@jupyterlab/services';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { JSONObject } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { SplitPanel } from '@lumino/widgets';
import { FeatureLike } from 'ol/Feature';

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
  IJGISStoryMap,
  SourceType,
} from './_interface/project/jgis';
import { IRasterSource } from './_interface/project/sources/rasterSource';
import { Modes } from './types';
export { IGeoJSONSource } from './_interface/project/sources/geoJsonSource';

export interface IJGISStoryMaps {
  [k: string]: IJGISStoryMap;
}

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

export interface IJGISStoryMapDocChange {
  storyMapChange?: Array<{
    id: string;
    newValue: IJGISStoryMap | undefined;
  }>;
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
}

export interface IJupyterGISClientState {
  selected: { value?: { [key: string]: ISelection }; emitter?: string | null };
  selectedPropField?: {
    id: string | null;
    value: any;
    parentType: 'panel' | 'dialog';
  };
  viewportState: { value?: IViewPortState; emitter?: string | null };
  pointer: { value?: Pointer; emitter?: string | null };
  identifiedFeatures: { value?: any; emitter?: string | null };
  user: User.IIdentity;
  remoteUser?: number;
  toolbarForm?: IDict;
  isTemporalControllerActive: boolean;
}

export interface IJupyterGISDoc extends YDocument<IJupyterGISDocChange> {
  options: IJGISOptions;
  layers: IJGISLayers;
  sources: IJGISSources;
  stories: IJGISStoryMaps;
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
    position?: number,
  ): void;

  updateLayer(id: string, value: IJGISLayer): void;

  sourceExists(id: string): boolean;
  getLayerSource(id: string): IJGISSource | undefined;
  removeSource(id: string): void;
  addSource(id: string, value: IJGISSource): void;
  updateSource(id: string, value: IJGISSource): void;

  getStoryMap(id: string): IJGISStoryMap | undefined;
  removeStoryMap(id: string): void;
  addStoryMap(id: string, value: IJGISStoryMap): void;
  updateStoryMap(id: string, value: IJGISStoryMap): void;

  addLayerTreeItem(index: number, item: IJGISLayerItem): void;
  updateLayerTreeItem(index: number, item: IJGISLayerItem): void;

  updateObjectParameters(
    id: string,
    value: IJGISLayer['parameters'] | IJGISSource['parameters'],
  ): void;
  getObject(id: string): IJGISLayer | IJGISSource | undefined;

  getOption(key: keyof IJGISOptions): IDict | undefined;
  setOption(key: keyof IJGISOptions, value: IDict): void;

  getMetadata(key: string): string | IAnnotation | undefined;
  setMetadata(key: string, value: string | IAnnotation): void;
  removeMetadata(key: string): void;

  optionsChanged: ISignal<IJupyterGISDoc, MapChange>;
  layersChanged: ISignal<IJupyterGISDoc, IJGISLayerDocChange>;
  sourcesChanged: ISignal<IJupyterGISDoc, IJGISSourceDocChange>;
  storyMapsChanged: ISignal<IJupyterGISDoc, IJGISStoryMapDocChange>;
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
  geolocation: JgisCoordinates;
  localState: IJupyterGISClientState | null;
  annotationModel?: IAnnotationModel;
  currentMode: Modes;
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
  addFeatureAsMsSignal: ISignal<IJupyterGISModel, string>;
  updateLayerSignal: ISignal<IJupyterGISModel, string>;
  geolocationChanged: Signal<IJupyterGISModel, JgisCoordinates>;
  flyToGeometrySignal: Signal<IJupyterGISModel, any>;
  highlightFeatureSignal: Signal<IJupyterGISModel, any>;
  updateBboxSignal: Signal<IJupyterGISModel, any>;

  contentsManager: Contents.IManager | undefined;
  filePath: string;

  pathChanged: ISignal<IJupyterGISModel, string>;

  stories: Map<string, IJGISStoryMap>;

  getFeaturesForCurrentTile: ({
    sourceId,
  }: {
    sourceId: string;
  }) => FeatureLike[];
  syncTileFeatures: ({
    sourceId,
    features,
  }: {
    sourceId: string;
    features: FeatureLike[];
  }) => void;

  getSettings(): Promise<ISettingRegistry.ISettings>;
  settingsChanged: ISignal<IJupyterGISModel, string>;
  jgisSettings: IJupyterGISSettings;
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
    position?: number,
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
    group: IJGISLayerGroup,
  ): void;

  syncViewport(viewport?: IViewPortState, emitter?: string): void;
  syncSelected(value: { [key: string]: ISelection }, emitter?: string): void;
  selected: { [key: string]: ISelection } | undefined;
  setEditingItem(type: SelectionType, itemId: string): void;
  clearEditingItem(): void;
  readonly editing: { type: SelectionType; itemId: string } | null;
  editingChanged: ISignal<
    IJupyterGISModel,
    { type: SelectionType; itemId: string } | null
  >;
  syncPointer(pointer?: Pointer, emitter?: string): void;
  syncIdentifiedFeatures(features: IDict<any>, emitter?: string): void;
  setUserToFollow(userId?: number): void;

  getClientId(): number;

  addMetadata(key: string, value: string): void;
  removeMetadata(key: string): void;
  centerOnPosition(id: string): void;

  toggleMode(mode: Modes): void;

  isTemporalControllerActive: boolean;
  toggleTemporalController(): void;
  addFeatureAsMs(id: string, selectedFeature: string): void;
  triggerLayerUpdate(layerId: string, layer: IJGISLayer): void;

  disposed: ISignal<any, void>;
  getSelectedStory(): {
    storyId: string;
    story: IJGISStoryMap | undefined;
  };
  addStorySegment(): { storySegmentId: string; storyMapId: string } | null;
  isSpectaMode(): boolean;
}

export interface IUserData {
  userId: number;
  userData: User.IIdentity;
}

export interface IJupyterGISDocumentWidget extends IDocumentWidget<
  SplitPanel,
  IJupyterGISModel
> {
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

  updateAnnotation(id: string, updates: Partial<IAnnotation>): void;

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
  open: boolean;
}

export interface IJupyterGISSettings {
  proxyUrl: string;

  // Panel visibility
  leftPanelDisabled?: boolean;
  rightPanelDisabled?: boolean;

  // Left panel tabs
  layersDisabled?: boolean;
  stacBrowserDisabled?: boolean;
  filtersDisabled?: boolean;

  // Right panel tabs
  objectPropertiesDisabled?: boolean;
  annotationsDisabled?: boolean;
  identifyDisabled?: boolean;

  // Story maps
  storyMapsDisabled: boolean;

  // Map controls
  zoomButtonsEnabled?: boolean;
}
