/* eslint-disable no-console */
import type {
  IDict,
  IIdentifiedFeature,
  IJGISLayer,
  IJGISOptions,
  IJGISSource,
  IJupyterGISModel,
  IRasterLayer,
  IRasterSource,
  IVectorLayer,
  IVectorTileLayer,
  IVectorTileSource,
  IViewState,
  JgisCoordinates,
} from '@jupytergis/schema';
import { ILoggerRegistry } from '@jupyterlab/logconsole';
import type {
  Feature as GeoJSONFeature,
  FeatureCollection,
  Geometry,
} from 'geojson';
import {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MlMap,
  NavigationControl,
} from 'maplibre-gl';

import { loadFile } from '@/src/tools';
import { ClientPointer } from '.././CollaboratorPointers';
import { IMapAdapter, IMapAdapterOptions, IMapProjection } from '../mapAdapter';
import { isValidExtent } from '../utils/olLayerZoomExtent';

const WORLD_EXTENT = [-180, -85.051129, 180, 85.051129];

export class MapLibreAdapter implements IMapAdapter {
  constructor(model: IJupyterGISModel) {
    this._model = model;
    this._loadingLayers = new Set();
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
      zoomButtonsEnabled = false,
      mainViewId,
      callbacks,
      loggerRegistry,
    } = options;

    this._callbacks = callbacks;
    this._mainViewId = mainViewId;
    this._loggerRegistry = loggerRegistry;

    if (projection !== 'EPSG:3857') {
      this._log(
        'warning',
        `MapLibre only supports EPSG:3857; ignoring requested projection ${projection}.`,
      );
    }

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
    });

    if (zoomButtonsEnabled) {
      this._navigationControl = new NavigationControl({
        showCompass: true,
        visualizePitch: true,
      });
      this._map.addControl(this._navigationControl);
    }

    await new Promise<void>(resolve => {
      if (this._map.loaded()) {
        resolve();
        return;
      }
      this._map.once('load', () => resolve());
    });

    this._map.resize();
    this._setupViewEvents();
  }

  destroy(): void {
    this.unregisterMap();
    this._map?.remove();
  }

  /**
   * Fires the same onScaleChange/onPostRender callbacks MainView already
   * wires up for OpenLayers, so React state (scale readout, annotation/
   * feature-floater repositioning) stays in sync regardless of engine.
   */
  private _setupViewEvents(): void {
    this._map.on('render', () => {
      this._callbacks?.onPostRender?.();
    });

    this._map.on('contextmenu', event => {
      event.preventDefault();
      this._callbacks?.onContextMenu?.(event.originalEvent, [
        event.lngLat.lng,
        event.lngLat.lat,
      ]);
    });

    this._map.on('error', event => {
      console.error('MapLibre error:', event.error);
    });
  }

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

        const url = this._computeSourceUrl(source);

        const isTms = url.includes('{-y}');

        this._map.addSource(id, {
          type: 'vector',
          tiles: [url],
          scheme: isTms ? 'tms' : 'xyz',
          minzoom: sourceParameters.minZoom,
          maxzoom: sourceParameters.maxZoom,
          attribution: sourceParameters.attribution,
        });

        break;
      }

      case 'RasterSource': {
        const sourceParameters = source.parameters as IRasterSource;
        this._map.addSource(id, {
          type: 'raster',
          tiles: [this._computeSourceUrl(source)],
          tileSize: 256,
          minzoom: sourceParameters.minZoom,
          maxzoom: sourceParameters.maxZoom,
          attribution: sourceParameters.attribution,
        });
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

    this._trackSourceExtZoom(id, source.type);
  }

  removeSource(id: string): void {
    if (this._map.getSource(id)) {
      this._map.removeSource(id);
    }
    this._geojsonData.delete(id);
  }

  async updateSource(id: string, source: IJGISSource): Promise<void> {
    // TODO: update source
    this.removeSource(id);
    await this.addSource(id, source);
  }

  private _computeSourceUrl(source: IJGISSource): string {
    const sourceParameters = source.parameters as IRasterSource;
    const urlParameters = sourceParameters.urlParameters || {};
    let url: string = sourceParameters.url;

    for (const parameterName of Object.keys(urlParameters)) {
      url = url.replace(`{${parameterName}}`, urlParameters[parameterName]);
    }
    if (url.includes('{max_zoom}')) {
      url = url.replace('{max_zoom}', String(sourceParameters.maxZoom));
    }
    if (url.includes('{min_zoom}')) {
      url = url.replace('{min_zoom}', String(sourceParameters.minZoom));
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
    color: string,
    index?: number,
    sourceLayer?: string,
  ): void {
    const visibility = visible ? 'visible' : 'none';

    const sourceLayerProperty = sourceLayer
      ? { 'source-layer': sourceLayer }
      : {};

    this._map.addLayer(
      {
        id: `${id}-fill`,
        type: 'fill',
        source: sourceId,
        ...sourceLayerProperty,
        filter: [
          'any',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        layout: {
          visibility,
        },
        paint: {
          'fill-color': color,
          'fill-opacity': opacity * 0.4,
        },
      },
      this._beforeIdForIndex(index),
    );

    this._map.addLayer(
      {
        id: `${id}-line`,
        type: 'line',
        source: sourceId,
        ...sourceLayerProperty,
        filter: [
          'any',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['geometry-type'], 'MultiLineString'],
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        layout: {
          visibility,
        },
        paint: {
          'line-color': color,
          'line-opacity': opacity,
          'line-width': 2,
        },
      },
      this._beforeIdForIndex(index),
    );

    this._map.addLayer(
      {
        id: `${id}-circle`,
        type: 'circle',
        source: sourceId,
        ...sourceLayerProperty,
        filter: [
          'any',
          ['==', ['geometry-type'], 'Point'],
          ['==', ['geometry-type'], 'MultiPoint'],
        ],
        layout: {
          visibility,
        },
        paint: {
          'circle-color': color,
          'circle-opacity': opacity,
          'circle-radius': 5,
        },
      },
      this._beforeIdForIndex(index),
    );

    this._layerSubIds.set(id, [`${id}-fill`, `${id}-line`, `${id}-circle`]);
  }

  async addLayer(id: string, layer: IJGISLayer, index?: number): Promise<void> {
    this._callbacks?.onLayerAddStarted?.();
    this._loadingLayers.add(id);

    this._log('info', `MapLibreAdapter: adding layer ${id}`);
    try {
      switch (layer.type) {
        case 'VectorLayer': {
          const layerParameters = layer.parameters as IVectorLayer;
          const sourceId = layerParameters.source;

          if (!this._map.getSource(sourceId)) {
            this._log(
              'error',
              `MapLibreAdapter: cannot add layer ${id}, source "${sourceId}" was not found.`,
            );
            return;
          }

          this._addVectorLayerGroup(
            id,
            sourceId,
            layer.visible ?? true,
            layerParameters.opacity ?? 1,
            '#3388ff',
            index,
          );

          this._layerVisibility.set(id, layer.visible ?? true);
          break;
        }

        case 'VectorTileLayer': {
          const sourceId = layer.parameters?.source;

          if (!sourceId || !this._map.getSource(sourceId)) {
            console.warn(`Source ${sourceId} not found for layer ${id}`);
            return;
          }

          const sourceLayer = this._resolveVectorSourceLayer(sourceId);

          if (!sourceLayer) {
            console.warn(`No source-layer found for vector source ${sourceId}`);
            return;
          }

          this._addVectorLayerGroup(
            id,
            sourceId,
            layer.visible ?? true,
            layer.parameters?.opacity ?? 1,
            '#3388ff',
            index,
            sourceLayer,
          );

          this._layerVisibility.set(id, layer.visible ?? true);

          break;
        }

        case 'RasterLayer': {
          const layerParameters = layer.parameters as IRasterLayer;
          const sourceId = layerParameters.source;

          if (!this._map.getSource(sourceId)) {
            this._log(
              'error',
              `MapLibreAdapter: cannot add layer ${id}, source "${sourceId}" was not found.`,
            );
            return;
          }

          this._map.addLayer(
            {
              id,
              type: 'raster',
              source: sourceId,
              layout: {
                visibility: layer.visible ? 'visible' : 'none',
              },
              paint: {
                'raster-opacity': layerParameters.opacity ?? 1,
              },
            },
            this._beforeIdForIndex(index),
          );

          this._layerSubIds.set(id, [id]);
          this._layerVisibility.set(id, layer.visible ?? true);
          break;
        }

        default:
          this._log(
            'warning',
            `MapLibreAdapter: layer type "${layer.type}" is not yet supported. Skipping layer ${id}.`,
          );
          return;
      }

      this._insertIntoLayerOrder(id, index);
      this._trackLayerViewState(id);

      this._callbacks?.onLayerInserted?.(
        this._map.getStyle().layers?.length ?? 0,
      );
    } finally {
      this._loadingLayers.delete(id);
      this._callbacks?.onLayerAddSettled?.(id);

      if (this._loadingLayers.size === 0) {
        this._callbacks?.onAllLayersSettled?.();
      }
    }
  }

  removeLayer(id: string): void {
    const subIds = this._layerSubIds.get(id) ?? [id];
    for (const subId of subIds) {
      if (this._map.getLayer(subId)) {
        this._map.removeLayer(subId);
      }
    }
    this._layerSubIds.delete(id);
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

    const visibility = layer.visible ? 'visible' : 'none';

    switch (layer.type) {
      case 'RasterLayer': {
        const layerParameters = layer.parameters as IRasterLayer;
        this._map.setPaintProperty(
          id,
          'raster-opacity',
          layerParameters.opacity ?? 1,
        );
        this._map.setLayoutProperty(id, 'visibility', visibility);
        break;
      }

      case 'VectorLayer':
      case 'VectorTileLayer': {
        const layerParameters = layer.parameters as
          | IVectorLayer
          | IVectorTileLayer;
        const opacity = layerParameters.opacity ?? 1;
        const color = layerParameters.color?.hex ?? '#3388ff';
        const [fillId, lineId, circleId] = subIds;

        this._map.setPaintProperty(fillId, 'fill-color', color);
        this._map.setPaintProperty(fillId, 'fill-opacity', opacity * 0.4);
        this._map.setPaintProperty(lineId, 'line-color', color);
        this._map.setPaintProperty(lineId, 'line-opacity', opacity);
        this._map.setPaintProperty(circleId, 'circle-color', color);
        this._map.setPaintProperty(circleId, 'circle-opacity', opacity);

        for (const subId of subIds) {
          this._map.setLayoutProperty(subId, 'visibility', visibility);
        }
        break;
      }

      default:
        return;
    }

    this._layerVisibility.set(id, layer.visible ?? true);
  }

  async updateLayers(layerIds: string[]): Promise<void> {
    for (let index = 0; index < layerIds.length; index++) {
      const id = layerIds[index];
      const layer = this._model.getLayers()[id];

      if (!layer) {
        continue;
      }

      const sourceId = layer.parameters?.source;

      if (sourceId) {
        const source = this._model.getSources()[sourceId];

        if (source && !this._map.getSource(sourceId)) {
          await this.addSource(sourceId, source);
        }
      }

      if (!this._layerSubIds.has(id)) {
        await this.addLayer(id, layer, index);
      }
    }

    // Reorder to match layerIds (bottom to top), moving each layer's
    // whole sub-layer group just before the next known layer's group.
    for (let index = layerIds.length - 1; index >= 0; index--) {
      const id = layerIds[index];
      const subIds = this._layerSubIds.get(id);
      if (!subIds) {
        continue;
      }
      const beforeId = this._beforeIdForIndex(index + 1, layerIds);
      for (const subId of subIds) {
        if (this._map.getLayer(subId)) {
          this._map.moveLayer(subId, beforeId);
        }
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

  /**
   * MapLibre layer ids for the JGIS layer that should end up directly
   * above the layer being placed, so it can be inserted `beforeId` it.
   * `order` defaults to _layerOrder (the adapter's own record of what's
   * currently on the map); updateLayers passes the target order being
   * built instead, since _layerOrder hasn't been updated to it yet.
   */
  private _beforeIdForIndex(
    index?: number,
    order: string[] = this._layerOrder,
  ): string | undefined {
    if (index === undefined) {
      return undefined;
    }
    for (let i = index; i < order.length; i++) {
      const subIds = this._layerSubIds.get(order[i]);
      if (subIds?.[0] && this._map.getLayer(subIds[0])) {
        return subIds[0];
      }
    }
    return undefined;
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

  getZoom(): number {
    return this._map.getZoom();
  }

  getViewportId(): string {
    return this._map.getContainer().id;
  }

  getProjection(): IMapProjection {
    return { code: 'EPSG:3857', units: 'm' };
  }

  getPixelFromCoordinate(coordinate: number[]): [number, number] {
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
    const targetCenter: [number, number] = [center.x, center.y];

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
        `MapLibre only supports EPSG:3857; ignoring requested projection ${projection}.`,
      );
    }

    this._map.jumpTo({
      center: [longitude || 0, latitude || 0],
      zoom: zoom || 0,
      bearing: bearing || 0,
      pitch: pitch || 0,
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

  setZoomButtonsEnabled(enabled: boolean | undefined): void {
    if (!enabled && this._navigationControl) {
      this._map.removeControl(this._navigationControl);
      this._navigationControl = undefined;
      return;
    }
    if (enabled && !this._navigationControl) {
      this._navigationControl = new NavigationControl({
        showCompass: true,
        visualizePitch: true,
      });
      this._map.addControl(this._navigationControl);
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
      this._map.removeControl(this._navigationControl);
    }
  }

  exitPresentationMode(): void {
    this.setNavigationEnabled(true);
    if (this._presentationHadNavigationControl && this._navigationControl) {
      this._map.addControl(this._navigationControl);
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
    source?.setData(data as any);
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
  private _mapKey?: string;
  private _loggerRegistry?: ILoggerRegistry;
  private _navigationControl?: NavigationControl;
  private _presentationHadNavigationControl = false;
  private _layerVisibility = new Map<string, boolean>();
  private _loadingLayers: Set<string>;
  private _pendingSourceAdds = new Map<string, Promise<void>>();
  private _geojsonData = new Map<string, GeoJSONFeature | FeatureCollection>();
  private _layerSubIds = new Map<string, string[]>();
  private _layerOrder: string[] = [];
  private _pendingZoomLayerId: string | null = null;
  private _warnedOnce = new Set<string>();
  private _callbacks?: IMapAdapterOptions['callbacks'];
}
