import type { IOpenEOTokensProvider } from '@jupytergis/schema';

export const OPENEO_TOKENS_KEY = 'JGIS-OpenEO-refresh-tokens';

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
 * Keeps the openEO refresh tokens in `localStorage`, in the same shape as
 * `~/.local/share/openeo-python-client/refresh-tokens.json`, so the two
 * clients describe a session the same way.
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
      // Unreadable or hand-edited storage: start over rather than break
      // every sign-in from here on.
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

/**
 * Installs the store the openEO sign-in saves its tokens to. Called by the
 * plugin that answers `IOpenEOTokensProviderToken`.
 */
export function setOpenEOTokensProvider(provider: IOpenEOTokensProvider): void {
  tokensProvider = provider;
}

/**
 * The installed token store, or null when nothing provides one. Sessions
 * then last as long as the page does.
 */
export function getOpenEOTokensProvider(): IOpenEOTokensProvider | null {
  return tokensProvider;
}
