import {
  IGeoJSONSource,
  IJGISSourceDocChange,
  IJupyterGISDoc,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { IDisposable } from '@lumino/disposable';

import { findIssTrackerSourceId } from './createIssLayer';
import {
  fetchIssPosition,
  ISS_TRACKER_NAME,
  issPositionToGeoJson,
} from './issApi';

const POLL_MS = 5000;

/**
 * Polls the ISS position API and writes lon/lat into a GeoJSONSource.
 */
export class IssTracker implements IDisposable {
  constructor(model: IJupyterGISModel) {
    this._model = model;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /** Start (or restart) polling for `sourceId`. */
  start(sourceId: string): void {
    this.stop();
    this._sourceId = sourceId;
    void this._tick();
    this._timer = window.setInterval(() => {
      void this._tick();
    }, POLL_MS);
  }

  stop(): void {
    if (this._timer !== null) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
    this._abort?.abort();
    this._abort = null;
    this._sourceId = null;
  }

  /**
   * Resume polling if an ISS Tracker source is already in the document.
   */
  syncFromModel(): void {
    const sourceId = findIssTrackerSourceId(this._model);
    if (sourceId) {
      if (this._sourceId !== sourceId || this._timer === null) {
        this.start(sourceId);
      }
      return;
    }
    this.stop();
  }

  /** Watch source add/remove so the poller tracks the document. */
  connect(): void {
    this._model.sharedSourcesChanged.connect(this._onSourcesChanged, this);
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._model.sharedSourcesChanged.disconnect(this._onSourcesChanged, this);
    this.stop();
  }

  private _onSourcesChanged(
    _: IJupyterGISDoc,
    change: IJGISSourceDocChange,
  ): void {
    if (this._isDisposed) {
      return;
    }

    const changes = change.sourceChange ?? [];
    const ourId = this._sourceId;

    for (const entry of changes) {
      const isRemoval =
        !entry.newValue || Object.keys(entry.newValue).length === 0;

      // Our tracked source was removed — stop or pick up another ISS source.
      if (ourId && entry.id === ourId && isRemoval) {
        this.stop();
        this.syncFromModel();
        return;
      }

      // New ISS source appeared while idle (e.g. collaborator / reopen).
      if (
        !isRemoval &&
        entry.newValue?.type === 'GeoJSONSource' &&
        entry.newValue.name === ISS_TRACKER_NAME &&
        this._timer === null
      ) {
        this.start(entry.id);
        return;
      }
    }
  }

  private async _tick(): Promise<void> {
    const sourceId = this._sourceId;
    if (!sourceId || this._isDisposed) {
      return;
    }

    this._abort?.abort();
    this._abort = new AbortController();

    try {
      const position = await fetchIssPosition(this._abort.signal);
      if (this._isDisposed || this._sourceId !== sourceId) {
        return;
      }

      const source = this._model.getSource(sourceId);
      if (!source || source.type !== 'GeoJSONSource') {
        this.stop();
        return;
      }

      const parameters: IGeoJSONSource = {
        ...(source.parameters as IGeoJSONSource),
        data: issPositionToGeoJson(position) as IGeoJSONSource['data'],
        path: null,
      };

      this._model.sharedModel.updateSource(sourceId, {
        ...source,
        parameters,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      console.warn('ISS poll failed', error);
    }
  }

  private _model: IJupyterGISModel;
  private _sourceId: string | null = null;
  private _timer: number | null = null;
  private _abort: AbortController | null = null;
  private _isDisposed = false;
}
