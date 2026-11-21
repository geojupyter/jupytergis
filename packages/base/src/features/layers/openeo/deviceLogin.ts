import {
  AuthProvider,
  Connection,
  OidcClient,
  OidcProviderMeta,
} from '@openeo/js-client';
// @ts-expect-error the env module has no type definitions
import Environment from '@openeo/js-client/src/env';

import { maybeProxied } from '@/src/shared/proxy';
import { getOpenEOTokensProvider } from './tokens';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

export interface IDeviceCode {
  verificationUri: string;
  userCode: string;
}

async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<any> {
  const response = await Environment.axios.post(
    await maybeProxied(url),
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
  ): OpenEODeviceProvider {
    return new OpenEODeviceProvider(connection, info);
  }

  private constructor(connection: Connection, info: OidcProviderMeta) {
    super('oidc', connection, info);
    this._issuer = info.issuer.replace(/\/$/, '');
    this._scope = (info.scopes?.length ? info.scopes : ['openid']).join(' ');
    this._clients = info.default_clients ?? [];
    this._clientId =
      this._clients.find(c =>
        c.grant_types.some(grant => grant.startsWith(DEVICE_GRANT)),
      )?.id ?? '';
  }

  get clientId(): string {
    return this._clientId;
  }

  setClientId(clientId: string): void {
    this._clientId = clientId;
  }

  /** Signs back in with the refresh token the last session left behind. */
  async resumeSession(): Promise<boolean> {
    const refreshToken = await getOpenEOTokensProvider()?.get(
      this._issuer,
      this._clientId,
    );
    if (!refreshToken) {
      return false;
    }

    try {
      await this._discover();
      return await this._refresh(refreshToken);
    } catch {
      return false;
    }
  }

  async login(
    onCode: (code: IDeviceCode) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const config = await this._discover();

    const deviceRequest: Record<string, string> = {
      client_id: this._clientId,
      scope: this._scope,
    };
    const tokenRequest: Record<string, string> = {
      client_id: this._clientId,
      grant_type: DEVICE_GRANT,
    };
    if (
      this._clients.some(
        c =>
          c.id === this._clientId &&
          c.grant_types.includes(`${DEVICE_GRANT}+pkce`),
      )
    ) {
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
    await getOpenEOTokensProvider()?.remove(this._issuer, this._clientId);
    await super.logout();
  }

  private async _discover(): Promise<any> {
    const config = (
      await Environment.axios.get(
        await maybeProxied(`${this._issuer}/.well-known/openid-configuration`),
      )
    ).data;
    this._tokenEndpoint = config.token_endpoint;
    return config;
  }

  private _setTokens(tokens: any): void {
    this.setToken(tokens.access_token);
    window.clearTimeout(this._refreshTimer);
    if (tokens.refresh_token) {
      void getOpenEOTokensProvider()?.set(
        this._issuer,
        this._clientId,
        tokens.refresh_token,
      );
    }
    if (tokens.refresh_token && tokens.expires_in) {
      this._refreshTimer = window.setTimeout(
        () => void this._refresh(tokens.refresh_token),
        Math.max(tokens.expires_in - 60, 30) * 1000,
      );
    }
  }

  private async _refresh(refreshToken: string): Promise<boolean> {
    // The scope must be sent again, or Microsoft returns a token the
    // backend cannot validate.
    const tokens = await postForm(this._tokenEndpoint, {
      client_id: this._clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: this._scope,
    });
    if (tokens.access_token) {
      this._setTokens({ refresh_token: refreshToken, ...tokens });
      return true;
    }

    // Expired or revoked: drop it so we stop trying on every reload.
    await getOpenEOTokensProvider()?.remove(this._issuer, this._clientId);
    this.setToken(null);
    return false;
  }

  private _issuer: string;
  private _scope: string;
  private _clients: OidcClient[];
  private _clientId: string;
  private _tokenEndpoint = '';
  private _refreshTimer = 0;
}
