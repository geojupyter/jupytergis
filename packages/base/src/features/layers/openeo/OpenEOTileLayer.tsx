import {
  showErrorMessage,
  Dialog,
  Notification,
  ReactWidget,
  showDialog,
} from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { Connection, OpenEO, Process, Service } from '@openeo/js-client';
import TileLayer from 'ol/layer/Tile';
import { ProjectionLike } from 'ol/proj';
import { XYZ as XYZSource } from 'ol/source';
import { Options as XYZOptions } from 'ol/source/XYZ';
import React from 'react';

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
 * trigger Martin's sign-in flow via `connect()`. On successful sign-in
 * the resulting `openEOEvents.connected` signal causes mainView to rebuild
 * any tile sources that were waiting on this server.
 *
 * Deduplicated per serverUrl so that N broken layers from the same server
 * don't pop N dialogs on document load.
 */
const _pendingLoginPrompts = new Set<string>();
export async function promptOpenEOLogin(serverUrl: string): Promise<void> {
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
      await connect({ url: serverUrl });
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
export function getOpenEOConnection(serverUrl: string): Connection {
  // Match `connect()`'s normalization so cache lookups are consistent.
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

export interface ISigninValues {
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

export async function connect(
  connectionInfo: IOpenEOConnectionInfo,
): Promise<Connection> {
  let { url } = connectionInfo;
  const { authBearer } = connectionInfo;
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

  // Already connected to that server url. Re-insert so the cache stays
  // ordered by recency (last key === most recently used).
  if (CONNECTIONS[url]) {
    const existing = CONNECTIONS[url];
    delete CONNECTIONS[url];
    CONNECTIONS[url] = existing;
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

    // Restore a previously-persisted session without prompting. The
    // bearer is stored in openEO's canonical `type/providerId/token` form
    // (the same form Python's `connection.auth.bearer` uses), so it can be
    // handed straight to `setAuthToken`. We don't persist
    // `AuthProvider.getToken()` directly: on JWT backends it returns a
    // bare token with no `type/providerId/` prefix, which we couldn't
    // parse back — that was why reloads kept prompting for sign-in.
    if (authBearer) {
      const [type, providerId, ...rest] = authBearer.split('/');
      const token = rest.join('/');
      if (type && token) {
        connection.setAuthToken(type, providerId ?? '', token);
      }
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

      // Persist in canonical form so the session can be restored after a
      // reload (see above).
      if (authProvider.token) {
        connectionInfo.authBearer = `${authProvider.getType()}/${authProvider.getProviderId()}/${authProvider.token}`;
      }
    }

    const serviceTypes = await connection.listServiceTypes();

    // TODO Support other services?
    if (!serviceTypes['XYZ']) {
      throw new Error('We need the OpenEO service to support XYZ tiling.');
    }

    CONNECTIONS[url] = connection;

    // Reflect the resolved server url back so callers (e.g. the layer
    // creation dialog) can persist it alongside the bearer token.
    connectionInfo.url = url;

    // Let listeners (mainView) rebuild any OpenEO layers that were
    // waiting on this server — typical after a page reload, where the
    // in-memory connection cache starts empty.
    openEOEvents.connected.emit({ serverUrl: url });

    return connection;
  } catch (error) {
    showErrorMessage(errorTitle, `${error}`);

    throw error;
  }
}

export interface IOpenEOConnectionInfo {
  /**
   * The url to the open-eo server.
   */
  url?: string;

  /**
   * The session bearer.
   */
  authBearer?: string;

  /**
   * Optional pre-supplied credentials. When set, connect() uses these
   * directly instead of opening the sign-in dialog — useful when the
   * caller is itself a dialog (JupyterLab queues nested dialogs, so the
   * sign-in popup would otherwise never appear).
   */
  signIn?: ISigninValues;
}

export interface IOpenEOTileLayerOptions {
  /**
   * The tile size
   */
  projection?: ProjectionLike;
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

    try {
      service = await this._connection.createService(processGraph, 'XYZ');
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
