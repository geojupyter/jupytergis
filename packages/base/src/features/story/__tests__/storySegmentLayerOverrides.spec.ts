import {
  buildSegmentLayerRows,
  isLayerOverrideChanged,
  resetSegmentLayerOverride,
  setSegmentLayerOpacity,
  setSegmentLayerVisibility,
} from '@/src/features/story/utils/storySegmentLayerOverrides';

describe('storySegmentLayerOverrides', () => {
  const targetLayer = {
    type: 'VectorLayer',
    name: 'floods',
    visible: true,
    parameters: { opacity: 1 },
  };

  const segmentLayer = {
    type: 'StorySegmentLayer',
    name: 'Segment 1',
    visible: true,
    parameters: {
      layerOverride: [{ targetLayer: 'layer-1', visible: false }],
    },
  };

  it('detects visibility overrides as changed', () => {
    expect(
      isLayerOverrideChanged(targetLayer as never, { visible: false }),
    ).toBe(true);
  });

  it('ignores empty symbology overrides', () => {
    expect(
      isLayerOverrideChanged(
        targetLayer as never,
        {
          targetLayer: 'layer-1',
          symbologyState: {
            layers: [
              {
                id: 'ec1ba238-0a8a-48fe-8540-60ae1d5f9d7f',
                rules: [],
              },
            ],
          },
        } as never,
      ),
    ).toBe(false);
  });

  it('ignores empty symbology overrides', () => {
    expect(
      isLayerOverrideChanged(targetLayer as never, {
        targetLayer: 'layer-1',
        symbologyState: {
          layers: [
            {
              id: 'ec1ba238-0a8a-48fe-8540-60ae1d5f9d7f',
              rules: [],
            },
          ],
        },
      } as never),
    ).toBe(false);
  });

  it('builds rows from the layer tree', () => {
    const model = {
      getLayerTree: () => ['layer-1'],
      getLayer: (id: string) => {
        if (id === 'layer-1') {
          return targetLayer;
        }
        if (id === 'segment-1') {
          return segmentLayer;
        }
        return undefined;
      },
    };

    expect(buildSegmentLayerRows(model as never, 'segment-1')).toEqual([
      {
        layerId: 'layer-1',
        layerName: 'floods',
        baseVisible: true,
        effectiveVisible: false,
        baseOpacity: 1,
        effectiveOpacity: 1,
        isChanged: true,
        hasStyleOverride: false,
      },
    ]);
  });

  it('removes redundant visibility overrides', () => {
    const updateObjectParameters = jest.fn();
    const model = {
      getLayer: (id: string) => {
        if (id === 'layer-1') {
          return targetLayer;
        }
        if (id === 'segment-1') {
          return {
            ...segmentLayer,
            parameters: {
              layerOverride: [{ targetLayer: 'layer-1', visible: false }],
            },
          };
        }
        return undefined;
      },
      sharedModel: { updateObjectParameters },
    };

    setSegmentLayerVisibility(model as never, 'segment-1', 'layer-1', true);

    expect(updateObjectParameters).toHaveBeenCalledWith('segment-1', {
      layerOverride: [],
    });
  });

  it('stores opacity overrides and removes redundant values', () => {
    const updateObjectParameters = jest.fn();
    const model = {
      getLayer: (id: string) => {
        if (id === 'layer-1') {
          return targetLayer;
        }
        if (id === 'segment-1') {
          return {
            ...segmentLayer,
            parameters: { layerOverride: [] },
          };
        }
        return undefined;
      },
      sharedModel: { updateObjectParameters },
    };

    setSegmentLayerOpacity(model as never, 'segment-1', 'layer-1', 0.5);

    expect(updateObjectParameters).toHaveBeenCalledWith('segment-1', {
      layerOverride: [{ targetLayer: 'layer-1', opacity: 0.5 }],
    });

    setSegmentLayerOpacity(model as never, 'segment-1', 'layer-1', 1);

    expect(updateObjectParameters).toHaveBeenLastCalledWith('segment-1', {
      layerOverride: [],
    });
  });

  it('removes a single layer override', () => {
    const updateObjectParameters = jest.fn();
    const model = {
      getLayer: (id: string) => {
        if (id === 'segment-1') {
          return segmentLayer;
        }
        return undefined;
      },
      sharedModel: { updateObjectParameters },
    };

    expect(
      resetSegmentLayerOverride(model as never, 'segment-1', 'layer-1'),
    ).toBe(true);
    expect(updateObjectParameters).toHaveBeenCalledWith('segment-1', {
      layerOverride: [],
    });
  });
});
