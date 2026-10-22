/* eslint-disable no-console */
import { cogProtocol } from '@geomatico/maplibre-cog-protocol';
import type {
  IDict,
  IGrammarSymbologyState,
  IHillshadeLayer,
  IIdentifiedFeature,
  IJGISLayer,
  IJGISOptions,
  IJGISSource,
  IJupyterGISModel,
  IGeoTiffSource,
  IGeoTiffLayer,
  IRasterLayer,
  IRasterSource,
  IRasterDemSource,
  ITerrainLayer,
  IVectorLayer,
  IVectorTileLayer,
  IVectorTileSource,
  IViewState,
  JgisCoordinates,
} from '@jupytergis/schema';
import { PageConfig } from '@jupyterlab/coreutils';
import { ILoggerRegistry } from '@jupyterlab/logconsole';
import type {
  Feature as GeoJSONFeature,
  FeatureCollection,
  Geometry,
} from 'geojson';
import {
  addProtocol,
  FullscreenControl,
  GeoJSONSource,
  IControl,
  LngLatBoundsLike,
  Map as MlMap,
  MapSourceDataEvent,
  NavigationControl,
  RasterDEMSourceSpecification,
  RasterTileSource,
  ScaleControl,
  setWorkerUrl,
  MapGeoJSONFeature,
} from 'maplibre-gl';
import { FeatureLike } from 'ol/Feature';

import { IDrawToolAdapter } from '@/src/features/draw-tool';
import {
  grammarToMapLibreLayers,
  MapLibreSubLayerType,
} from '@/src/mainview/adapters/maplibre/grammerToMLStyle';
import { extractEncodingFieldValues } from '@/src/mainview/adapters/openlayers/grammarToOLStyle';
import { buildProxyUrl } from '@/src/shared/tileProxy';
import { debounce, loadFile, throttle } from '@/src/tools';
import { ClientPointer } from '../../CollaboratorPointers';
import {
  IMapAdapter,
  IMapAdapterOptions,
  IMapProjection,
  VIEWPORT_SYNC_INTERVAL,
} from '../../mapAdapter';
import {
  MAP_ADAPTER_FEATURES,
  getUnsupportedReason,
} from '../../mapAdapterFeatures';
import { isValidExtent } from '../../utils/olLayerZoomExtent';

const WORLD_EXTENT = [-180, -85.051129, 180, 85.051129];
type MLCoordinates = [number, number];

let cogProtocolRegistred = false;
const registerProtocol = (): void => {
  if (cogProtocolRegistred) {
    return;
  }
  addProtocol('cog', cogProtocol);
  cogProtocolRegistred = true;
};

const noop = () => {
  // Drawing is not supported by the MapLibre adapter yet.
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

export class MapLibreAdapter implements IMapAdapter {
  constructor(model: IJupyterGISModel) {
    this._model = model;
    this._loadingLayers = new Set();
    this._drawTool = NOOP_DRAW_TOOL;
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
      mainViewId,
      callbacks,
      loggerRegistry,
    } = options;

    registerProtocol();

    this._callbacks = callbacks;
    this._mainViewId = mainViewId;
    this._controlsTarget = controlsTarget;
    this._loggerRegistry = loggerRegistry;

    if (projection !== 'EPSG:3857') {
      this._log(
        'warning',
        `MapLibre only supports EPSG:3857; ignoring requested projection ${projection}.`,
      );
    }

    // MapLibre v6 derives its default worker URL from its own
    // import.meta.url, which the JupyterLab build rewrites to a non-http
    // (file://) value. MapLibre then falls back to an empty string and
    // constructs `new Worker('', {type: 'module'})`, i.e. a worker whose
    // script is the JupyterLab page itself, which never replies. Point it
    // at a real served copy instead (copied into the labextension static
    // folder at build time, see the cp:maplibreworker script). The worker
    // imports ./maplibre-gl-shared.mjs, so that file must sit beside it.
    setWorkerUrl(
      new URL(
        `${PageConfig.getOption('fullLabextensionsUrl')}/@jupytergis/jupytergis-core/static/maplibre-gl-worker.mjs`,
        window.location.href,
      ).href,
    );

    this._map = new MlMap({
      container: target,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: lonLat ?? center,
      zoom,
      bearing: rotation,
      pitch: 0,
      maxPitch: 85,
    });
    (window as any).mapDebug = this._map;
    this._scaleControl = new ScaleControl({});
    this._mountControl(this._scaleControl);

    this._fullscreenControl = new FullscreenControl({});
    this._mountControl(this._fullscreenControl);

    if (zoomButtonsEnabled) {
      this._navigationControl = new NavigationControl({
        showCompass: true,
        visualizePitch: true,
      });
      this._mountControl(this._navigationControl);
    }

    this._setupViewEvents();

    await new Promise<void>(resolve => {
      if (this._map.loaded()) {
        resolve();
        return;
      }
      this._map.once('load', () => resolve());
    });

    this._map.resize();
  }

  destroy(): void {
    this.unregisterMap();

    const controls: Array<IControl | undefined> = [
      this._scaleControl,
      this._fullscreenControl,
      this._presentationHadNavigationControl
        ? undefined
        : this._navigationControl,
    ];
    controls.forEach(control => control && this._unmountControl(control));
    this._scaleControl = undefined;
    this._fullscreenControl = undefined;
    this._navigationControl = undefined;
    this._map?.remove();
  }

  /**
   * Fires the same onScaleChange/onPostRender callbacks MainView already
   * wires up for OpenLayers, so React state (scale readout, annotation/
   * feature-floater repositioning) stays in sync regardless of engine.
   */
  private _setupViewEvents(): void {
    const emitBboxChanged = debounce(() => {
      const extent = this._map.getBounds();

      this._model.updateBboxSignal.emit([
        extent.getWest(),
        extent.getSouth(),
        extent.getEast(),
        extent.getNorth(),
      ]);
    }, 100);

    const syncViewportThrottled = throttle(() => {
      // Not syncing center if following someone else
      if (this._model.localState?.remoteUser) {
        return;
      }

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const bounds = this._map.getBounds();

      this._model.syncViewport(
        {
          coordinates: {
            x: center.lng,
            y: center.lat,
          },
          zoom,
          extent: [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ],
        },
        this._mainViewId,
      );
    }, VIEWPORT_SYNC_INTERVAL);

    this._map.on('move', () => {
      emitBboxChanged();

      this._callbacks?.onClientPointerPositionChanged?.();

      syncViewportThrottled();
    });

    this._map.on('render', () => {
      this._callbacks?.onPostRender?.();
    });

    this._map.on('moveend', () => {
      const currentOptions = this._model.getOptions();

      const center = this._map.getCenter();
      const zoom = this._map.getZoom();
      const bearing = this._map.getBearing();
      const pitch = this._map.getPitch();

      const bounds = this._map.getBounds();

      const updatedOptions: Partial<IJGISOptions> = {
        latitude: center.lat,
        longitude: center.lng,
        bearing,
        pitch,
        projection: 'EPSG:3857',
        zoom,
        extent: [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ],
      };

      this._model.setOptions({
        ...currentOptions,
        ...updatedOptions,
      });

      this._updateScale();
    });

    this._map.on('mousemove', event => {
      this._lastPointerCoord = [event.lngLat.lng, event.lngLat.lat];

      this._syncPointer(this._lastPointerCoord);
    });

    this._map.getCanvas().addEventListener('mouseleave', () => {
      this._syncPointer(null);
    });

    this._map.on('click', event => {
      //   this._identifyFeature(event);     TODO
    });

    this._map.on('click', event => {
      //   this._addMarker(event);           TODO
    });

    this._map.on('contextmenu', event => {
      event.preventDefault();

      this._callbacks?.onContextMenu?.(
        event.originalEvent,
        this._lastPointerCoord,
      );
    });

    this._map.on('error', event => {
      console.error('MapLibre error:', event.error);
    });
  }

  private _updateScale(): void {
    const zoom = this._map.getZoom();
    const latitude = this._map.getCenter().lat;

    const earthCircumference = 40075016.686;

    const metersPerPixel =
      (earthCircumference * Math.cos((latitude * Math.PI) / 180)) /
      (512 * Math.pow(2, zoom));

    const dpi = 25.4 / 0.28;
    const inchesPerMeter = 1000 / 25.4;

    const scale = metersPerPixel * inchesPerMeter * dpi;

    this._callbacks?.onScaleChange?.(scale);
  }

  private _syncPointer = throttle((coordinates: MLCoordinates | null) => {
    const pointer = coordinates
      ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
      : undefined;
    this._model.syncPointer(pointer);
  });

  async addSource(id: string, source: IJGISSource): Promise<void> {
    this._log('info', `Loading source "${source.name ?? id}" (${source.type})`);

    const pending = this._pendingSourceAdds.get(id);
    if (pending) {
      return pending;
    }

    const promise = this._addSource(id, source).finally(() => {
      this._pendingSourceAdds.delete(id);
    });
    this._pendingSourceAdds.set(id, promise);
    return promise;
  }

  private async _addSource(id: string, source: IJGISSource): Promise<void> {
    try {
      switch (source.type) {
        case 'GeoJSONSource': {
          let data = source.parameters?.data;

          if (!data) {
            data = await loadFile({
              filepath: source.parameters?.path,
              type: 'GeoJSONSource',
              model: this._model,
            });
          }

          if (typeof data === 'string') {
            data = JSON.parse(data);
          }

          this._geojsonData.set(id, data as GeoJSONFeature | FeatureCollection);

          this._map.addSource(id, {
            type: 'geojson',
            data,
          });

          break;
        }

        case 'VectorTileSource': {
          const sourceParameters = source.parameters as IVectorTileSource;

          const url = this.computeSourceUrl(source);

          const isTms = url.includes('{-y}');

          this._map.addSource(id, {
            type: 'vector',
            tiles: [url],
            scheme: isTms ? 'tms' : 'xyz',
            minzoom: sourceParameters.minZoom,
            maxzoom: sourceParameters.maxZoom,
            attribution: sourceParameters.attribution,
          });

          const handleSourceData = (e: MapSourceDataEvent) => {
            if (e.sourceId !== id || !e.isSourceLoaded) {
              return;
            }

            const sourceLayer = this._resolveVectorSourceLayer(id);
            const features = this._map.querySourceFeatures(id, { sourceLayer });

            const featureMap = new Map<string, FeatureLike>();

            features.forEach((feature, index) => {
              // Prefer the stable ID provided by the vector-tile feature.
              // Fall back to its content when no ID is available.
              const features = feature as MapGeoJSONFeature;
              const featureId =
                feature.id !== undefined
                  ? `${features.sourceLayer ?? sourceLayer}:${feature.id}`
                  : `${features.sourceLayer ?? sourceLayer}:${JSON.stringify([
                      feature.geometry,
                      feature.properties,
                    ])}`;

              featureMap.set(featureId || `${sourceLayer}:${index}`, {
                ...feature,
                getProperties: () => feature.properties ?? {},
              } as unknown as FeatureLike);
            });

            this._model.replaceTileFeatures({
              sourceId: id,
              features: featureMap,
            });
          };

          this._map.on('sourcedata', handleSourceData);
          this._sourceDataHandlers.set(id, handleSourceData);

          break;
        }

        case 'RasterSource': {
          const sourceParameters = source.parameters as IRasterSource;
          this._map.addSource(id, {
            type: 'raster',
            tiles: [this.computeSourceUrl(source)],
            tileSize: 256,
            minzoom: sourceParameters.minZoom,
            maxzoom: sourceParameters.maxZoom,
            attribution: sourceParameters.attribution,
          });
          break;
        }

        case 'RasterDemSource': {
          const sourceParameters = source.parameters as IRasterDemSource;
          this._map.addSource(id, {
            type: 'raster-dem',
            tiles: [this.computeSourceUrl(source)],
            tileSize: 256,
            encoding: 'terrarium',
            attribution: sourceParameters.attribution,
          });
          break;
        }

        case 'GeoTiffSource': {
          const sourceParameters = source.parameters as IGeoTiffSource;
          const [first, ...rest] = sourceParameters.urls ?? [];

          if (!first?.url) {
            throw new Error('GeoTIFF source has no URL.');
          }
          if (rest.length > 0) {
            this._log(
              'warning',
              `MapLibreAdapter: the COG protocol reads a single GeoTIFF; only the first URL of source "${source.name ?? id}" is used.`,
            );
          }

          const url = await this._resolveCogUrl(
            id,
            first.url,
            sourceParameters,
          );

          this._map.addSource(id, {
            type: 'raster',
            url: `cog://${url}`,
            tileSize: 256,
          });

          try {
            // The protocol answers the TileJSON request with the file's
            // bounds and zoom range; wait for it so load errors,
            // notify to surface here and the extent is known.
            await this._waitForSourceMetadata(id);
          } catch (error) {
            if (this._map.getSource(id)) {
              this._map.removeSource(id);
            }
            this._revokeObjectUrls(id);
            throw error;
          }
          break;
        }

        default: {
          this._log(
            'warning',
            `MapLibreAdapter: source type "${source.type}" is not yet supported. Skipping source ${id}.`,
          );
          return;
        }
      }
    } catch (error: any) {
      this._log(
        'error',
        `MapLibreAdapter: failed to load source "${source.name ?? id}" (${source.type}): ${error?.message}`,
      );
      return;
    }

    this._trackSourceExtZoom(id, source.type);
  }

  removeSource(id: string): void {
    const terrainSourceId = this._terrainSourceIdFor(id);
    if (this._map.getSource(terrainSourceId)) {
      if (this._map.getTerrain()?.source === terrainSourceId) {
        this._clearTerrain();
      }
      this._map.removeSource(terrainSourceId);
    }
    this._clearVectorTileSource(id);

    if (this._map.getSource(id)) {
      this._map.removeSource(id);
    }
    this._geojsonData.delete(id);
    this._sourceBounds.delete(id);
    this._revokeObjectUrls(id);
  }

  async updateSource(id: string, source: IJGISSource): Promise<void> {
    // One update at a time per source: addSource() hands back an in-flight add
    // for the same id, which would swallow a newer update.
    const previous = this._sourceUpdates.get(id) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(() => this._replaceSource(id, source));
    this._sourceUpdates.set(id, run);

    try {
      await run;
    } finally {
      if (this._sourceUpdates.get(id) === run) {
        this._sourceUpdates.delete(id);
      }
    }
  }

  private async _replaceSource(id: string, source: IJGISSource): Promise<void> {
    const layers = this._model.getLayers();

    // Every JGIS layer currently drawn from this source.
    const dependentIds = Object.keys(layers).filter(
      layerId =>
        layers[layerId].parameters?.source === id &&
        this._layerSubIds.has(layerId),
    );

    if (dependentIds.length === 0) {
      this.removeSource(id);
      await this.addSource(id, source);
      return;
    }

    // Remember where each dependent sits in the style: the first style layer
    // above it that is not itself being rebuilt.
    const styleIds = this._map.getStyle().layers.map(l => l.id);
    const dependentSubIds = new Set(
      dependentIds.flatMap(layerId => this._layerSubIds.get(layerId) ?? []),
    );
    const placements = dependentIds
      .map(layerId => {
        const positions = (this._layerSubIds.get(layerId) ?? [])
          .map(subId => styleIds.indexOf(subId))
          .filter(position => position >= 0);
        const top = positions.length ? Math.max(...positions) : -1;
        const beforeId =
          top >= 0
            ? styleIds.slice(top + 1).find(sid => !dependentSubIds.has(sid))
            : undefined;
        return { layerId, top, beforeId };
      })
      // Rebuild bottom to top so relative order is preserved.
      .sort((a, b) => a.top - b.top);

    // MapLibre refuses to remove a source that style layers still use.
    for (const { layerId } of placements) {
      this._removeStyleLayers(layerId);
    }

    this.removeSource(id);
    await this.addSource(id, source);

    if (!this._map.getSource(id)) {
      for (const { layerId } of placements) {
        this.removeLayer(layerId);
        this._callbacks?.onLayerError?.(
          layerId,
          `Source "${source.name ?? id}" could not be reloaded.`,
        );
      }
      return;
    }

    for (const { layerId, beforeId } of placements) {
      // Re-read: the model may have changed while the source was loading.
      const layer = this._model.getLayers()[layerId];
      if (!layer) {
        this.removeLayer(layerId);
        continue;
      }

      const unsupported = getUnsupportedReason(
        this.supportedFeatures,
        layer,
        source,
      );
      if (unsupported) {
        this._log(
          'warning',
          `MapLibreAdapter: dropping layer ${layerId} after source update. ${unsupported}`,
        );
        this.removeLayer(layerId);
        this._callbacks?.onLayerError?.(layerId, unsupported);
        continue;
      }

      try {
        await this._buildMapLayer(layerId, layer);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this._log(
          'error',
          `MapLibreAdapter: failed to rebuild layer ${layerId}. ${message}`,
        );
        this.removeLayer(layerId);
        this._callbacks?.onLayerError?.(layerId, message);
        continue;
      }

      // _buildMapLayer appends on top; put it back where it was.
      if (beforeId && this._map.getLayer(beforeId)) {
        for (const subId of this._layerSubIds.get(layerId) ?? []) {
          if (this._map.getLayer(subId)) {
            this._map.moveLayer(subId, beforeId);
          }
        }
      }

      this._sourceToLayerMap.set(id, layerId);
      this._trackLayerViewState(layerId); // extent may have changed
    }
  }

  private _clearVectorTileSource(sourceId: string): void {
    const handler = this._sourceDataHandlers.get(sourceId);

    if (handler) {
      this._map.off('sourcedata', handler);
      this._sourceDataHandlers.delete(sourceId);
    }

    this._model.clearTileFeatures(sourceId);
  }

  /**
   * Turns a GeoTIFF source URL into something the COG protocol can fetch:
   */
  private async _resolveCogUrl(
    sourceId: string,
    url: string,
    parameters: IGeoTiffSource,
  ): Promise<string> {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const proxied = buildProxyUrl(
        this._model,
        url,
        parameters.useProxy,
        parameters.httpHeaders,
      );
      return new URL(proxied, window.location.href).href;
    }

    let blob: Blob;
    if (url.startsWith('data:')) {
      blob = await (await fetch(url)).blob();
    } else {
      const geotiff = await loadFile({
        filepath: url,
        type: 'GeoTiffSource',
        model: this._model,
      });
      blob = geotiff.file;
    }

    const objectUrl = URL.createObjectURL(blob);
    this._objectUrls.set(sourceId, [
      ...(this._objectUrls.get(sourceId) ?? []),
      objectUrl,
    ]);
    return objectUrl;
  }

  private _revokeObjectUrls(sourceId: string): void {
    this._objectUrls.get(sourceId)?.forEach(u => URL.revokeObjectURL(u));
    this._objectUrls.delete(sourceId);
  }

  /** Resolves once a raster source's TileJSON is loaded; rejects on error. */
  private _waitForSourceMetadata(sourceId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this._map.off('sourcedata', onData);
        this._map.off('error', onError);
      };

      const onData = (e: MapSourceDataEvent) => {
        if (e.sourceId !== sourceId || e.sourceDataType !== 'metadata') {
          return;
        }
        cleanup();
        const bounds = (this._map.getSource(sourceId) as RasterTileSource)
          ?.bounds;
        if (bounds) {
          this._sourceBounds.set(sourceId, [...bounds]);
        }
        resolve();
      };

      const onError = (e: {
        sourceId?: string;
        error?: { message?: string };
      }) => {
        if (e.sourceId !== sourceId) {
          return;
        }
        cleanup();
        reject(e.error ?? new Error(`Failed to load COG source ${sourceId}`));
      };

      this._map.on('sourcedata', onData);
      this._map.on('error', onError);
    });
  }

  private computeSourceUrl(source: IJGISSource): string {
    const parameters = source.parameters as IRasterSource;
    const urlParameters = parameters.urlParameters || {};
    let url: string = parameters.url;

    for (const parameterName of Object.keys(urlParameters)) {
      url = url.replace(`{${parameterName}}`, urlParameters[parameterName]);
    }

    // Special case for max_zoom and min_zoom
    if (url.includes('{max_zoom}')) {
      url = url.replace('{max_zoom}', parameters.maxZoom.toString());
    }
    if (url.includes('{min_zoom}')) {
      url = url.replace('{min_zoom}', parameters.minZoom.toString());
    }

    return url;
  }

  private _resolveVectorSourceLayer(sourceId: string): string | undefined {
    const source = this._model.getSource(sourceId);

    if (!source || source.type !== 'VectorTileSource') {
      return undefined;
    }

    const sourceParameters = source.parameters as IVectorTileSource;

    return sourceParameters.sourceLayer || undefined;
  }

  private _addVectorLayerGroup(
    id: string,
    sourceId: string,
    visible: boolean,
    opacity: number,
    symbologyState?: IGrammarSymbologyState,
    sourceLayer?: string,
    beforeId?: string,
  ): void {
    // Same feature values OL reads from its source; needed for graduated/categorized scales.
    const data = this._geojsonData.get(sourceId);
    const rows =
      data?.type === 'FeatureCollection'
        ? data.features.map(f => f.properties ?? {})
        : data?.type === 'Feature'
          ? [data.properties ?? {}]
          : [];
    const featureValues = symbologyState
      ? extractEncodingFieldValues(symbologyState, rows)
      : [];

    const specs = grammarToMapLibreLayers({
      id,
      sourceId,
      state: symbologyState,
      featureValues,
      opacity,
      visible,
      sourceLayer,
    });
    for (const spec of specs) {
      this._map.addLayer(spec as any, beforeId);
    }
    this._layerSubIds.set(
      id,
      specs.map(s => s.id),
    );
  }

  async addLayer(id: string, layer: IJGISLayer, index?: number): Promise<void> {
    this._callbacks?.onLayerAddStarted?.();
    this._loadingLayers.add(id);

    try {
      const sourceId = layer.parameters?.source;
      const source = sourceId ? this._model.getSource(sourceId) : undefined;

      const unsupported = getUnsupportedReason(
        this.supportedFeatures,
        layer,
        source,
      );
      if (unsupported) {
        this._log(
          'warning',
          `MapLibreAdapter: skipping layer ${id}. ${unsupported}`,
        );
        this._callbacks?.onLayerError?.(id, unsupported);
        this._settledLayers.add(id);
        this._callbacks?.onLayerInserted?.(this._settledLayers.size);
        return;
      }

      await this._buildMapLayer(id, layer, index);

      if (sourceId) {
        this._sourceToLayerMap.set(sourceId, id);
      }

      this._insertIntoLayerOrder(id, index);
      this._trackLayerViewState(id);

      this._settledLayers.add(id);
      this._callbacks?.onLayerInserted?.(this._settledLayers.size);
    } finally {
      this._loadingLayers.delete(id);
      this._callbacks?.onLayerAddSettled?.(id);

      if (this._loadingLayers.size === 0) {
        this._callbacks?.onAllLayersSettled?.();
      }
    }
  }

  private async _buildMapLayer(
    id: string,
    layer: IJGISLayer,
    index?: number,
  ): Promise<void> {
    const sourceId = layer.parameters?.source;

    if (!sourceId) {
      return;
    }

    const source = this._model.getSource(sourceId);

    if (!source) {
      this._log(
        'error',
        `MapLibreAdapter: source "${sourceId}" not found for layer "${id}".`,
      );
      return;
    }

    if (!this._map.getSource(sourceId)) {
      await this.addSource(sourceId, source);
    }

    if (!this._map.getSource(sourceId)) {
      this._log(
        'error',
        `MapLibreAdapter: source "${sourceId}" could not be added.`,
      );
      return;
    }

    const visible = layer.visible ?? true;

    try {
      switch (layer.type) {
        case 'RasterLayer':
        case 'GeoTiffLayer': {
          const parameters = layer.parameters as IRasterLayer | IGeoTiffLayer;

          this._map.addLayer({
            id,
            type: 'raster',
            source: sourceId,
            layout: {
              visibility: visible ? 'visible' : 'none',
            },
            paint: {
              'raster-opacity': parameters.opacity ?? 1,
            },
          });

          this._layerSubIds.set(id, [id]);
          break;
        }

        case 'VectorLayer': {
          const parameters = layer.parameters as IVectorLayer;

          this._addVectorLayerGroup(
            id,
            sourceId,
            visible,
            parameters.opacity ?? 1,
            parameters.symbologyState as IGrammarSymbologyState,
          );

          break;
        }

        case 'VectorTileLayer': {
          const parameters = layer.parameters as IVectorTileLayer;

          const sourceLayer = this._resolveVectorSourceLayer(sourceId);

          if (!sourceLayer) {
            this._log(
              'warning',
              `No source-layer found for vector source ${sourceId}`,
            );
            return;
          }

          this._addVectorLayerGroup(
            id,
            sourceId,
            visible,
            parameters.opacity ?? 1,
            parameters.symbologyState as IGrammarSymbologyState,
            sourceLayer,
          );

          break;
        }

        case 'HillshadeLayer': {
          const parameters = layer.parameters as IHillshadeLayer;

          this._map.addLayer({
            id,
            type: 'hillshade',
            source: sourceId,
            layout: {
              visibility: visible ? 'visible' : 'none',
            },
            paint: {
              'hillshade-shadow-color': parameters.shadowColor ?? '#473B24',
              'hillshade-exaggeration': parameters.opacity ?? 0.3,
            },
          });

          this._layerSubIds.set(id, [id]);
          break;
        }

        case 'TerrainLayer': {
          const parameters = layer.parameters as ITerrainLayer;

          this._applyTerrain(
            id,
            sourceId,
            parameters.exaggeration ?? 1,
            visible,
          );

          // Terrain is a map-level setting, not a style layer, so there are
          // no sub-layers; the entry keeps ordering/removal logic working.
          this._layerSubIds.set(id, []);
          break;
        }

        default:
          this._log(
            'warning',
            `MapLibreAdapter: layer type "${layer.type}" is not yet supported.`,
          );
          return;
      }
    } catch (error: any) {
      // MapLibre throws on invalid style specs (bad color format, unknown
      // property, etc). Previously this propagated out of addLayer() with
      // no catch, so the UI's loading state still cleared via `finally`
      // and the layer looked "loaded" while nothing was ever painted.
      this._log(
        'error',
        `MapLibreAdapter: failed to add layer "${layer.name ?? id}" (${layer.type}) to the map: ${error?.message}`,
      );
      return;
    }

    this._layerVisibility.set(id, visible);
  }

  /** Removes the layer's MapLibre style layers but keeps its order/visibility. */
  private _removeStyleLayers(id: string): void {
    if (this._terrainLayerId === id) {
      this._clearTerrain();
    }

    const subIds = this._layerSubIds.get(id) ?? [id];
    for (const subId of subIds) {
      if (this._map.getLayer(subId)) {
        this._map.removeLayer(subId);
      }
    }
    this._layerSubIds.delete(id);
  }

  removeLayer(id: string): void {
    this._removeStyleLayers(id);
    this._layerVisibility.delete(id);
    const orderIndex = this._layerOrder.indexOf(id);
    if (orderIndex !== -1) {
      this._layerOrder.splice(orderIndex, 1);
    }
  }

  async updateLayer(
    id: string,
    layer: IJGISLayer,
    oldLayer?: IDict,
  ): Promise<void> {
    const subIds = this._layerSubIds.get(id);

    if (!subIds || !subIds.every(subId => this._map.getLayer(subId))) {
      this._log(
        'error',
        `MapLibreAdapter: cannot update layer ${id} - layer not found in adapter`,
      );
      return;
    }

    const visible = layer.visible ?? true;
    const visibility = visible ? 'visible' : 'none';

    switch (layer.type) {
      case 'RasterLayer':
      case 'GeoTiffLayer': {
        const layerParameters = layer.parameters as
          | IRasterLayer
          | IGeoTiffLayer;
        this._map.setPaintProperty(
          id,
          'raster-opacity',
          layerParameters.opacity ?? 1,
        );
        this._map.setLayoutProperty(id, 'visibility', visibility);
        break;
      }

      case 'HillshadeLayer': {
        const params = layer.parameters as IHillshadeLayer;
        this._map.setPaintProperty(
          id,
          'hillshade-shadow-color',
          params.shadowColor ?? '#473B24',
        );
        this._map.setPaintProperty(
          id,
          'hillshade-exaggeration',
          params.opacity ?? 0.3,
        );
        this._map.setLayoutProperty(id, 'visibility', visibility);
        break;
      }

      case 'TerrainLayer': {
        const params = layer.parameters as ITerrainLayer;
        this._applyTerrain(
          id,
          params.source,
          params.exaggeration ?? 1,
          visible,
        );
        break;
      }

      case 'VectorLayer':
      case 'VectorTileLayer': {
        const params = layer.parameters as IVectorLayer;
        const opacity = params.opacity ?? 1;

        if (Array.isArray(params.symbologyState?.layers)) {
          // Same as OL's _syncGrammarSubLayers: recompile and swap, keep z-position.
          const ids = this._map.getStyle().layers.map(l => l.id);
          const beforeId = ids[ids.indexOf(subIds[subIds.length - 1]) + 1];
          for (const subId of subIds) {
            this._map.removeLayer(subId);
          }
          this._addVectorLayerGroup(
            id,
            params.source,
            layer.visible ?? true,
            opacity,
            params.symbologyState as IGrammarSymbologyState,
            this._resolveVectorSourceLayer(params.source),
            beforeId,
          );
        } else {
          for (const subId of subIds) {
            const type = this._map.getLayer(subId)
              ?.type as MapLibreSubLayerType;
            if (!type) {
              continue;
            }
            this._map.setPaintProperty(subId, `${type}-opacity`, opacity);
            if (type === 'circle') {
              this._map.setPaintProperty(
                subId,
                'circle-stroke-opacity',
                opacity,
              );
            }
            this._map.setLayoutProperty(subId, 'visibility', visibility);
          }
        }
        break;
      }

      default:
        return;
    }

    this._layerVisibility.set(id, layer.visible ?? true);
  }

  async updateLayers(layerIds: string[]): Promise<void> {
    for (
      let targetLayerPosition = 0;
      targetLayerPosition < layerIds.length;
      targetLayerPosition++
    ) {
      const layerId = layerIds[targetLayerPosition];
      const layer = this._model.getLayers()[layerId];

      if (this._loadingLayers.has(layerId)) {
        continue;
      }

      const sourceId = layer.parameters?.source;

      if (sourceId) {
        const source = this._model.getSources()[sourceId];

        if (source && !this._map.getSource(sourceId)) {
          await this.addSource(sourceId, source);
        }
      }

      if (!this._layerSubIds.has(layerId)) {
        await this.addLayer(layerId, layer, targetLayerPosition);
      }
    }

    // Remove layers that are no longer in the `layerIds` list.
    const target = new Set(layerIds);
    for (const id of [...this._layerSubIds.keys()]) {
      if (!target.has(id) && !this._loadingLayers.has(id)) {
        this.removeLayer(id);
      }
    }

    this._layerOrder = [...layerIds];

    if (
      this._pendingZoomLayerId &&
      this._layerSubIds.has(this._pendingZoomLayerId)
    ) {
      const pendingId = this._pendingZoomLayerId;
      this._pendingZoomLayerId = null;
      this.onZoomToPosition(pendingId);
    }
  }

  private _mountControl(control: IControl): void {
    if (this._controlsTarget) {
      this._controlsTarget.appendChild(control.onAdd(this._map));
    } else {
      this._map.addControl(control);
    }
  }

  private _unmountControl(control: IControl): void {
    if (this._controlsTarget) {
      control.onRemove(this._map);
    } else {
      this._map.removeControl(control);
    }
  }

  private _insertIntoLayerOrder(id: string, index?: number): void {
    const existing = this._layerOrder.indexOf(id);
    if (existing !== -1) {
      this._layerOrder.splice(existing, 1);
    }
    if (index === undefined || index >= this._layerOrder.length) {
      this._layerOrder.push(id);
    } else {
      this._layerOrder.splice(index, 0, id);
    }
  }

  /**
   * Id of the internal DEM source used for terrain.
   */
  private _terrainSourceIdFor(sourceId: string): string {
    return `${sourceId}__terrain`;
  }

  /**
   * Enables or disables 3D terrain. MapLibre supports a single terrain per
   * map, so enabling a second terrain layer replaces the first.
   */
  private _applyTerrain(
    layerId: string,
    sourceId: string,
    exaggeration: number,
    visible: boolean,
  ): void {
    if (!visible) {
      if (this._terrainLayerId === layerId) {
        this._clearTerrain();
      }
      return;
    }

    if (this._terrainLayerId && this._terrainLayerId !== layerId) {
      this._log(
        'warning',
        `MapLibre supports one terrain at a time; "${layerId}" replaces "${this._terrainLayerId}".`,
      );
    }

    const terrainSourceId = this._terrainSourceIdFor(sourceId);
    if (!this._map.getSource(terrainSourceId)) {
      const spec = this._map.getStyle().sources[sourceId];
      if (!spec) {
        this._log(
          'error',
          `MapLibreAdapter: DEM source "${sourceId}" not found for terrain "${layerId}".`,
        );
        return;
      }
      this._map.addSource(terrainSourceId, {
        ...spec,
      } as RasterDEMSourceSpecification);
    }

    const wasActive = this._terrainLayerId === layerId;
    this._map.setTerrain({ source: terrainSourceId, exaggeration });
    this._terrainLayerId = layerId;

    // Terrain looks flat from straight above, so tilt when first enabled.
    if (!wasActive && this._map.getPitch() === 0) {
      this._map.easeTo({ pitch: 60, duration: 800 });
    }
  }

  private _clearTerrain(): void {
    this._map.setTerrain(null);
    this._terrainLayerId = null;
  }

  getZoom(): number {
    return this._map.getZoom();
  }

  getViewportId(): string {
    return this._map.getContainer().id;
  }

  getProjection(): IMapProjection {
    return { code: 'EPSG:3857', units: 'm' };
  }

  setProjection(code: string): IMapProjection | undefined {
    if (code !== 'EPSG:3857') {
      this._log(
        'warning',
        `MapLibre adapter expects EPSG:3857 map coordinates; received ${code}.`,
      );
    }
    return undefined;
  }

  getPixelFromCoordinate(coordinate: number[]): MLCoordinates {
    const point = this._map.project([coordinate[0], coordinate[1]]);
    return [point.x, point.y];
  }

  /** MapLibre always renders in Web Mercator, so `coordinate` here is
   * already [lng, lat] on the map's own terms; `projection` is accepted
   * for interface parity with OpenLayersAdapter and ignored. */
  toLonLat(coordinate: number[]): number[] {
    return coordinate;
  }

  flyToPosition(
    center: JgisCoordinates,
    zoom: number,
    duration = 1000,
    transitionType?: 'linear' | 'immediate' | 'smooth',
  ): void {
    const targetCenter: MLCoordinates = [center.x, center.y];

    if (transitionType === 'linear') {
      this._map.easeTo({
        center: targetCenter,
        zoom,
        duration,
        easing: t => t,
      });
      return;
    }

    if (transitionType === 'smooth') {
      this._map.flyTo({
        center: targetCenter,
        zoom,
        duration,
        curve: 1.8,
      });
      return;
    }

    this._map.jumpTo({ center: targetCenter, zoom });
  }

  moveToPosition(center: JgisCoordinates, zoom: number, duration = 1000): void {
    this._map.easeTo({ center: [center.x, center.y], zoom, duration });
  }

  applyOptions(
    options: IJGISOptions,
  ): { code: string; units: string } | undefined {
    const { projection, latitude, longitude, zoom, bearing, pitch } = options;

    if (projection !== undefined && projection !== 'EPSG:3857') {
      this._log(
        'warning',
        `MapLibre adapter expects EPSG:3857 map coordinates; received ${projection}.`,
      );
    }

    this._map.jumpTo({
      center: [longitude ?? 0, latitude ?? 0],
      zoom: zoom ?? 0,
      bearing: bearing ?? 0,
      pitch: pitch ?? 0,
    });

    return undefined;
  }

  updateClientPointerPositions(
    clientPointers: Record<number, ClientPointer>,
  ): Record<number, ClientPointer> {
    const updated = { ...clientPointers };

    Object.entries(updated).forEach(([clientId, pointer]) => {
      const point = this._map.project([
        pointer.lonLat.longitude,
        pointer.lonLat.latitude,
      ]);
      updated[Number(clientId)] = {
        ...pointer,
        coordinates: { x: point.x, y: point.y },
      };
    });

    return updated;
  }

  setZoomButtonsEnabled(enabled: boolean): void {
    if (!enabled && this._navigationControl) {
      this._unmountControl(this._navigationControl);
      this._navigationControl = undefined;
      return;
    }
    if (enabled && !this._navigationControl) {
      this._navigationControl = new NavigationControl({
        showCompass: true,
        visualizePitch: true,
      });
      this._mountControl(this._navigationControl);
    }
  }

  setNavigationEnabled(enabled: boolean): void {
    const handlers: Array<keyof MlMap> = [
      'dragPan',
      'dragRotate',
      'scrollZoom',
      'boxZoom',
      'keyboard',
      'doubleClickZoom',
      'touchZoomRotate',
      'touchPitch',
    ];
    handlers.forEach(name => {
      const handler = this._map[name] as unknown as {
        enable: () => void;
        disable: () => void;
      };
      enabled ? handler.enable() : handler.disable();
    });
  }

  enterPresentationMode(): void {
    this.setNavigationEnabled(false);
    if (this._navigationControl) {
      this._presentationHadNavigationControl = true;
      this._unmountControl(this._navigationControl);
    }
  }

  exitPresentationMode(): void {
    this.setNavigationEnabled(true);
    if (this._presentationHadNavigationControl && this._navigationControl) {
      this._mountControl(this._navigationControl);
      this._presentationHadNavigationControl = false;
    }
  }

  registerMap(path?: string): void {
    if (window.jupytergisMaps === undefined) {
      return;
    }
    const base = path || 'unsaved';
    let key = base;
    for (let n = 2; window.jupytergisMaps[key] !== undefined; n++) {
      key = `${base}#${n}`;
    }
    window.jupytergisMaps[key] = this._map;
    this._mapKey = key;
    this._map.getContainer().setAttribute('data-jgis-map', key);
  }

  unregisterMap(): void {
    if (window.jupytergisMaps === undefined || this._mapKey === undefined) {
      return;
    }
    delete window.jupytergisMaps[this._mapKey];
    this._map.getContainer().removeAttribute('data-jgis-map');
    this._mapKey = undefined;
  }

  onZoomToPosition(id: string): void {
    // Check if the id is an annotation, same as OpenLayersAdapter.
    const annotation = this._model.annotationModel?.getAnnotation(id);
    if (annotation) {
      this.flyToPosition(annotation.position, annotation.zoom);
      return;
    }

    if (!this._layerSubIds.has(id)) {
      // retry until the layer is loaded
      this._pendingZoomLayerId = id;
      return;
    }

    this._fitViewToExtent(this._computeExtentForLayer(id), id);
  }

  convertFeatureToMs(args: string): void {
    const json = JSON.parse(args);
    const { id: layerId, selectedFeature } = json;

    const sourceId = this._sourceIdForLayer(layerId);
    if (!sourceId) {
      return;
    }

    const data = this._geojsonData.get(sourceId);
    if (!data) {
      return;
    }

    const features = this._featuresFromGeoJson(data);

    features.forEach(feature => {
      if (!feature.properties) {
        feature.properties = {};
      }
      const time = feature.properties[selectedFeature];
      const parsedTime = typeof time === 'string' ? Date.parse(time) : time;
      feature.properties[`${selectedFeature}ms`] = parsedTime;
    });

    const source = this._map.getSource(sourceId) as GeoJSONSource;
    source?.setData(data);
  }

  /**
   * Computes the source id for a layer.
   */
  private _sourceIdForLayer(layerId: string): string | undefined {
    const layer = this._model.getLayer(layerId);
    return layer?.parameters?.source;
  }

  /**
   * Computes the extent for a layer.
   */
  private _computeExtentForLayer(layerId: string): number[] | undefined {
    const sourceId = this._sourceIdForLayer(layerId);
    if (!sourceId) {
      return undefined;
    }

    const source = this._model.getSource(sourceId);
    return this._computeExtentForSource(sourceId, source?.type);
  }

  /* GeoJSON sources contain feature data, so their extent can be computed
   * from the features. Raster and vector tile sources only provide tile URLs,
   * so MapLibre does not expose dataset bounds for them; use the world extent
   * as a fallback until source bounds are supported.
   */

  private _computeExtentForSource(
    sourceId: string,
    sourceType?: string,
  ): number[] | undefined {
    switch (sourceType) {
      case 'GeoJSONSource':
        return this._computeGeoJsonExtent(sourceId);

      case 'RasterSource':
      case 'VectorTileSource':
        return [...WORLD_EXTENT];

      case 'GeoTiffSource': {
        // Bounds come from the COG's TileJSON, captured when the source loaded.
        const bounds = this._sourceBounds.get(sourceId);
        return bounds ? [...bounds] : undefined;
      }

      default:
        return undefined;
    }
  }

  /** Extent of a cached GeoJSON source's features, in lng/lat degrees. */
  private _computeGeoJsonExtent(sourceId: string): number[] | undefined {
    const data = this._geojsonData.get(sourceId);
    if (!data) {
      return undefined;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const visitCoords = (coords: any): void => {
      if (typeof coords[0] === 'number') {
        const [x, y] = coords;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        return;
      }
      coords.forEach(visitCoords);
    };

    const visitGeometry = (geometry: Geometry | null | undefined): void => {
      if (!geometry) {
        return;
      }
      if (geometry.type === 'GeometryCollection') {
        geometry.geometries.forEach(visitGeometry);
        return;
      }
      visitCoords((geometry as any).coordinates);
    };

    this._featuresFromGeoJson(data).forEach(feature =>
      visitGeometry(feature.geometry),
    );

    const extent = [minX, minY, maxX, maxY];
    return isValidExtent(extent) ? extent : undefined;
  }

  private _featuresFromGeoJson(
    data: GeoJSONFeature | FeatureCollection,
  ): GeoJSONFeature[] {
    if (data.type === 'FeatureCollection') {
      return data.features;
    }
    if (data.type === 'Feature') {
      return [data];
    }
    return [];
  }

  /**
   * Fits the view to an extent.
   */
  private _fitViewToExtent(
    extent: number[] | undefined,
    layerId: string,
    options: { duration?: number; padding?: number } = {},
  ): void {
    if (!isValidExtent(extent)) {
      this._log('warning', `Layer ${layerId} extent is not valid.`);
      return;
    }

    this._map.fitBounds(this._toLngLatBounds(extent), {
      duration: options.duration ?? 500,
      padding: options.padding ?? 40,
      maxZoom: 16,
    });
  }

  /**
   * Computes the zoom level from an extent.
   */
  private _computeZoomFromExtent(extent: number[]): number | null {
    if (!this._map || !isValidExtent(extent)) {
      this._log('warning', 'Extent is not valid.');
      return null;
    }

    const camera = this._map.cameraForBounds(this._toLngLatBounds(extent));
    return camera?.zoom ?? this._map.getZoom() ?? null;
  }

  private _toLngLatBounds(extent: number[]): LngLatBoundsLike {
    return [
      [extent[0], extent[1]],
      [extent[2], extent[3]],
    ];
  }

  private _trackSourceExtZoom(sourceId: string, sourceType?: string): void {
    const extent = this._computeExtentForSource(sourceId, sourceType);
    if (!isValidExtent(extent)) {
      this._log('warning', `Source ${sourceId} extent is not valid to track.`);
      return;
    }

    const zoom = this._computeZoomFromExtent(extent);
    if (zoom === null) {
      return;
    }

    const view: IViewState[string] = { extent, zoom };
    this._model.updateLayerViewState(sourceId, view);
  }

  /**
   * Track layer's extent and zoom in model's view state
   */
  private _trackLayerViewState(layerId: string): void {
    const extent = this._computeExtentForLayer(layerId);
    if (!isValidExtent(extent)) {
      this._log('warning', `Layer ${layerId} extent is not valid to track.`);
      return;
    }

    const zoom = this._computeZoomFromExtent(extent);
    if (zoom === null) {
      return;
    }

    const view: IViewState[string] = { extent, zoom };
    this._model.updateLayerViewState(layerId, view);
  }

  setLayerComparison(): void {
    this._notImplemented('setLayerComparison');
  }

  handleLocationIndicatorToggled(): void {
    this._notImplemented('handleLocationIndicatorToggled');
  }

  flyToGeometry(geometry: Geometry): void {
    this._notImplemented('flyToGeometry', geometry);
  }

  highlightFeatureOnMap(featureOrGeometry: GeoJSONFeature | Geometry): void {
    this._notImplemented('highlightFeatureOnMap', featureOrGeometry);
  }

  handleGeolocationChanged(newPosition: JgisCoordinates): void {
    this._notImplemented('handleGeolocationChanged', newPosition);
  }

  startLocationIndicator(): void {
    this._notImplemented('startLocationIndicator');
  }

  stopLocationIndicator(): void {
    this._notImplemented('stopLocationIndicator');
  }

  computeFeatureFloaterPosition(
    feature: IIdentifiedFeature,
  ): { x: number; y: number } | undefined {
    this._notImplemented('computeFeatureFloaterPosition', feature);
    return undefined;
  }

  handleDrawModeChanged(isDrawing: boolean): void {
    this._notImplemented('handleDrawModeChanged', isDrawing);
  }

  clearHighlightIfNotIdentifying(): void {
    // No-op: no highlight layer exists yet in this adapter, so there is
    // nothing to clear. Deliberately silent (unlike the other stubs)
    // since MainView calls this unconditionally on every identify-state
    // change, and warning on every call would be noise, not signal.
  }

  get drawTool(): IDrawToolAdapter {
    return this._drawTool;
  }

  onFeatureStoresChanged = (): void => {
    this._notImplemented('onFeatureStoresChanged');
  };

  get supportedFeatures() {
    return MAP_ADAPTER_FEATURES.maplibre;
  }
  private _notImplemented(name: string, ...args: unknown[]): void {
    if (this._warnedOnce.has(name)) {
      return;
    }
    this._warnedOnce.add(name);
    this._log('warning', `MapLibreAdapter.${name} is not implemented yet.`);
    // eslint-disable-next-line no-console
    if (args.length) {
      console.debug(`MapLibreAdapter.${name} args:`, ...args);
    }
  }

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

  private _map: MlMap;
  private _model: IJupyterGISModel;
  private _mainViewId?: string;
  private _drawTool: IDrawToolAdapter;
  private _mapKey?: string;
  private _loggerRegistry?: ILoggerRegistry;
  private _navigationControl?: NavigationControl;
  private _presentationHadNavigationControl = false;
  private _layerVisibility = new Map<string, boolean>();
  private _loadingLayers: Set<string>;
  private _settledLayers = new Set<string>();
  private _pendingSourceAdds = new Map<string, Promise<void>>();
  private _lastPointerCoord: MLCoordinates | null = null;
  private _sourceToLayerMap = new Map<string, string>();
  private _sourceUpdates = new Map<string, Promise<void>>();
  private _sourceBounds = new Map<string, number[]>();
  private _objectUrls = new Map<string, string[]>();
  private _geojsonData = new Map<string, GeoJSONFeature | FeatureCollection>();
  private _terrainLayerId: string | null = null;
  private _layerSubIds = new Map<string, string[]>();
  private _layerOrder: string[] = [];
  private _pendingZoomLayerId: string | null = null;
  private _warnedOnce = new Set<string>();
  private _callbacks?: IMapAdapterOptions['callbacks'];
  private _controlsTarget?: HTMLElement;
  private _scaleControl?: ScaleControl;
  private _fullscreenControl?: FullscreenControl;
  private _sourceDataHandlers = new Map<
    string,
    (e: MapSourceDataEvent) => void
  >();
}
