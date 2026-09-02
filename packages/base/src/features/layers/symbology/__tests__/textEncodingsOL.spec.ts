/**
 * End-to-end check that compiled label styles are valid OpenLayers.
 *
 * grammarToOLStyle.spec.ts asserts the shape of the compiler output with OL
 * mocked out. That cannot catch an expression OL's own parser rejects, which
 * is the failure mode that matters here: OL type-checks flat styles when the
 * layer is built, and one bad text expression takes the whole layer's
 * symbology down rather than just the label.
 *
 * So these tests run the real thing: compile, hand the result to OL, evaluate
 * against real features, and read the label back off the resulting Style.
 */

// geotiff is pulled in transitively by the compiler's imports and ships as
// ESM that jest cannot parse. ol itself is deliberately NOT mocked here: it is
// the thing under test.
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { IGrammarSymbologyState } from '@jupytergis/schema';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { rulesToStyleFunction } from 'ol/render/canvas/style';
import Style from 'ol/style/Style';

import { grammarToOLStyle } from '../grammarToOLStyle';

function makeState(
  ...rules: IGrammarSymbologyState['layers'][number]['rules']
): IGrammarSymbologyState {
  return { layers: [{ id: 'test-layer', rules }] };
}

/** Compile a grammar state and evaluate it against one feature. */
function labelFor(
  state: IGrammarSymbologyState,
  properties: Record<string, unknown>,
): string | undefined {
  const flatStyle = grammarToOLStyle(state);
  const styleFn = rulesToStyleFunction([{ style: flatStyle as any }]);
  const feature = new Feature({ geometry: new Point([0, 0]), ...properties });
  const styles = styleFn(feature, 1) as Style[] | Style | undefined;
  const style = Array.isArray(styles) ? styles[0] : styles;
  return style?.getText()?.getText() as string | undefined;
}

describe('text encodings through OpenLayers', () => {
  it('labels a feature with a string attribute', () => {
    const state = makeState({
      id: '1',
      fields: ['name'],
      mappings: [{ scale: { scheme: 'identity' }, encodings: ['text-value'] }],
    });
    expect(labelFor(state, { name: 'Kathmandu' })).toBe('Kathmandu');
  });

  it('labels a feature with a numeric attribute', () => {
    const state = makeState({
      id: '1',
      fields: ['population'],
      mappings: [{ scale: { scheme: 'identity' }, encodings: ['text-value'] }],
    });
    expect(labelFor(state, { population: 845767 })).toBe('845767');
  });

  it('renders no label when the attribute is missing', () => {
    const state = makeState({
      id: '1',
      fields: ['name'],
      mappings: [{ scale: { scheme: 'identity' }, encodings: ['text-value'] }],
    });
    expect(labelFor(state, { other: 'x' })).toBe('');
  });

  it('accepts the full basic label style without OL rejecting it', () => {
    const state = makeState(
      {
        id: '1',
        fields: ['name'],
        mappings: [
          { scale: { scheme: 'identity' }, encodings: ['text-value'] },
        ],
      },
      {
        id: '2',
        mappings: [
          {
            scale: { scheme: 'constant_str', params: { value: '13px serif' } },
            encodings: ['text-font'],
          },
          {
            scale: { scheme: 'constant_str', params: { value: 'point' } },
            encodings: ['text-placement'],
          },
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [20, 20, 20, 1] },
            },
            encodings: ['text-fill-color'],
          },
          {
            scale: {
              scheme: 'constant_rgba',
              params: { value: [255, 255, 255, 1] },
            },
            encodings: ['text-stroke-color'],
          },
          {
            scale: { scheme: 'constant_num', params: { value: 3 } },
            encodings: ['text-stroke-width'],
          },
        ],
      },
    );

    const flatStyle = grammarToOLStyle(state);
    const styleFn = rulesToStyleFunction([{ style: flatStyle as any }]);
    const feature = new Feature({
      geometry: new Point([0, 0]),
      name: 'Pokhara',
    });
    const styles = styleFn(feature, 1) as Style[] | Style;
    const style = Array.isArray(styles) ? styles[0] : styles;
    const text = style.getText();

    expect(text?.getText()).toBe('Pokhara');
    expect(text?.getFont()).toBe('13px serif');
    expect(text?.getFill()?.getColor()).toEqual([20, 20, 20, 1]);
    expect(text?.getStroke()?.getWidth()).toBe(3);
  });

  it('hides labels until the map is zoomed in past minZoom', () => {
    const state = makeState({
      id: '1',
      fields: ['name'],
      when: [{ type: 'zoomRange', minZoom: 10 }],
      mappings: [{ scale: { scheme: 'identity' }, encodings: ['text-value'] }],
    });

    const flatStyle = grammarToOLStyle(state);
    const styleFn = rulesToStyleFunction([{ style: flatStyle as any }]);
    const feature = new Feature({
      geometry: new Point([0, 0]),
      name: 'Bhaktapur',
    });

    // Web Mercator metres per pixel: ~152.9 at z10, ~9.55 at z14.
    const readAt = (resolution: number) => {
      const styles = styleFn(feature, resolution) as Style[] | Style;
      const style = Array.isArray(styles) ? styles[0] : styles;
      return style?.getText()?.getText();
    };

    expect(readAt(9.55)).toBe('Bhaktapur');
    expect(readAt(1222)).toBe('');
  });

  it('only labels features matching a when predicate', () => {
    const state = makeState({
      id: '1',
      fields: ['name'],
      when: [{ type: 'fieldEquals', field: 'capital', value: true }],
      mappings: [{ scale: { scheme: 'identity' }, encodings: ['text-value'] }],
    });
    expect(labelFor(state, { name: 'Kathmandu', capital: true })).toBe(
      'Kathmandu',
    );
    expect(labelFor(state, { name: 'Pokhara', capital: false })).toBe('');
  });
});
