import { collectionPlainText, pickCollectionPreview } from '../catalogQuery';
import { IStacAsset, IStacLink } from '../types/types';

function asset(href: string, roles: string[]): IStacAsset {
  return { href, roles };
}

describe('pickCollectionPreview', () => {
  it('prefers an overview asset over a thumbnail', () => {
    const assets: Record<string, IStacAsset> = {
      thumb: asset('https://example.test/thumb.png', ['thumbnail']),
      wide: asset('https://example.test/wide.png', ['overview']),
    };

    expect(pickCollectionPreview(assets)).toBe('https://example.test/wide.png');
  });

  it('uses a thumbnail when there is no overview', () => {
    const assets: Record<string, IStacAsset> = {
      thumb: asset('https://example.test/thumb.png', ['thumbnail']),
      wms: asset('https://example.test/wms', ['wms']),
    };

    expect(pickCollectionPreview(assets)).toBe(
      'https://example.test/thumb.png',
    );
  });

  it('falls back to a preview link', () => {
    const links: IStacLink[] = [
      { rel: 'self', href: 'https://example.test/collection' },
      { rel: 'preview', href: 'https://example.test/preview.png' },
    ];

    expect(pickCollectionPreview(undefined, links)).toBe(
      'https://example.test/preview.png',
    );
  });

  it('returns null when nothing can be shown', () => {
    expect(pickCollectionPreview(undefined)).toBeNull();
  });
});

describe('collectionPlainText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(collectionPlainText('<p>Lake&nbsp;  level</p>')).toBe('Lake level');
  });
});
