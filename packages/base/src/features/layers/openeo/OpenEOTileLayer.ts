import { Dialog, Notification, showDialog } from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { Connection, Process, Service } from '@openeo/js-client';
import TileLayer from 'ol/layer/Tile';
import { XYZ as XYZSource } from 'ol/source';
import { Options as XYZOptions } from 'ol/source/XYZ';

import { connect, getOpenEOConnection, IOpenEOConnectionInfo } from './signin';
import { ensureSaveResult } from './templates';

/**
 * Singleton event hub for OpenEO connection lifecycle. Mainly used so the
 * map can rebuild any `OpenEOTileSource` that failed to construct because
 * the session wasn't available yet (typical after a page reload) the
 * moment the user signs back in to the same server.
 */
class OpenEOEvents {
  readonly connected = new Signal<this, { serverUrl: string }>(this);
}
export const openEOEvents = new OpenEOEvents();

/**
 * Show a small "Log in" dialog for `serverUrl` and, if the user accepts,
 * trigger Martin's sign-in flow via `connect()`. On successful sign-in
 * the resulting `openEOEvents.connected` signal causes mainView to rebuild
 * any tile sources that were waiting on this server.
 *
 * Deduplicated per serverUrl so that N broken layers from the same server
 * don't pop N dialogs on document load.
 */
const _pendingLoginPrompts = new Set<string>();
async function promptOpenEOLogin(serverUrl: string): Promise<void> {
  if (_pendingLoginPrompts.has(serverUrl)) {
    return;
  }
  _pendingLoginPrompts.add(serverUrl);
  try {
    const result = await showDialog({
      title: 'OpenEO session required',
      body: `Not signed in to ${serverUrl}. Log in to render this document's OpenEO layers.`,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Log in' })],
    });
    if (!result.button.accept) {
      return;
    }
    try {
      const info: IOpenEOConnectionInfo = { url: serverUrl };
      await connect(info);
      // Now that the session is live, ask mainView to rebuild the OpenEO
      // layers that bailed out while waiting for sign-in. Only this
      // recovery path emits `connected` — a normal restore builds each
      // source exactly once and renders itself, so it must not trigger a
      // second (re-entrant) rebuild that would fire a duplicate
      // createService request.
      openEOEvents.connected.emit({ serverUrl: info.url ?? serverUrl });
    } catch {
      // `connect` already surfaced the error / the user cancelled the
      // sign-in form. The layers stay unrendered; the user can try again
      // by editing a layer or re-opening this dialog through another
      // failed render.
    }
  } finally {
    _pendingLoginPrompts.delete(serverUrl);
  }
}

export class OpenEOTileLayer extends TileLayer {
  // Just an alias
}

export interface IOpenEOTileSourceOptions extends XYZOptions {
  /**
   * The process graph value.
   */
  processGraph: Process;

  /**
   * The OpenEO server URL. The live connection is resolved from the
   * module-level `CONNECTIONS` cache via `getOpenEOConnection`.
   */
  serverUrl: string;

  /**
   * Optional persisted session bearer. When the server isn't already in
   * the in-memory cache (e.g. right after a page reload, or a document
   * opened from a notebook session), it is used to re-establish the
   * connection silently instead of prompting the user to sign in again.
   */
  authBearer?: string;
}

export class OpenEOTileSource extends XYZSource {
  constructor(options: IOpenEOTileSourceOptions) {
    super({
      ...options,
      url: '{z},{x},{y}',
      tileLoadFunction: async (tile: any, _src: string) => {
        await this._connected.promise;

        let url = this._url;

        if (!url) {
          throw new Error('XYZ URL undefined');
        }

        const [z, x, y] = tile.tileCoord;

        // openEO backends vary in how they format XYZ service URLs:
        // some return raw `{z}/{x}/{y}` placeholders, others return them
        // URL-encoded as `%7Bz%7D/...`. Handle both forms so the same
        // code works against either kind of backend.
        url = url.replace('%7Bz%7D', z).replace('{z}', z);
        url = url.replace('%7By%7D', y).replace('{y}', y);
        url = url.replace('%7Bx%7D', x).replace('{x}', x);

        let res: Response;
        try {
          res = await fetch(url, { method: 'GET' });
        } catch (err: any) {
          this._reportTileError(
            `Tile request failed: ${err?.message ?? String(err)}`,
          );
          tile.setState(3);
          return;
        }

        if (!res.ok) {
          // Try to surface the backend's actual message rather than a
          // bare HTTP status — titiler-openeo, like most openEO
          // backends, returns JSON `{ message: ... }` on errors.
          let detail = '';
          try {
            const text = await res.text();
            try {
              const parsed = JSON.parse(text);
              detail =
                parsed?.message ?? parsed?.detail ?? parsed?.error ?? text;
            } catch {
              detail = text;
            }
          } catch {
            /* response body unreadable */
          }
          this._reportTileError(
            `HTTP ${res.status} from OpenEO tile service${detail ? `: ${detail}` : ''}`,
          );
          tile.setState(3);
          return;
        }

        const blob = await res.blob();
        tile.getImage().src = URL.createObjectURL(blob);
      },
    });

    this.serverUrl = options.serverUrl;
    this.authBearer = options.authBearer;
    this._connect(options.serverUrl, options.authBearer, options.processGraph);
  }

  /**
   * Surface a tile-load failure as a JupyterLab toast, deduped so a
   * panned area with N broken tiles doesn't fire N notifications. Each
   * distinct error message reappears at most once per cooldown window.
   */
  private _reportTileError(message: string): void {
    const now = Date.now();
    const last = this._lastTileErrors.get(message) ?? 0;
    if (now - last < 5000) {
      return;
    }
    this._lastTileErrors.set(message, now);
    Notification.error(`OpenEO layer: ${message}`, { autoClose: 6000 });
    // eslint-disable-next-line no-console
    console.warn('[openeo] tile load error:', message);
  }
  private _lastTileErrors = new Map<string, number>();

  /**
   * Resolve the live OpenEO connection for `serverUrl` and create an XYZ
   * service for the process graph. Resolution order:
   *   1. The in-memory cache, if the user already signed in this session.
   *   2. A persisted `authBearer` (e.g. saved from a notebook session),
   *      used to re-establish the connection silently.
   *   3. Otherwise surface a "Log in" dialog and leave the layer
   *      unrendered until the user signs back in — once they do,
   *      `openEOEvents.connected` fires and mainView reconstructs this
   *      source.
   */
  private async _connect(
    serverUrl: string,
    authBearer: string | undefined,
    graph: Process,
  ) {
    try {
      this._connection = getOpenEOConnection(serverUrl);
    } catch {
      if (authBearer) {
        try {
          this._connection = await connect({ url: serverUrl, authBearer });
        } catch {
          void promptOpenEOLogin(serverUrl);
          return;
        }
      } else {
        void promptOpenEOLogin(serverUrl);
        return;
      }
    }
    this._connected.resolve();
    this._updateUrl(graph);
  }

  private async _updateUrl(processGraph: Process) {
    await this._connected.promise;

    if (!this._connection) {
      throw new Error('Failed to get OpenEO service connection');
    }

    let service: Service | null = null;

    // Inject `save_result` for graphs that omit it (e.g. ESA UDPs).
    const graph = ensureSaveResult(processGraph);

    try {
      service = await this._connection.createService(graph, 'XYZ');
    } catch (e) {
      throw new Error(`Failed to connect to XYZ service ${e}`);
    }

    if (!service.url) {
      throw new Error('Failed to connect to XYZ service');
    }

    this._url = service.url;

    this.refresh();
  }

  private _url: string | null = null;

  private _connection: Connection | null = null;

  private _connected: PromiseDelegate<void> = new PromiseDelegate();

  processGraph: Process;

  serverUrl: string;

  authBearer?: string;
}
