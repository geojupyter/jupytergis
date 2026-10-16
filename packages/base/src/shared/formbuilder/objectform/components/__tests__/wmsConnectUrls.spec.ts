import { wmsConnectUrls } from '../wmsConnectUrls';

const CAPABILITIES = 'SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities';

describe('wmsConnectUrls', () => {
  it('appends a capabilities query to a service root', () => {
    expect(wmsConnectUrls('https://example.test/geoserver/ows')).toEqual({
      root: 'https://example.test/geoserver/ows',
      capabilitiesUrl: `https://example.test/geoserver/ows?${CAPABILITIES}`,
    });
  });

  it('keeps a pasted capabilities url and stores the service root', () => {
    const text =
      'https://example.test/geoserver/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities';

    expect(wmsConnectUrls(text)).toEqual({
      root: 'https://example.test/geoserver/ows',
      capabilitiesUrl: text,
    });
  });

  it('fills in missing capabilities parameters', () => {
    expect(
      wmsConnectUrls('https://example.test/geoserver/ows?SERVICE=WMS'),
    ).toEqual({
      root: 'https://example.test/geoserver/ows',
      capabilitiesUrl:
        'https://example.test/geoserver/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities',
    });
  });
});
