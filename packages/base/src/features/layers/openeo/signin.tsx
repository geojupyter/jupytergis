import {
  showErrorMessage,
  Dialog,
  ReactWidget,
  showDialog,
} from '@jupyterlab/apputils';
import type { AuthProvider } from '@openeo/js-client';
import { OidcProvider, Connection, OpenEO } from '@openeo/js-client';
import React from 'react';

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

const CONNECTIONS: { [serverUrl: string]: Connection } = {};

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

export interface IPasswordSignin {
  username: string;
  password: string;
}

export interface IOIDCSignin {
  providerId: string;
}

export interface ISigninBasicProps {
  provider: AuthProvider;
  value: IPasswordSignin;
  onChange: (value: IPasswordSignin) => void;
}

export interface ISigninOIDCProps {
  providers: AuthProvider[];
  value: IOIDCSignin;
  onChange: (value: IOIDCSignin) => void;
}

export function OpenEOSigninBasic({
  provider,
  value,
  onChange,
}: ISigninBasicProps): React.ReactElement {
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
        <div style={{ marginBottom: '4px' }}>Username</div>
        <input
          className="jp-mod-styled"
          type="text"
          value={value.username}
          onChange={event =>
            onChange({ ...value, username: event.target.value })
          }
          style={{ width: '100%' }}
        />
      </label>

      <label>
        <div style={{ marginBottom: '4px' }}>Password</div>
        <input
          className="jp-mod-styled"
          type="password"
          value={value.password}
          onChange={event =>
            onChange({ ...value, password: event.target.value })
          }
          style={{ width: '100%' }}
        />
      </label>
    </div>
  );
}

export function OpenEOSigninOIDC({
  providers,
  value,
  onChange,
}: ISigninOIDCProps): React.ReactElement {
  const oidcProviders = providers.filter(
    provider => provider.getType() === 'oidc',
  );

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
        <div style={{ marginBottom: '4px' }}>OpenID Connect provider</div>
        <select
          className="jp-mod-styled"
          value={value.providerId}
          onChange={event =>
            onChange({
              providerId: event.target.value,
            })
          }
          style={{ width: '100%' }}
        >
          <option value="" disabled>
            Select a provider
          </option>
          {oidcProviders.map(provider => (
            <option
              key={provider.getProviderId()}
              value={provider.getProviderId()}
            >
              {provider.getTitle()}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/**
 * Build openEO's canonical `type/providerId/token` bearer string from a
 * live connection's active auth provider, or `undefined` if it isn't
 * authenticated. This is the form we persist (and `connect()` restores),
 * rather than `AuthProvider.getToken()` which drops the prefix on JWT
 * backends.
 */
function bearerFromConnection(connection: Connection): string | undefined {
  const provider = connection.getAuthProvider();
  if (!provider || !provider.token) {
    return undefined;
  }
  return `${provider.getType()}/${provider.getProviderId()}/${provider.token}`;
}

type SigninType = 'basic' | 'oidc';

export interface ISigninValues {
  type: SigninType;
  data: IPasswordSignin | IOIDCSignin;
}

class SigninDialogBody extends ReactWidget {
  private _serverUrl: string;
  private _providers: AuthProvider[];
  private _value: ISigninValues;
  private _signinType: SigninType;

  constructor(serverUrl: string, providers: AuthProvider[]) {
    super();
    this._serverUrl = serverUrl;
    this._providers = providers;

    const firstOidc = providers.find(provider => provider.getType() === 'oidc');
    const hasBasic = providers.some(provider => provider.getType() === 'basic');

    this._signinType = firstOidc ? 'oidc' : 'basic';

    this._value = firstOidc
      ? {
          type: 'oidc',
          data: { providerId: firstOidc.getProviderId() },
        }
      : {
          type: 'basic',
          data: { username: '', password: '' },
        };

    if (!firstOidc && !hasBasic) {
      throw new Error('No supported OpenEO authentication providers found.');
    }
  }

  getValue(): ISigninValues {
    return this._value;
  }

  protected render(): React.ReactElement {
    const basicProvider = this._providers.find(
      provider => provider.getType() === 'basic',
    );

    const oidcProviders = this._providers.filter(
      provider => provider.getType() === 'oidc',
    );

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: '320px',
        }}
      >
        <div>Signing into {this._serverUrl}</div>
        <label>
          <div style={{ marginBottom: '4px' }}>Authentication method</div>
          <select
            className="jp-mod-styled"
            value={this._signinType}
            onChange={event => {
              const type = event.target.value as SigninType;
              this._signinType = type;

              if (type === 'oidc') {
                this._value = {
                  type: 'oidc',
                  data: {
                    providerId: oidcProviders[0]?.getProviderId() ?? '',
                  },
                };
              } else {
                this._value = {
                  type: 'basic',
                  data: { username: '', password: '' },
                };
              }

              this.update();
            }}
            style={{ width: '100%' }}
          >
            {basicProvider && (
              <option value="basic">Username / password</option>
            )}
            {oidcProviders.length > 0 && (
              <option value="oidc">OpenID Connect</option>
            )}
          </select>
        </label>

        {this._signinType === 'basic' && basicProvider && (
          <OpenEOSigninBasic
            provider={basicProvider}
            value={this._value.data as IPasswordSignin}
            onChange={data => {
              this._value = { type: 'basic', data };
              this.update();
            }}
          />
        )}

        {this._signinType === 'oidc' && (
          <OpenEOSigninOIDC
            providers={oidcProviders}
            value={this._value.data as IOIDCSignin}
            onChange={data => {
              this._value = { type: 'oidc', data };
              this.update();
            }}
          />
        )}
      </div>
    );
  }
}

export async function showSigninDialog(
  serverUrl: string,
  providers: AuthProvider[],
): Promise<ISigninValues | null> {
  const body = new SigninDialogBody(serverUrl, providers);

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
  const { url } = connectionInfo;
  let { authBearer } = connectionInfo;
  // Pre-supplied credentials short-circuit the sign-in dialog — useful
  // when the caller is itself inside another JupyterLab Dialog, since
  // nested showDialog calls queue and never actually display until the
  // outer one closes.
  // let signIn: ISigninValues | null = connectionInfo.signIn ?? null;

  // TODO Server URL UI?
  // if (!url) {
  //   signIn = await showSigninDialog(url);

  //   if (!signIn) {
  //     throw new Error('Needs credentials to connect to OpenEO server.');
  //   }

  //   url = signIn.serverUrl;
  // }
  if (!url) {
    throw new Error('No server URL provided');
  }

  // if (!url.match(/^https?:\/\//i)) {
  //   url = `https://${url}`;
  // }

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
    connectionInfo.authBearer = bearerFromConnection(existing) ?? authBearer;
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

    // Restore a previously persisted session.
    // if (authBearer) {
    //   const [type, providerId, ...rest] = authBearer.split('/');
    //   const token = rest.join('/');

    //   if (type && token) {
    //     connection.setAuthToken(type, providerId ?? '', token);
    //   }
    // }

    if (!connection.isAuthenticated()) {
      const providers = await connection.listAuthProviders();

      const signIn = await showSigninDialog(url, providers);

      if (!signIn) {
        throw new Error('Needs credentials to connect to OpenEO server.');
      }

      let authProvider: AuthProvider | undefined;

      if (signIn.type === 'basic') {
        authProvider = providers.find(
          provider => provider.getType() === 'basic',
        );

        if (!authProvider) {
          throw new Error('Failed to get "basic" OpenEO provider.');
        }

        const data = signIn.data as IPasswordSignin;

        await authProvider.login(data.username, data.password);
      } else if (signIn.type === 'oidc') {
        const oidcSignin = signIn;

        const data = signIn.data as IOIDCSignin;

        authProvider = providers.find(
          provider =>
            provider.getType() === 'oidc' &&
            provider.getProviderId() === data.providerId,
        );

        if (!authProvider) {
          throw new Error(`Failed to get OIDC provider "${data.providerId}".`);
        }
        console.log('DEBUG OidcProvider.redirectUrl', OidcProvider.redirectUrl);

        if (OidcProvider.redirectUrl.startsWith('http:')) {
          OidcProvider.redirectUrl = OidcProvider.redirectUrl.replace(
            'http:',
            'https:',
          );
        }
        // if (OidcProvider.redirectUrl.includes('localhost')) {
        //   OidcProvider.redirectUrl = OidcProvider.redirectUrl.replace('localhost', '127.0.0.1');
        // }

        const oidcProvider = (authProvider as unknown as OidcProvider);
        // oidcProvider.setGrant('client_credentials');

        oidcProvider.setClientId('cdse-public');

        console.log('DEBUG LOGIN!!');
        await oidcProvider.login();
        console.log('DEBUG LOGIN IN!!!!!!');
      }

      if (!authProvider) {
        throw new Error(`Unknown signin type ${signIn.type}`);
      }

      // Persist the canonical OpenEO bearer representation.
      const token = authProvider.getToken();
      if (token) {
        authBearer = [
          authProvider.getType(),
          authProvider.getProviderId() ?? '',
          token,
        ].join('/');
      }
    }

    const serviceTypes = await connection.listServiceTypes();

    // TODO Support other services?
    if (!serviceTypes['XYZ']) {
      throw new Error('We need the OpenEO service to support XYZ tiling.');
    }

    CONNECTIONS[url] = connection;

    // Reflect the resolved server url + live bearer back so callers (the
    // layer dialog) can persist them. The bearer is stored in canonical
    // form so `connect()` can restore the session after a reload (see
    // above).
    connectionInfo.url = url;
    connectionInfo.authBearer = bearerFromConnection(connection) ?? authBearer;

    // NB: we intentionally do NOT emit `openEOEvents.connected` here. A tile
    // source that calls connect() during its own construction renders itself
    // once this resolves; emitting would make mainView rebuild it
    // re-entrantly and fire a duplicate createService. Only promptOpenEOLogin
    // (the sign-in recovery path) emits, to rebuild sources that were waiting.

    return connection;
  } catch (error) {
    showErrorMessage(errorTitle, `${error}`);

    throw error;
  }
}
