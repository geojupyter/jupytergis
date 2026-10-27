import {
  Deck,
  WebMercatorViewport,
  type InteractionState,
  type MapViewState,
  type PickingInfo,
  type ViewStateChangeParameters,
  type Widget,
} from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, type BitmapLayerProps } from '@deck.gl/layers';
import {
  CompassWidget,
  FullscreenWidget,
  ZoomWidget,
  _ScaleWidget as ScaleWidget,
} from '@deck.gl/widgets';
import type {
  IDict,
  IIdentifiedFeature,
  IJGISLayer,
  IJGISOptions,
  IJGISSource,
  IJGISUIState,
  IJupyterGISModel,
  IRasterLayer,
  IRasterSource,
  JgisCoordinates,
} from '@jupytergis/schema';
import type { ILoggerRegistry } from '@jupyterlab/logconsole';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';

import type { IDrawToolAdapter } from '@/src/features/draw-tool';
import { debounce, throttle } from '@/src/tools';
import { ClientPointer } from '../../CollaboratorPointers';
import {
  IMapAdapter,
  IMapAdapterCallbacks,
  IMapAdapterOptions,
  IMapLayerComparison,
  IMapProjection,
  VIEWPORT_SYNC_INTERVAL,
} from '../../mapAdapter';
import { MAP_ADAPTER_FEATURES } from '../../mapAdapterFeatures';

const noop = (): void => {
  // deck.gl adapter is not implemented yet.
};

const NOOP_DRAW_TOOL: IDrawToolAdapter = {
  get currentDrawLayerId() {
    return undefined;
  },

  get currentDrawSourceId() {
    return undefined;
  },

  handleGeometryTypeChange: noop,
  enterLayer: noop,
  leaveDrawMode: noop,
  deleteAtCoordinate: () => false,
  deleteSelectedFeatures: () => false,
  toggleDeleteMode: noop,
  getFeatureAtCoordinate: () => undefined,
  updateFeatureAttributes: () => false,
  hasFeatureAtCoordinate: () => false,
  setDrawLayerId: noop,
  handleViewProjectionChanged: noop,
};

const DEFAULT_PROJECTION: IMapProjection = {
  code: 'EPSG:3857',
  units: 'm',
};

const MM_PER_INCH = 25.4;
const OGC_PIXEL_SIZE_MM = 0.28;
const OGC_SCREEN_DPI = MM_PER_INCH / OGC_PIXEL_SIZE_MM;
const INCHES_PER_METER = 1000 / MM_PER_INCH;
const EARTH_CIRCUMFERENCE_M = 40075016.686;
/** deck.gl MapView zoom uses the same 512px tile size as MapLibre. */
const WEB_MERCATOR_TILE_SIZE = 512;

type LngLat = [longitude: number, latitude: number];

/** Resolved XYZ template. `{z}`, `{x}`, `{y}`, and `{-y}` are left for TileLayer. */
type RasterTileTemplate = {
  url: string;
  minZoom: number;
  maxZoom: number;
};

/**
 * deck.gl implementation of {@link IMapAdapter}.
 *
 * `initialize` builds an empty interactive Web Mercator map. Layer loading
 * stays on `updateLayers`.
 */
export class DeckGlAdapter implements IMapAdapter {
  constructor(model: IJupyterGISModel) {
    this._model = model;

    this._emitBboxChanged = debounce(() => {
      const bounds = this._boundsFromViewState(this._viewState);
      if (!bounds) {
        return;
      }
      this._model.updateBboxSignal.emit(bounds);
    }, 100) as () => void;

    this._syncViewportThrottled = throttle(() => {
      if (this._model.localState?.remoteUser) {
        return;
      }

      const bounds = this._boundsFromViewState(this._viewState);
      if (!bounds) {
        return;
      }

      this._model.syncViewport(
        {
          coordinates: {
            x: this._viewState.longitude,
            y: this._viewState.latitude,
          },
          zoom: this._viewState.zoom,
          extent: bounds,
        },
        this._mainViewId,
      );
    }, VIEWPORT_SYNC_INTERVAL);
  }

  async initialize(
    target: HTMLElement,
    options: IMapAdapterOptions,
  ): Promise<void> {
    const {
      projection = 'EPSG:3857',
      center = [0, 0],
      lonLat,
      zoom = 1,
      rotation = 0,
      controlsTarget,
      zoomButtonsEnabled = false,
      isSpectaMode = false,
      mainViewId,
      callbacks,
      loggerRegistry,
    } = options;

    if (!(target instanceof HTMLDivElement)) {
      throw new Error('DeckGL adapter requires a div target.');
    }

    this._callbacks = callbacks;
    this._mainViewId = mainViewId;
    this._controlsTarget = controlsTarget;
    this._loggerRegistry = loggerRegistry;

    if (projection !== 'EPSG:3857') {
      this._log(
        'warning',
        `DeckGL only supports EPSG:3857; ignoring requested projection ${projection}.`,
      );
    }

    this._viewState = {
      longitude: lonLat?.[0] ?? center[0],
      latitude: lonLat?.[1] ?? center[1],
      zoom,
      bearing: rotation,
      pitch: 0,
      maxPitch: 85,
    };
    this._viewDirty = false;

    target.tabIndex = 0;

    if (this._deck) {
      this.destroy();
    }

    await new Promise<void>((resolve, reject) => {
      let loaded = false;

      try {
        this._deck = new Deck({
          parent: target,
          id: mainViewId,
          width: '100%',
          height: '100%',
          initialViewState: this._viewState, //maybe just use viewState since we want to manage state externally
          controller: { doubleClickZoom: true }, // dblClick is true by default
          layers: [],
          widgets: this._createWidgets(
            target,
            controlsTarget,
            zoomButtonsEnabled,
            isSpectaMode,
          ),
          onViewStateChange: this._onViewStateChange,
          onInteractionStateChange: this._onInteractionStateChange,
          onAfterRender: () => {
            this._callbacks?.onPostRender?.();
          },
          onHover: this._onHover,
          onError: error => {
            this._log('error', error.message);
            if (!loaded) {
              reject(error);
            }
          },
          onLoad: () => {
            loaded = true;
            this._bindCanvasEvents();
            resolve();
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  destroy(): void {
    this._unbindCanvasEvents();
    this._rasterSources.clear();
    this._deck?.finalize();
    this._deck = undefined;
  }

  async addLayer(
    _id: string,
    _layer: IJGISLayer,
    _index?: number,
  ): Promise<void> {
    noop();
  }

  removeLayer(_id: string): void {
    noop();
  }

  getZoom(): number {
    return this._viewState.zoom;
  }

  getViewportId(): string {
    return this._deck?.getCanvas()?.id ?? '';
  }

  getProjection(): IMapProjection {
    return DEFAULT_PROJECTION;
  }

  setProjection(_code: string): IMapProjection | undefined {
    return undefined;
  }

  getPixelFromCoordinate(_coordinate: number[]): [number, number] {
    return [0, 0];
  }

  registerMap(_path?: string): void {
    noop();
  }

  unregisterMap(): void {
    noop();
  }

  onZoomToPosition(_id: string): void {
    noop();
  }

  convertFeatureToMs(_args: string): void {
    noop();
  }

  updateClientPointerPositions(
    clientPointers: Record<number, ClientPointer>,
  ): Record<number, ClientPointer> {
    return clientPointers;
  }

  handleLocationIndicatorToggled(_uiState: IJGISUIState): void {
    noop();
  }

  flyToGeometry(_geometry: Geometry): void {
    noop();
  }

  highlightFeatureOnMap(_featureOrGeometry: GeoJSONFeature | Geometry): void {
    noop();
  }

  handleGeolocationChanged(_newPosition: JgisCoordinates): void {
    noop();
  }

  startLocationIndicator(): void {
    noop();
  }

  stopLocationIndicator(): void {
    noop();
  }

  computeFeatureFloaterPosition(
    _feature: IIdentifiedFeature,
  ): { x: number; y: number } | undefined {
    return undefined;
  }

  toLonLat(coordinate: number[], _projection?: IMapProjection): number[] {
    return coordinate;
  }

  handleDrawModeChanged(_isDrawing: boolean): void {
    noop();
  }

  flyToPosition(
    _center: JgisCoordinates,
    _zoom: number,
    _duration?: number,
    _transitionType?: 'linear' | 'immediate' | 'smooth',
  ): void {
    noop();
  }

  moveToPosition(
    _center: JgisCoordinates,
    _zoom: number,
    _duration?: number,
    _easing?: 'ease' | 'linear',
  ): void {
    noop();
  }

  applyOptions(
    _options: IJGISOptions,
  ): { code: string; units: string } | undefined {
    return undefined;
  }

  async updateLayer(
    _id: string,
    _layer: IJGISLayer,
    _oldLayer?: IDict,
  ): Promise<void> {
    noop();
  }

  async updateLayers(layerIds: string[]): Promise<void> {
    for (const id of layerIds) {
      const layer = this._model.getLayers()[id];
      if (layer?.type !== 'RasterLayer') {
        continue;
      }

      const sourceId = (layer.parameters as IRasterLayer | undefined)?.source;
      if (sourceId && !this._rasterSources.has(sourceId)) {
        const source = this._model.getSource(sourceId);
        if (source) {
          await this.addSource(sourceId, source);
        }
      }
    }

    this._syncRasterLayers(layerIds);
  }

  clearHighlightIfNotIdentifying(): void {
    noop();
  }

  async addSource(id: string, source: IJGISSource): Promise<void> {
    if (source.type !== 'RasterSource') {
      this._log(
        'warning',
        `DeckGlAdapter: source type "${source.type}" is not yet supported. Skipping source ${id}.`,
      );
      return;
    }

    const parameters = source.parameters as IRasterSource;
    if (!parameters?.url) {
      this._log(
        'error',
        `DeckGlAdapter: raster source "${source.name ?? id}" has no URL.`,
      );
      return;
    }

    this._rasterSources.set(id, {
      url: this._resolveTileUrl(parameters),
      minZoom: parameters.minZoom,
      maxZoom: parameters.maxZoom,
    });
  }

  removeSource(id: string): void {
    this._rasterSources.delete(id);
  }

  async updateSource(_id: string, _source: IJGISSource): Promise<void> {
    noop();
  }

  setZoomButtonsEnabled(_enabled: boolean | undefined): void {
    noop();
  }

  setNavigationEnabled(_enabled: boolean): void {
    noop();
  }

  setLayerComparison(_comparison: IMapLayerComparison | null): void {
    noop();
  }

  enterPresentationMode(): void {
    noop();
  }

  exitPresentationMode(): void {
    noop();
  }

  readonly drawTool: IDrawToolAdapter = NOOP_DRAW_TOOL;

  onFeatureStoresChanged(): void {
    noop();
  }

  get supportedFeatures() {
    return MAP_ADAPTER_FEATURES.deckgl;
  }

  private _createWidgets(
    mapContainer: HTMLDivElement,
    controlsTarget: HTMLElement | undefined,
    zoomButtonsEnabled: boolean,
    isSpectaMode: boolean,
  ): Widget[] {
    const controlsContainer =
      controlsTarget instanceof HTMLDivElement ? controlsTarget : undefined;
    const placement = controlsContainer
      ? { _container: controlsContainer }
      : {};

    const widgets: Widget[] = [
      new ScaleWidget(placement),
      new CompassWidget(placement),
    ];

    if (!isSpectaMode) {
      widgets.push(
        new FullscreenWidget({
          ...placement,
          container: mapContainer,
        }),
      );
    }

    if (zoomButtonsEnabled) {
      widgets.push(new ZoomWidget(placement));
    }

    return widgets;
  }

  private _onViewStateChange = ({
    viewState,
    interactionState,
  }: ViewStateChangeParameters<MapViewState>): void => {
    this._viewState = viewState;
    this._viewDirty = true;
    this._emitBboxChanged();
    this._callbacks?.onClientPointerPositionChanged?.();
    this._syncViewportThrottled();

    if (!this._isInteracting(interactionState)) {
      this._commitView();
    }
  };

  private _onInteractionStateChange = (state: InteractionState): void => {
    if (!this._isInteracting(state) && this._viewDirty) {
      this._commitView();
    }
  };

  // Called when pointer moves over canvas
  private _onHover = (info: PickingInfo): void => {
    const coordinate = info.coordinate;
    if (!coordinate) {
      return;
    }

    this._lastPointerCoord = [coordinate[0], coordinate[1]];
    this._syncPointer(this._lastPointerCoord);
  };

  private _onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this._callbacks?.onContextMenu?.(event, this._lastPointerCoord);
  };

  private _onPointerLeave = (): void => {
    this._syncPointer(null);
  };

  private _bindCanvasEvents(): void {
    const canvas = this._deck?.getCanvas();
    if (!canvas) {
      return;
    }

    canvas.addEventListener('contextmenu', this._onContextMenu);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
    this._canvas = canvas;
  }

  private _unbindCanvasEvents(): void {
    this._canvas?.removeEventListener('contextmenu', this._onContextMenu);
    this._canvas?.removeEventListener('pointerleave', this._onPointerLeave);
    this._canvas = undefined;
  }

  private _isInteracting(state: InteractionState): boolean {
    return Boolean(
      state.inTransition ||
      state.isDragging ||
      state.isPanning ||
      state.isRotating ||
      state.isZooming,
    );
  }

  private _commitView(): void {
    this._viewDirty = false;

    const viewState = this._viewState;
    const bounds = this._boundsFromViewState(viewState);
    const currentOptions = this._model.getOptions();
    const updatedOptions: Partial<IJGISOptions> = {
      latitude: viewState.latitude,
      longitude: viewState.longitude,
      bearing: viewState.bearing ?? 0,
      pitch: viewState.pitch ?? 0,
      projection: DEFAULT_PROJECTION.code,
      zoom: viewState.zoom,
    };

    if (bounds) {
      updatedOptions.extent = bounds;
    }

    this._model.setOptions({
      ...currentOptions,
      ...updatedOptions,
    });

    this._publishScale(viewState);
  }

  // should go away in rebase
  private _publishScale(viewState: MapViewState): void {
    const latitude = (viewState.latitude * Math.PI) / 180;
    const metersPerPixel =
      (EARTH_CIRCUMFERENCE_M * Math.cos(latitude)) /
      (WEB_MERCATOR_TILE_SIZE * Math.pow(2, viewState.zoom));

    this._callbacks?.onScaleChange?.(
      metersPerPixel * INCHES_PER_METER * OGC_SCREEN_DPI,
    );
  }

  private _boundsFromViewState(
    viewState: MapViewState,
  ): [number, number, number, number] | undefined {
    const canvas = this._deck?.getCanvas();
    const width = canvas?.clientWidth ?? 0;
    const height = canvas?.clientHeight ?? 0;
    if (width === 0 || height === 0) {
      return undefined;
    }

    return new WebMercatorViewport({
      width,
      height,
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch,
    }).getBounds();
  }

  private _syncRasterLayers(layerIds: string[]): void {
    if (!this._deck) {
      return;
    }

    const layers = [];
    for (const id of layerIds) {
      const layer = this._model.getLayers()[id];
      if (layer?.type !== 'RasterLayer') {
        continue;
      }

      const tileLayer = this._createRasterTileLayer(id, layer);
      if (tileLayer) {
        layers.push(tileLayer);
      }
    }

    // Index 0 is underneath, matching OpenLayers insertAt.
    this._deck.setProps({ layers });
  }

  private _createRasterTileLayer(
    id: string,
    layer: IJGISLayer,
  ): TileLayer<unknown> | undefined {
    const parameters = layer.parameters as IRasterLayer | undefined;
    const template = parameters?.source
      ? this._rasterSources.get(parameters.source)
      : undefined;
    if (!template) {
      return undefined;
    }

    return new TileLayer({
      id,
      data: template.url,
      minZoom: template.minZoom,
      maxZoom: template.maxZoom,
      tileSize: 256,
      opacity: parameters?.opacity ?? 1,
      visible: layer.visible ?? true,
      onTileError: error => {
        this._log(
          'error',
          `DeckGlAdapter: tile failed for layer "${layer.name ?? id}": ${error?.message ?? error}`,
        );
      },
      renderSubLayers: props => {
        const { boundingBox } = props.tile;

        return new BitmapLayer({
          id: props.id,
          image: props.data as BitmapLayerProps['image'],
          bounds: [
            boundingBox[0][0],
            boundingBox[0][1],
            boundingBox[1][0],
            boundingBox[1][1],
          ],
          opacity: props.opacity,
          visible: props.visible,
          pickable: true,
        });
      },
    });
  }

  // todo: make pure and resuse
  private _resolveTileUrl(parameters: IRasterSource): string {
    const urlParameters = parameters.urlParameters || {};
    let url = parameters.url;

    for (const parameterName of Object.keys(urlParameters)) {
      url = url.replace(`{${parameterName}}`, urlParameters[parameterName]);
    }

    if (url.includes('{max_zoom}')) {
      url = url.replace('{max_zoom}', parameters.maxZoom.toString());
    }
    if (url.includes('{min_zoom}')) {
      url = url.replace('{min_zoom}', parameters.minZoom.toString());
    }

    return url;
  }

  // this shouldnt be in each adapter
  private _log(
    level: 'debug' | 'info' | 'warning' | 'error' | 'critical',
    message: string,
  ): void {
    if (level === 'error' || level === 'critical') {
      // eslint-disable-next-line no-console
      console.error(message);
    } else if (level === 'warning') {
      // eslint-disable-next-line no-console
      console.warn(message);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }

    this._loggerRegistry
      ?.getLogger(this._model.filePath)
      .log({ type: 'text', level, data: message });
  }

  private readonly _model: IJupyterGISModel;
  private _deck?: Deck;
  private _canvas?: HTMLCanvasElement;
  private _viewState: MapViewState = {
    longitude: 0,
    latitude: 0,
    zoom: 0,
  };
  private _viewDirty = false;
  private _mainViewId?: string;
  private _loggerRegistry?: ILoggerRegistry;
  private _callbacks?: IMapAdapterCallbacks;
  private _controlsTarget?: HTMLElement;
  private _lastPointerCoord: LngLat | null = null;
  private _emitBboxChanged: () => void;
  private _rasterSources = new Map<string, RasterTileTemplate>();
  private _syncViewportThrottled: () => void;
  private _syncPointer = throttle((coordinates: LngLat | null) => {
    const pointer = coordinates
      ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
      : undefined;
    this._model.syncPointer(pointer);
  });
}
