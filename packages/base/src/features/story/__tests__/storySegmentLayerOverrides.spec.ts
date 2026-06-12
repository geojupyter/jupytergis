import {
  buildSegmentLayerRows,
  isLayerOverrideChanged,
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
    expect(isLayerOverrideChanged(targetLayer as never, { visible: false })).toBe(
      true,
    );
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
});
