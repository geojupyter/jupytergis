import { MapLibreOverlay } from '@deck.gl/maplibre';
import type {
  IJGISSource,
  IJupyterGISModel,
  IPolygonSource,
  ITripsSource,
  IGeoJSONSource,
} from '@jupytergis/schema';
import { PathExt } from '@jupyterlab/coreutils';
import type { Map as MlMap } from 'maplibre-gl';

import { fetchWithProxies } from '@/src/tools';
import { animate, type AnimationControls } from './animate';
import {
  buildDeckOverlayLayers,
  clearTripTimingForSource,
  computeTripTiming,
  DECK_OVERLAY_LAYER_TYPES,
  JSON_RECORD_SOURCES,
  makeCachedGetter,
  type LogFn,
  type RecordGetter,
  type TripTiming,
} from './createDeckLayers';

const MS_PER_TIMESTAMP_UNIT = 60;

/**
 * Hosts a MapLibreOverlay and builds Trips/Polygon/GeoJson deck layers for
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
    this._stopTripAnimation();
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

      const label = source.type === 'TripsSource' ? 'trips' : 'polygon';
      const data = await this._loadJsonPayload(
        id,
        source,
        source.parameters as ITripsSource | IPolygonSource | undefined,
        label,
      );
      if (!data) {
        return false;
      }

      this._jsonRecords.set(
        id,
        this._asJsonRecordArray(data, source.name ?? id, label),
      );
      if (source.type === 'TripsSource') {
        clearTripTimingForSource(this._tripTimingCache, id);
      }
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

  removeSource(id: string): void {
    this._jsonRecords.delete(id);
    this._geoJsonData.delete(id);
    clearTripTimingForSource(this._tripTimingCache, id);
  }

  syncLayers(layerIds: string[]): void {
    if (!this._overlay) {
      return;
    }

    this._layerIds = layerIds.filter(id => {
      const layer = this._model.getLayer(id);
      return layer && this.isDeckLayerType(layer.type);
    });

    const ctx = {
      jsonRecords: this._jsonRecords,
      geoJsonData: this._geoJsonData,
      tripTime: this._tripTime,
      getSource: (id: string) => this._model.getSource(id),
      getter: this._getter,
      tripTiming: (
        sourceId: string,
        expression: string,
        records: unknown[],
        getTimestamps: RecordGetter,
      ) =>
        computeTripTiming(
          this._tripTimingCache,
          sourceId,
          expression,
          records,
          getTimestamps,
        ),
      log: this._log,
    };

    const { layers, tripPlayback } = buildDeckOverlayLayers(
      this._layerIds,
      id => this._model.getLayer(id),
      ctx,
    );

    this._overlay.setProps({ layers: layers as any });

    if (tripPlayback) {
      this._startTripAnimation(
        tripPlayback.from,
        tripPlayback.to,
        tripPlayback.animationSpeed,
      );
    } else {
      this._stopTripAnimation();
    }
  }

  private _startTripAnimation(
    from: number,
    to: number,
    animationSpeed: number,
  ): void {
    const span = to - from;
    const durationMs = (span * MS_PER_TIMESTAMP_UNIT) / animationSpeed;
    const key = `${from}\0${to}\0${durationMs}`;
    if (this._tripAnimation && this._tripPlaybackKey === key) {
      return;
    }

    this._stopTripAnimation();
    this._tripPlaybackKey = key;
    this._tripAnimation = animate({
      from,
      to,
      duration: durationMs,
      repeat: Infinity,
      onUpdate: time => {
        this._tripTime = time;
        if (this._overlay && this._layerIds.length) {
          this.syncLayers(this._layerIds);
        }
      },
    });
  }

  private _stopTripAnimation(): void {
    this._tripAnimation?.stop();
    this._tripAnimation = undefined;
    this._tripPlaybackKey = undefined;
    this._tripTime = 0;
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
        data = await fetchWithProxies(path, this._model, async response =>
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
        `MapLibreDeck: ${label} source "${source.name ?? id}" could not be loaded: ${error}`,
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
  private _tripAnimation?: AnimationControls;
  private _tripPlaybackKey?: string;
  private _tripTime = 0;
  private _jsonRecords = new Map<string, unknown[]>();
  private _geoJsonData = new Map<string, unknown>();
  private _getters = new Map<string, RecordGetter>();
  private _tripTimingCache = new Map<string, TripTiming>();
  private _getter: (expression: string) => RecordGetter;
}
