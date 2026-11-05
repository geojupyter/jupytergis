/**
 * @jest-environment jsdom
 */

import type { IJupyterGISModel } from '@jupytergis/schema';

import { maybeProxied } from '../proxy';

jest.mock('@/src/tools', () => ({ isJupyterLite: () => false }));

const PROXY = 'https://proxy.test';
const CDSE = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE';

const model = {
  jgisSettings: { proxyUrl: PROXY },
} as unknown as IJupyterGISModel;

function mockFetch(corsAllowed: (url: string) => boolean, reachable = true) {
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const ok =
        init?.mode === 'no-cors' ? reachable : corsAllowed(String(input));
      if (!ok) {
        throw new TypeError('Failed to fetch');
      }
      return {} as Response;
    },
  );
}

describe('maybeProxied', () => {
  it('proxies only the CDSE URLs that CORS blocks', async () => {
    mockFetch(url => url.includes('/.well-known/'));
    const wellKnown = `${CDSE}/.well-known/openid-configuration`;
    const device = `${CDSE}/protocol/openid-connect/auth/device`;

    expect(await maybeProxied(wellKnown, model)).toBe(wellKnown);
    expect(await maybeProxied(device, model)).toBe(
      `${PROXY}/?url=${encodeURIComponent(device)}`,
    );
  });

  it('does not proxy a server that cannot be reached, and checks it again next time', async () => {
    mockFetch(() => false, false);
    const url = 'https://unreachable.test/data.tif';

    expect(await maybeProxied(url, model)).toBe(url);
    expect(await maybeProxied(url, model)).toBe(url);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });
});
