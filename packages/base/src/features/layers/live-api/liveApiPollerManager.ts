import {
  ILiveApiSource,
  IJGISSourceDocChange,
  IJGISLayerDocChange,
  IJupyterGISDoc,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { Notification } from '@jupyterlab/apputils';
import { IDisposable } from '@lumino/disposable';

import { fetchLiveApiPosition } from './fetchLiveApiPosition';
import { DEFAULT_LIVE_API_POLL_MS } from './liveApiTypes';

function listLiveApiSourceIds(model: IJupyterGISModel): string[] {
  const sources = model.getSources() ?? {};
  return Object.entries(sources)
    .filter(([, source]) => source.type === 'LiveApiSource')
    .map(([id]) => id);
}

function isLiveApiSourceVisible(
  model: IJupyterGISModel,
  sourceId: string,
): boolean {
  const layerIds = model.sharedModel.getLayersBySource(sourceId);
  if (layerIds.length === 0) {
    return false;
  }

  return layerIds.some(layerId => {
    const layer = model.getLayer(layerId);
    return layer?.visible !== false;
  });
}

export type LiveApiFeatureApplier = (
  sourceId: string,
  longitude: number,
  latitude: number,
  properties: Record<string, unknown>,
) => void;

interface IPollerState {
  timer: number;
  abort: AbortController | null;
  url: string;
  pollIntervalMs: number;
}

/**
 * Polls every LiveApiSource and pushes positions into OpenLayers sources.
 */
export class LiveApiPollerManager implements IDisposable {
  constructor(model: IJupyterGISModel) {
    this._model = model;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Called by MainView so polls can update OL vector features without
   * writing geometry into the document model.
   */
  setFeatureApplier(applier: LiveApiFeatureApplier | null): void {
    this._featureApplier = applier;
  }

  connect(): void {
    this._model.sharedSourcesChanged.connect(this._onSourcesChanged, this);
    this._model.sharedLayersChanged.connect(this._onLayersChanged, this);
  }

  /** Start/stop/restart pollers to match LiveApiSource entries in the doc. */
  syncFromModel(): void {
    if (this._isDisposed) {
      return;
    }

    const liveIds = new Set(listLiveApiSourceIds(this._model));

    for (const sourceId of this._pollers.keys()) {
      if (!liveIds.has(sourceId)) {
        this._stopOne(sourceId);
      }
    }

    for (const sourceId of liveIds) {
      this._ensurePolling(sourceId);
    }
  }

  /** Force an immediate poll */
  pollNow(sourceId: string): void {
    if (!isLiveApiSourceVisible(this._model, sourceId)) {
      return;
    }

    if (!this._pollers.has(sourceId)) {
      this._ensurePolling(sourceId);
      return;
    }

    void this._tick(sourceId);
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this._model.sharedSourcesChanged.disconnect(this._onSourcesChanged, this);
    this._model.sharedLayersChanged.disconnect(this._onLayersChanged, this);

    for (const sourceId of [...this._pollers.keys()]) {
      this._stopOne(sourceId);
    }

    this._featureApplier = null;
  }

  private _onSourcesChanged(
    _: IJupyterGISDoc,
    _change: IJGISSourceDocChange,
  ): void {
    this.syncFromModel();
  }

  private _onLayersChanged(
    _: IJupyterGISDoc,
    _change: IJGISLayerDocChange,
  ): void {
    this.syncFromModel();
  }

  private _ensurePolling(sourceId: string): void {
    const source = this._model.getSource(sourceId);
    if (!source || source.type !== 'LiveApiSource') {
      this._stopOne(sourceId);
      return;
    }

    if (!isLiveApiSourceVisible(this._model, sourceId)) {
      this._stopOne(sourceId);
      return;
    }

    const parameters = source.parameters as ILiveApiSource;
    const url = parameters.url;
    const pollIntervalMs =
      typeof parameters.pollIntervalMs === 'number' &&
      parameters.pollIntervalMs >= 1000
        ? parameters.pollIntervalMs
        : DEFAULT_LIVE_API_POLL_MS;

    const existing = this._pollers.get(sourceId);
    if (
      existing &&
      existing.url === url &&
      existing.pollIntervalMs === pollIntervalMs
    ) {
      return;
    }

    this._stopOne(sourceId);

    const state: IPollerState = {
      timer: 0,
      abort: null,
      url,
      pollIntervalMs,
    };

    this._pollers.set(sourceId, state);

    const tick = (): void => {
      void this._tick(sourceId);
    };

    tick();
    state.timer = window.setInterval(tick, pollIntervalMs);
  }

  private _stopOne(sourceId: string): void {
    const state = this._pollers.get(sourceId);
    if (!state) {
      return;
    }

    window.clearInterval(state.timer);
    state.abort?.abort();
    this._pollers.delete(sourceId);
  }

  private async _tick(sourceId: string): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    const state = this._pollers.get(sourceId);
    if (!state) {
      return;
    }

    const source = this._model.getSource(sourceId);
    if (!source || source.type !== 'LiveApiSource') {
      this._stopOne(sourceId);
      return;
    }

    state.abort?.abort();
    state.abort = new AbortController();

    try {
      const position = await fetchLiveApiPosition(
        this._model,
        source.parameters as ILiveApiSource,
        state.abort.signal,
      );

      if (this._isDisposed || !this._pollers.has(sourceId)) {
        return;
      }

      this._featureApplier?.(
        sourceId,
        position.longitude,
        position.latitude,
        position.properties,
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      Notification.error(`Live API poll failed: ${message}`, {
        autoClose: 6000,
      });
    }
  }

  private _model: IJupyterGISModel;
  private _pollers = new Map<string, IPollerState>();
  private _featureApplier: LiveApiFeatureApplier | null = null;
  private _isDisposed = false;
}
