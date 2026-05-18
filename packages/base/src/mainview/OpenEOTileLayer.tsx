import {
  showErrorMessage,
  Dialog,
  ReactWidget,
  showDialog,
} from '@jupyterlab/apputils';
import { PromiseDelegate } from '@lumino/coreutils';
import { Connection, OpenEO, Process, Service } from '@openeo/js-client';
import TileLayer from 'ol/layer/Tile';
import { ProjectionLike } from 'ol/proj';
import { XYZ as XYZSource } from 'ol/source';
import { Options as XYZOptions } from 'ol/source/XYZ';
import React from 'react';

const CONNECTIONS: { [serverUrl: string]: Connection } = {};

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
  let signIn: ISigninValues | null = null;

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

  // Already connected to that server url
  if (CONNECTIONS[url]) {
    return CONNECTIONS[url];
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

    const providers = await connection.listAuthProviders();

    let providerType = 'basic';
    let token: string | null = null;
    if (authBearer) {
      providerType = authBearer.split('/')[0];
      token = authBearer.split('/')[2];
    }

    const authProvider = providers.find(
      provider => provider.type === providerType,
    );
    if (!authProvider) {
      throw new Error(`Failed to get "${providerType}" OpenEO provider.`);
    }

    if (token) {
      authProvider.setToken(token);
    } else {
      if (!signIn) {
        // TODO Add support for signin dialogs for OIDC?
        signIn = await showSigninDialog(url);

        if (!signIn) {
          throw new Error('Needs credentials to connect to OpenEO server.');
        }
      }

      await authProvider.login(signIn.username, signIn.password);

      const token = authProvider.getToken();

      if (token) {
        connectionInfo.authBearer = token;
      }
    }

    const serviceTypes = await connection.listServiceTypes();

    // TODO Support other services?
    if (!serviceTypes['XYZ']) {
      throw new Error('We need the OpenEO service to support XYZ tiling.');
    }

    CONNECTIONS[url] = connection;

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
   * The connection info.
   */
  connectionInfo: IOpenEOConnectionInfo;
}

export class OpenEOTileSource extends XYZSource {
  constructor(options: IOpenEOTileSourceOptions) {
    super({
      ...options,
      url: '{z},{x},{y}',
      tileLoadFunction: async (tile: any, src: string) => {
        await this._connected.promise;

        let url = this._url;

        if (!url) {
          throw new Error('XYZ URL undefined');
        }

        const [z, x, y] = tile.tileCoord;

        url = url.replace('%7Bz%7D', z);
        url = url.replace('%7By%7D', y);
        url = url.replace('%7Bx%7D', x);

        const res = await fetch(url, {
          method: 'GET',
        });
        const blob = await res.blob();

        tile.getImage().src = URL.createObjectURL(blob);
      },
    });

    this._connect(options.connectionInfo, options.processGraph);
  }

  private async _connect(
    connectionInfo: IOpenEOConnectionInfo,
    graph: Process,
  ) {
    this._connection = await connect(connectionInfo);

    if (!this._connection) {
      throw new Error('Failed to get OpenEO connection');
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

  connectionInfo: IOpenEOConnectionInfo;
}
