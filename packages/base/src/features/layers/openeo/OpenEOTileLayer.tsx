import {
  showErrorMessage,
  Dialog,
  Notification,
  ReactWidget,
  showDialog,
} from '@jupyterlab/apputils';
import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { Connection, OpenEO, Process, Service } from '@openeo/js-client';
// @ts-expect-error
import Environment from '@openeo/js-client/src/env';
import TileLayer from 'ol/layer/Tile';
import { XYZ as XYZSource } from 'ol/source';
import { Options as XYZOptions } from 'ol/source/XYZ';
import React from 'react';

import {
  describeConnectionError,
  INTERNAL_PROXY_BASE,
  isJupyterLite,
} from '@/src/tools';
import { ensureSaveResult } from './templates';

Environment.axios.defaults.xsrfCookieName = '_xsrf';
Environment.axios.defaults.xsrfHeaderName = 'X-XSRFToken';
Environment.axios.defaults.withCredentials = true;

const CONNECTIONS: { [serverUrl: string]: Connection } = {};

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
 * trigger sign-in flow via `connect()`. On successful sign-in
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
      await openEOConnect(info);
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

/**
 * The OpenEO servers we currently hold live connections for, ordered
 * oldest-first (insertion/recency order — see `connect`). Used to
 * populate the server picker in the Add/Edit OpenEO Layer dialog so the
 * user can switch between previously-authenticated servers without
 * signing in again. Global to all documents.
 */
export function listOpenEOConnections(): string[] {
  return Object.keys(CONNECTIONS);
}

/**
 * The most recently used OpenEO connection, or null if none. Used to
 * pre-fill the Add OpenEO Layer dialog so a new layer reuses the server
 * the user last worked with.
 */
export function getLatestOpenEOConnection(): IOpenEOConnectionInfo | null {
  const urls = Object.keys(CONNECTIONS);
  const latest = urls[urls.length - 1];
  return latest ? { url: latest } : null;
}

/**
 * Return the live `Connection` for `serverUrl` if the user is currently
 * signed in to it. Throws otherwise — callers (the tile source, the
 * dialog) are expected to surface the error and re-establish the session
 * (silently from a persisted bearer, or via the sign-in flow).
 */
function getOpenEOConnection(serverUrl: string): Connection {
  // Match `openEOConnect()`'s normalization so cache lookups are consistent.
  let url = serverUrl;
  if (url && !url.match(/^https?:\/\//i)) {
    url = `https://${url}`;
  }
  const connection = CONNECTIONS[url];
  if (!connection) {
    throw new Error(
      `Not connected to OpenEO server "${serverUrl}". Sign in via the "Add OpenEO Layer" dialog or use "Edit OpenEO Layer…" to reconnect.`,
    );
  }
  return connection;
}

interface ISigninValues {
  serverUrl: string;
  username: string;
  password: string;
}

class SigninWidget extends ReactWidget {
  private _serverUrl: string;
  private _username = '';
  private _password = '';

  constructor(initialServerUrl = '') {
    super();

    this._serverUrl = initialServerUrl;
  }

  getValue(): ISigninValues {
    return {
      serverUrl: this._serverUrl,
      username: this._username,
      password: this._password,
    };
  }

  protected render(): React.ReactElement {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: '320px',
        }}
      >
        <label>
          <div style={{ marginBottom: '4px' }}>Server URL</div>
          <input
            className="jp-mod-styled"
            type="text"
            defaultValue={this._serverUrl}
            onChange={e => {
              this._serverUrl = e.target.value;
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: '4px' }}>Username</div>
          <input
            className="jp-mod-styled"
            type="text"
            onChange={e => {
              this._username = e.target.value;
            }}
            style={{ width: '100%' }}
          />
        </label>

        <label>
          <div style={{ marginBottom: '4px' }}>Password</div>
          <input
            className="jp-mod-styled"
            type="password"
            onChange={e => {
              this._password = e.target.value;
            }}
            style={{ width: '100%' }}
          />
        </label>
      </div>
    );
  }
}

async function showSigninDialog(
  serverUrl?: string,
): Promise<ISigninValues | null> {
  const body = new SigninWidget(serverUrl);

  const result = await showDialog({
    title: 'Signin to OpenEO tile server',
    body,
    buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Sign In' })],
  });

  if (!result.button.accept) {
    return null;
  }

  return body.getValue();
}

export async function openEOConnect(
  connectionInfo: IOpenEOConnectionInfo,
): Promise<Connection> {
  let { url } = connectionInfo;
  // Pre-supplied credentials short-circuit the sign-in dialog — useful
  // when the caller is itself inside another JupyterLab Dialog, since
  // nested showDialog calls queue and never actually display until the
  // outer one closes.
  let signIn: ISigninValues | null = connectionInfo.signIn ?? null;

  if (!url) {
    signIn = await showSigninDialog(url);

    if (!signIn) {
      throw new Error('Needs credentials to connect to OpenEO server.');
    }

    url = signIn.serverUrl;
  }

  if (!url.match(/^https?:\/\//i)) {
    url = `https://${url}`;
  }

  // TODO use the proxy setting instead similar to what fetchWithProxies does
  // When in JupyterLab, use the internal proxy
  const useProxy = !isJupyterLite();
  if (useProxy) {
    url = URLExt.join(
      PageConfig.getBaseUrl(),
      `${INTERNAL_PROXY_BASE}?url=${encodeURIComponent(url)}`,
    );
  }

  // Already connected to that server url. Re-insert so the cache stays
  // ordered by recency (last key === most recently used), and reflect the
  // resolved url + live bearer back so callers can persist them even when
  // no fresh sign-in happened (otherwise a second layer reusing the cached
  // connection would save a null bearer and prompt on reload).
  if (CONNECTIONS[url]) {
    const existing = CONNECTIONS[url];
    delete CONNECTIONS[url];
    CONNECTIONS[url] = existing;
    connectionInfo.url = url;
    return existing;
  }

  const errorTitle = 'Failed to connect to the OpenEO server';

  const parsedUrl = new URL(url);
  if (
    window.location.protocol === 'https:' &&
    parsedUrl.protocol !== 'https:'
  ) {
    showErrorMessage(
      errorTitle,
      'You are trying to connect to a server with HTTP instead of HTTPS, which is insecure and prohibited by web browsers. Please use HTTPS instead.',
    );
    throw new Error(errorTitle);
  }

  try {
    const connection = await OpenEO.connect(url, {
      addNamespaceToProcess: true,
    });

    if (useProxy) {
      // @ts-expect-error We monkey patch this when using our proxy
      connection.baseUrl = URLExt.join(
        PageConfig.getBaseUrl(),
        `${INTERNAL_PROXY_BASE}?url=${encodeURIComponent(connection.baseUrl)}`,
      );
    }

    if (!connection.isAuthenticated()) {
      if (!signIn) {
        // TODO Add support for signin dialogs for OIDC?
        signIn = await showSigninDialog(url);

        if (!signIn) {
          throw new Error('Needs credentials to connect to OpenEO server.');
        }
      }

      const providers = await connection.listAuthProviders();
      const authProvider = providers.find(
        provider => provider.type === 'basic',
      );
      if (!authProvider) {
        throw new Error('Failed to get "basic" OpenEO provider.');
      }

      await authProvider.login(signIn.username, signIn.password);
    }

    const serviceTypes = await connection.listServiceTypes();

    // TODO Support other services?
    if (!serviceTypes['XYZ']) {
      throw new Error('We need the OpenEO service to support XYZ tiling.');
    }

    CONNECTIONS[url] = connection;

    connectionInfo.url = url;

    // NB: we intentionally do NOT emit `openEOEvents.connected` here. A tile
    // source that calls openEOConnect() during its own construction renders itself
    // once this resolves; emitting would make mainView rebuild it
    // re-entrantly and fire a duplicate createService. Only promptOpenEOLogin
    // (the sign-in recovery path) emits, to rebuild sources that were waiting.

    return connection;
  } catch (error) {
    showErrorMessage(errorTitle, describeConnectionError(error, url));

    throw error;
  }
}

export interface IOpenEOConnectionInfo {
  /**
   * The url to the open-eo server.
   */
  url?: string;

  /**
   * Optional pre-supplied credentials. When set, openEOConnect() uses these
   * directly instead of opening the sign-in dialog — useful when the
   * caller is itself a dialog (JupyterLab queues nested dialogs, so the
   * sign-in popup would otherwise never appear).
   */
  signIn?: ISigninValues;
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
   * Optional tile service URL. If not provided, we'll try to create the service.
   */
  tileServiceURL?: string;
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

    this._initializeTileServiceURL(options);
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

  private async _initializeTileServiceURL(options: IOpenEOTileSourceOptions) {
    // If we already have a tile service URL, use it
    // This happens when e.g. the service was created Python side, or we are refreshing the page.
    if (options.tileServiceURL) {
      // TODO Frequently make sure the tile service is still up?
      // If not up, we should prompt the user for reconnecting
      this._url = options.tileServiceURL;

      this._connected.resolve();

      this.refresh();

      return;
    }

    // Otherwise, try to create the service URL
    try {
      this._connection = getOpenEOConnection(options.serverUrl);
    } catch {
      await promptOpenEOLogin(options.serverUrl);
    }

    if (!this._connection) {
      throw new Error('Failed to get OpenEO service connection');
    }

    // Inject `save_result` for graphs that omit it (e.g. ESA UDPs).
    const graph = ensureSaveResult(options.processGraph);

    let service: Service | null = null;

    try {
      service = await this._connection.createService(graph, 'XYZ');
    } catch (e) {
      throw new Error(`Failed to create the XYZ service ${e}`);
    }

    if (!service.url) {
      throw new Error('Failed to connect to XYZ service');
    }

    this._url = service.url;

    this._connected.resolve();

    this.refresh();
  }

  private _url: string | null = null;

  private _connection: Connection | null = null;

  private _connected: PromiseDelegate<void> = new PromiseDelegate();

  processGraph: Process;

  serverUrl: string;
}
