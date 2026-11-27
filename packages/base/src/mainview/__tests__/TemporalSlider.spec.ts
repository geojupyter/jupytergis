/**
 * @jest-environment jsdom
 *
 * Behavioural test for the temporal controller (issue #2025): dragging the
 * slider must hand the renderer a layer whose grammar guards carry the time
 * window, since the grammar compilers never read `layer.filters`.
 */

jest.mock('@jupytergis/schema', () => ({}));
jest.mock('@fortawesome/free-solid-svg-icons', () => ({
  faPause: 'pause',
  faPlay: 'play',
}));
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => null,
}));
jest.mock('@jupyter/react-components', () => {
  const React = jest.requireActual('react');
  return {
    Button: (props: any) =>
      React.createElement('button', { onClick: props.onClick }),
    Slider: (props: any) =>
      React.createElement('input', {
        'data-testid': 'slider',
        type: 'range',
        onChange: props.onChange,
      }),
  };
});

const FEATURE_PROPERTIES = {
  // Two ISO dates, five months apart.
  time: new Set(['2024-01-01', '2024-06-01']),
  name: new Set(['Paris', 'Berlin']),
};
jest.mock('@/src/features/layers/symbology/hooks/useGetProperties', () => ({
  useGetProperties: () => ({
    featureProperties: FEATURE_PROPERTIES,
    isLoading: false,
  }),
}));

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Simulate, act } from 'react-dom/test-utils';

import TemporalSlider from '@/src/mainview/TemporalSlider';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const LAYER_ID = 'layer-1';

function makeDocLayer() {
  return {
    name: 'temporal',
    type: 'VectorLayer',
    visible: true,
    parameters: {
      source: 'source-1',
      opacity: 1,
      symbologyState: {
        layers: [
          {
            id: 'gl-1',
            when: [{ type: 'geometryType', value: 'Point' }],
            whenOp: 'all',
            rules: [
              {
                id: 'r-1',
                mappings: [
                  {
                    scale: {
                      scheme: 'constant_rgba',
                      params: { value: [255, 0, 0, 1] },
                    },
                    encodings: ['circle-fill-color'],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

function makeModel() {
  const signal = () => ({ connect: jest.fn(), disconnect: jest.fn() });
  return {
    localState: { selected: { value: { [LAYER_ID]: {} } } },
    selectedChanged: signal(),
    sharedLayersChanged: signal(),
    isTemporalControllerActive: true,
    toggleTemporalController: jest.fn(),
    // The real model hands out a deep copy, so local edits never reach the doc.
    getLayer: jest.fn(() => makeDocLayer()),
    triggerLayerUpdate: jest.fn(),
    addFeatureAsMs: jest.fn(),
  };
}

describe('TemporalSlider', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('narrows every grammar layer to the slider window on change', () => {
    const model = makeModel();
    act(() => {
      root.render(
        React.createElement(TemporalSlider, {
          model: model as any,
          filterStates: {},
        }),
      );
    });

    expect(model.addFeatureAsMs).toHaveBeenCalledWith(LAYER_ID, 'time');

    const start = Date.parse('2024-02-01');
    const slider = container.querySelector('[data-testid="slider"]')!;
    act(() => {
      Simulate.change(slider, { target: { value: String(start) } } as any);
    });

    expect(model.triggerLayerUpdate).toHaveBeenCalledTimes(1);
    const [id, layer] = model.triggerLayerUpdate.mock.calls[0];
    expect(id).toBe(LAYER_ID);

    const [grammarLayer] = layer.parameters.symbologyState.layers;
    expect(grammarLayer.whenOp).toBe('all');
    expect(grammarLayer.when).toHaveLength(2);
    expect(grammarLayer.when[0]).toEqual({
      type: 'geometryType',
      value: 'Point',
    });
    const window = grammarLayer.when[1];
    expect(window).toMatchObject({
      type: 'between',
      field: 'timems',
      min: start,
    });
    expect(window.max).toBeGreaterThan(start);

    // The legacy filter list still carries the window for non-grammar paths.
    expect(layer.filters.appliedFilters).toEqual([
      expect.objectContaining({
        feature: 'timems',
        operator: 'between',
        betweenMin: start,
        betweenMax: window.max,
      }),
    ]);

    // The guards of the layers the model handed out were left alone; the
    // window only lives on the copy given to triggerLayerUpdate.
    const handedOut = model.getLayer.mock.results.map((r) => r.value);
    expect(handedOut.length).toBeGreaterThan(0);
    for (const docLayer of handedOut) {
      expect(docLayer.parameters.symbologyState.layers[0].when).toHaveLength(1);
    }
  });
});
