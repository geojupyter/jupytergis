/**
 * @jest-environment jsdom
 */

import { LocalStorageOpenEOTokensProvider, OPENEO_TOKENS_KEY } from '../tokens';

const ISSUER = 'https://identity.example.org/auth/realms/openeo';
const CLIENT = 'openeo-jupytergis-client';

describe('LocalStorageOpenEOTokensProvider', () => {
  let provider: LocalStorageOpenEOTokensProvider;

  beforeEach(() => {
    window.localStorage.clear();
    provider = new LocalStorageOpenEOTokensProvider();
  });

  it('reads back what it stored', async () => {
    await provider.set(ISSUER, CLIENT, 'the-refresh-token');

    expect(await provider.get(ISSUER, CLIENT)).toBe('the-refresh-token');
  });

  it('stores the tokens in the shape the Python client uses', async () => {
    await provider.set(ISSUER, CLIENT, 'the-refresh-token');

    const stored = JSON.parse(
      window.localStorage.getItem(OPENEO_TOKENS_KEY) as string,
    );
    expect(stored).toEqual({
      [ISSUER]: {
        [CLIENT]: {
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
          refresh_token: 'the-refresh-token',
        },
      },
    });
  });

  it('ignores a trailing slash on the issuer, like the Python client', async () => {
    await provider.set(`${ISSUER}/`, CLIENT, 'the-refresh-token');

    expect(await provider.get(ISSUER, CLIENT)).toBe('the-refresh-token');
  });

  it('keeps the other issuers and clients when one is removed', async () => {
    await provider.set(ISSUER, CLIENT, 'first');
    await provider.set(ISSUER, 'another-client', 'second');
    await provider.set('https://other.example.org', CLIENT, 'third');

    await provider.remove(ISSUER, CLIENT);

    expect(await provider.get(ISSUER, CLIENT)).toBeNull();
    expect(await provider.get(ISSUER, 'another-client')).toBe('second');
    expect(await provider.get('https://other.example.org', CLIENT)).toBe(
      'third',
    );
  });

  it('starts over when the stored value is not usable', async () => {
    window.localStorage.setItem(OPENEO_TOKENS_KEY, 'not json');

    expect(await provider.get(ISSUER, CLIENT)).toBeNull();

    await provider.set(ISSUER, CLIENT, 'the-refresh-token');
    expect(await provider.get(ISSUER, CLIENT)).toBe('the-refresh-token');
  });
});
