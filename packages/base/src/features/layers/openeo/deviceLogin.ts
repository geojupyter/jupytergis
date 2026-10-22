import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import {
  AuthProvider,
  Connection,
  OidcClient,
  OidcProviderMeta,
} from '@openeo/js-client';
// @ts-expect-error the env module has no type definitions
import Environment from '@openeo/js-client/src/env';

import { INTERNAL_PROXY_BASE, isJupyterLite } from '@/src/tools';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

// `login.microsoftonline.com/common` multiplexes the two kinds of Microsoft
// account, and its device page is the work/school one. A personal account
// cannot finish on that page: the browser is sent to the app's redirect url
// with an error and polling stays `authorization_pending` until the code
// expires. The per-account-type tenants each serve a page that completes, so
// offer one entry for each instead of the `common` one.
const MICROSOFT_COMMON = 'https://login.microsoftonline.com/common/v2.0';
const MICROSOFT_TENANTS: [string, string][] = [
  ['organizations', 'work or school account'],
  ['consumers', 'personal account'],
];

export interface IDeviceCode {
  verificationUri: string;
  userCode: string;
}

function proxied(url: string): string {
  if (isJupyterLite()) {
    return url;
  }
  return URLExt.join(
    PageConfig.getBaseUrl(),
    `${INTERNAL_PROXY_BASE}?url=${encodeURIComponent(url)}`,
  );
}

async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<any> {
  const response = await Environment.axios.post(
    proxied(url),
    new URLSearchParams(form).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: () => true,
    },
  );
  return response.data;
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Sign-in cancelled.'));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new Error('Sign-in cancelled.'));
      },
      { once: true },
    );
  });
}

/**
 * OpenID Connect sign-in with the device flow, like
 * `authenticate_oidc_device()` in the openEO Python client: show a link and a
 * code, then poll the token endpoint. Identity providers do not accept calls
 * from the Jupyter page, so every request goes through the server proxy.
 */
export class OpenEODeviceProvider extends AuthProvider {
  static create(
    connection: Connection,
    info: OidcProviderMeta,
  ): OpenEODeviceProvider | null {
    return OpenEODeviceProvider.createAll(connection, info)[0] ?? null;
  }

  /**
   * Every sign-in entry this provider offers: one normally, but one per
   * account type on Microsoft's `common` tenant.
   */
  static createAll(
    connection: Connection,
    info: OidcProviderMeta,
  ): OpenEODeviceProvider[] {
    const client = (info.default_clients ?? []).find(c =>
      c.grant_types.some(grant => grant.startsWith(DEVICE_GRANT)),
    );
    if (!client) {
      return [];
    }
    if (info.issuer.replace(/\/$/, '') !== MICROSOFT_COMMON) {
      return [new OpenEODeviceProvider(connection, info, client)];
    }
    return MICROSOFT_TENANTS.map(
      ([tenant, label]) =>
        new OpenEODeviceProvider(connection, info, client, tenant, label),
    );
  }

  private constructor(
    connection: Connection,
    info: OidcProviderMeta,
    client: OidcClient,
    tenant?: string,
    label?: string,
  ) {
    super('oidc', connection, info);
    this.info = info;
    this._issuer = info.issuer
      .replace(/\/$/, '')
      .replace('/common/', tenant ? `/${tenant}/` : '/common/');
    this._scope = (info.scopes?.length ? info.scopes : ['openid']).join(' ');
    this._client = client;
    if (label) {
      this.title = `${this.title} (${label})`;
    }
  }

  async login(
    onCode: (code: IDeviceCode) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const config = (
      await Environment.axios.get(
        proxied(`${this._issuer}/.well-known/openid-configuration`),
      )
    ).data;
    this._tokenEndpoint = config.token_endpoint;

    const deviceRequest: Record<string, string> = {
      client_id: this._client.id,
      scope: this._scope,
    };
    const tokenRequest: Record<string, string> = {
      client_id: this._client.id,
      grant_type: DEVICE_GRANT,
    };
    if (this._client.grant_types.includes(`${DEVICE_GRANT}+pkce`)) {
      const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      deviceRequest.code_challenge = base64Url(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier),
        ),
      );
      deviceRequest.code_challenge_method = 'S256';
      tokenRequest.code_verifier = verifier;
    }
    const device = await postForm(
      config.device_authorization_endpoint,
      deviceRequest,
    );
    if (!device?.device_code) {
      throw new Error(
        device?.error_description ?? device?.error ?? 'Device sign-in failed.',
      );
    }
    tokenRequest.device_code = device.device_code;
    onCode({
      verificationUri:
        device.verification_uri_complete ?? device.verification_uri,
      userCode: device.user_code,
    });

    let interval = (device.interval ?? 5) * 1000;
    const deadline = Date.now() + device.expires_in * 1000;
    while (Date.now() < deadline) {
      await sleep(interval, signal);
      const tokens = await postForm(this._tokenEndpoint, tokenRequest);
      if (tokens.access_token) {
        this._setTokens(tokens);
        return;
      }
      if (tokens.error === 'slow_down') {
        interval += 5000;
      } else if (tokens.error !== 'authorization_pending') {
        throw new Error(tokens.error_description ?? tokens.error);
      }
    }
    throw new Error('The sign-in code expired. Please try again.');
  }

  async logout(): Promise<void> {
    window.clearTimeout(this._refreshTimer);
    await super.logout();
  }

  private _setTokens(tokens: any): void {
    this.setToken(tokens.access_token);
    window.clearTimeout(this._refreshTimer);
    if (tokens.refresh_token && tokens.expires_in) {
      this._refreshTimer = window.setTimeout(
        () => void this._refresh(tokens.refresh_token),
        Math.max(tokens.expires_in - 60, 30) * 1000,
      );
    }
  }

  private async _refresh(refreshToken: string): Promise<void> {
    // The scope must be sent again, or Microsoft returns a token the
    // backend cannot validate.
    const tokens = await postForm(this._tokenEndpoint, {
      client_id: this._client.id,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: this._scope,
    });
    if (tokens.access_token) {
      this._setTokens({ refresh_token: refreshToken, ...tokens });
    } else {
      this.setToken(null);
    }
  }

  readonly info: OidcProviderMeta;
  private _issuer: string;
  private _scope: string;
  private _client: OidcClient;
  private _tokenEndpoint = '';
  private _refreshTimer = 0;
}

/**
 * Replace each device provider the factory built with every sign-in entry it
 * offers, so the Microsoft `common` tenant shows one chip per account type.
 */
export function expandDeviceProviders(
  connection: Connection,
  providers: AuthProvider[],
): AuthProvider[] {
  return providers.flatMap(provider =>
    provider instanceof OpenEODeviceProvider
      ? OpenEODeviceProvider.createAll(connection, provider.info)
      : [provider],
  );
}
