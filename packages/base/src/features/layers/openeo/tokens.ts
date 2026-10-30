import type { IOpenEOTokensProvider } from '@jupytergis/schema';

export const OPENEO_TOKENS_KEY = 'JGIS-OpenEO-refresh-tokens';
export const OPENEO_SERVERS_KEY = 'JGIS-OpenEO-servers';

interface IStoredToken {
  date: string;
  refresh_token: string;
}

type StoredTokens = Record<string, Record<string, IStoredToken>>;

/** Seconds, like `rfc3339.now_utc()` in the openEO Python client. */
function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

/** Trailing slashes only, like `_normalize_url` in the openEO Python client. */
function normalize(server: string): string {
  return server.replace(/\/+$/, '') || '/';
}

/**
 * Keeps the tokens in `localStorage`, in the same shape as the openEO Python
 * client's `~/.local/share/openeo-python-client/refresh-tokens.json`.
 */
export class LocalStorageOpenEOTokensProvider implements IOpenEOTokensProvider {
  async get(server: string, provider: string): Promise<string | null> {
    const tokens = this._load();
    return tokens[normalize(server)]?.[provider]?.refresh_token ?? null;
  }

  async set(server: string, provider: string, token: string): Promise<void> {
    const tokens = this._load();
    const key = normalize(server);
    tokens[key] = {
      ...tokens[key],
      [provider]: { date: now(), refresh_token: token },
    };
    this._save(tokens);
  }

  async remove(server: string, provider: string): Promise<void> {
    const tokens = this._load();
    const key = normalize(server);
    if (!tokens[key]?.[provider]) {
      return;
    }
    delete tokens[key][provider];
    if (!Object.keys(tokens[key]).length) {
      delete tokens[key];
    }
    this._save(tokens);
  }

  private _load(): StoredTokens {
    try {
      const raw = window.localStorage.getItem(OPENEO_TOKENS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      // Hand-edited or unreadable: start over rather than fail every sign-in.
      return {};
    }
  }

  private _save(tokens: StoredTokens): void {
    try {
      window.localStorage.setItem(OPENEO_TOKENS_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.warn('Could not save the openEO tokens', error);
    }
  }
}

let tokensProvider: IOpenEOTokensProvider | null = null;

/** Installs the store the openEO sign-in saves its tokens to. */
export function setOpenEOTokensProvider(provider: IOpenEOTokensProvider): void {
  tokensProvider = provider;
}

/** The installed store, or null when no plugin provides one. */
export function getOpenEOTokensProvider(): IOpenEOTokensProvider | null {
  return tokensProvider;
}

/** The openEO servers signed in to before, most recent last. */
export function rememberedOpenEOServers(): string[] {
  try {
    const raw = window.localStorage.getItem(OPENEO_SERVERS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed)
      ? parsed.filter(s => typeof s === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Remembers a server so a reload knows where to pick the session back up. */
export function rememberOpenEOServer(server: string): void {
  const servers = rememberedOpenEOServers().filter(s => s !== server);
  servers.push(server);
  try {
    window.localStorage.setItem(OPENEO_SERVERS_KEY, JSON.stringify(servers));
  } catch (error) {
    console.warn('Could not save the openEO servers', error);
  }
}
