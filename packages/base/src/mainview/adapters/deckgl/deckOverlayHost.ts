import { MapLibreOverlay } from '@deck.gl/maplibre';
import type {
  IJGISSource,
  IJupyterGISModel,
  IPolygonSource,
  IGeoJSONSource,
} from '@jupytergis/schema';
import { PathExt } from '@jupyterlab/coreutils';
import type { Map as MlMap } from 'maplibre-gl';

import { errorMessage, fetchWithProxies } from '@/src/tools';

import {
  buildDeckOverlayLayers,
  DECK_OVERLAY_LAYER_TYPES,
  JSON_RECORD_SOURCES,
  makeCachedGetter,
  type LogFn,
  type RecordGetter,
} from './createDeckLayers';

/**
 * Hosts a MapLibreOverlay and builds Polygon/GeoJson deck layers for
 * the MapLibre adapter.
 */
export class DeckOverlayHost {
  constructor(model: IJupyterGISModel, log: LogFn) {
    this._model = model;
    this._log = log;
    this._getter = makeCachedGetter(this._getters, log, 'MapLibreDeck');
  }

  attach(map: MlMap): void {
    this._overlay = new MapLibreOverlay({
      interleaved: false,
      layers: [],
    });
    map.addControl(this._overlay);
  }

  detach(map?: MlMap): void {
    if (this._overlay) {
      if (map) {
        try {
          map.removeControl(this._overlay);
        } catch {
          this._overlay.finalize();
        }
      } else {
        this._overlay.finalize();
      }
    }
    this._overlay = undefined;
    this._layerIds = [];
  }

  isDeckLayerType(type: string): boolean {
    return DECK_OVERLAY_LAYER_TYPES.has(type);
  }

  async ensureSource(id: string, source: IJGISSource): Promise<boolean> {
    if (JSON_RECORD_SOURCES.has(source.type)) {
      if (this._jsonRecords.has(id)) {
        return true;
      }

      const label = 'polygon';
      const data = await this._loadJsonPayload(
        id,
        source,
        source.parameters as IPolygonSource | undefined,
        label,
      );
      if (!data) {
        return false;
      }

      this._jsonRecords.set(
        id,
        this._asJsonRecordArray(data, source.name ?? id, label),
      );
      return true;
    }

    if (source.type === 'GeoJSONSource') {
      if (this._geoJsonData.has(id)) {
        return true;
      }

      const data = await this._loadJsonPayload(
        id,
        source,
        source.parameters as IGeoJSONSource | undefined,
        'geojson',
      );
      if (!data) {
        return false;
      }

      this._geoJsonData.set(id, data);
      return true;
    }

    return false;
  }

  /** Prefer already-loaded GeoJSON (e.g. MapLibre native source cache). */
  setGeoJsonData(id: string, data: unknown): void {
    this._geoJsonData.set(id, data);
  }

  /** Loaded JSON-record payloads for PolygonSource (and similar). */
  getJsonRecords(id: string): unknown[] | undefined {
    return this._jsonRecords.get(id);
  }

  removeSource(id: string): void {
    this._jsonRecords.delete(id);
    this._geoJsonData.delete(id);
  }

  syncLayers(layerIds: string[]): void {
    if (!this._overlay) {
      return;
    }

    this._layerIds = layerIds.filter((id) => {
      const layer = this._model.getLayer(id);
      return layer && this.isDeckLayerType(layer.type);
    });

    const ctx = {
      jsonRecords: this._jsonRecords,
      geoJsonData: this._geoJsonData,
      getSource: (id: string) => this._model.getSource(id),
      getter: this._getter,
      log: this._log,
    };

    const layers = buildDeckOverlayLayers(
      this._layerIds,
      (id) => this._model.getLayer(id),
      ctx,
    );

    this._overlay.setProps({ layers: layers as any });
  }

  private async _loadJsonPayload(
    id: string,
    source: IJGISSource,
    parameters: { path?: string | null; data?: unknown } | undefined,
    label: string,
  ): Promise<unknown> {
    if (parameters?.data !== undefined && parameters?.data !== null) {
      if (!Array.isArray(parameters.data) || parameters.data.length > 0) {
        return parameters.data;
      }
    }

    if (!parameters?.path) {
      this._log(
        'error',
        `MapLibreDeck: ${label} source "${source.name ?? id}" has no data or path.`,
      );
      return undefined;
    }

    const path = parameters.path;
    let data: unknown;
    try {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        data = await fetchWithProxies(path, this._model, async (response) =>
          response.json(),
        );
      } else {
        data = await this._readLocalJson(path);
      }

      if (typeof data === 'string') {
        data = JSON.parse(data) as unknown;
      }
    } catch (error) {
      this._log(
        'error',
        `MapLibreDeck: ${label} source "${source.name ?? id}" could not be loaded: ${errorMessage(error)}`,
      );
      return undefined;
    }

    if (!data) {
      this._log(
        'error',
        `MapLibreDeck: ${label} source "${source.name ?? id}" could not be loaded.`,
      );
      return undefined;
    }

    return data;
  }

  private async _readLocalJson(path: string): Promise<unknown> {
    if (!this._model.contentsManager || !this._model.filePath) {
      throw new Error('ContentsManager or filePath is not initialized.');
    }

    const absolutePath = PathExt.resolve(
      PathExt.dirname(this._model.filePath),
      path,
    );
    const file = await this._model.contentsManager.get(absolutePath, {
      content: true,
    });
    if (!file.content) {
      throw new Error(`File at ${absolutePath} is empty or inaccessible.`);
    }

    switch (file.format) {
      case 'json':
        return file.content;
      case 'text':
        return JSON.parse(file.content) as unknown;
      case 'base64':
        return JSON.parse(atob(file.content)) as unknown;
      default:
        throw new Error(`Invalid deck source file format: ${file.format}.`);
    }
  }

  private _asJsonRecordArray(
    data: unknown,
    sourceName: string,
    label: string,
  ): unknown[] {
    if (!Array.isArray(data)) {
      this._log(
        'warning',
        `MapLibreDeck: ${label} source "${sourceName}" is not a JSON array.`,
      );
      return [];
    }
    return data;
  }

  private readonly _model: IJupyterGISModel;
  private readonly _log: LogFn;
  private _overlay?: MapLibreOverlay;
  private _layerIds: string[] = [];
  private _jsonRecords = new Map<string, unknown[]>();
  private _geoJsonData = new Map<string, unknown>();
  private _getters = new Map<string, RecordGetter>();
  private _getter: (expression: string) => RecordGetter;
}
