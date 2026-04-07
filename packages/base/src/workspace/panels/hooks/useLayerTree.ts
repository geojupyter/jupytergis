import {
  IJGISLayerItem,
  IJGISLayerTree,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';

import { CommandIDs } from '../../../constants';

/**
 * Subscribes to the model's layer tree and splits it into two derived trees:
 * - `layerTree`: regular map layers (excludes StorySegmentLayers)
 * - `segmentTree`: story segment layers only
 *
 * Also pre-selects the last item on first load, and syncs segment order back
 * to the story map whenever the segment tree changes.
 */
export function useLayerTree(
  model: IJupyterGISModel,
  commands: CommandRegistry,
  opts?: {
    onSegmentAdded?: (payload: {
      storySegmentId: string;
      storyId: string;
    }) => void;
  },
): {
  layerTree: IJGISLayerTree;
  segmentTree: IJGISLayerTree;
} {
  const [rawLayerTree, setRawLayerTree] = React.useState<IJGISLayerTree>(
    model.getLayerTree(),
  );
  const hasSyncedInitialSelectionRef = React.useRef(false);
  // Ref keeps the callback fresh without re-registering the signal handler on every render
  const onSegmentAddedRef = React.useRef(opts?.onSegmentAdded);
  React.useEffect(() => {
    onSegmentAddedRef.current = opts?.onSegmentAdded;
  });

  React.useEffect(() => {
    const syncInitialSelection = (tree: IJGISLayerTree) => {
      if (hasSyncedInitialSelectionRef.current || tree.length === 0) {
        return;
      }
      hasSyncedInitialSelectionRef.current = true;
      const lastItem = tree[tree.length - 1];
      const lastId = typeof lastItem === 'string' ? lastItem : lastItem?.name;
      const lastType = typeof lastItem === 'string' ? 'layer' : 'group';
      if (lastId) {
        model.syncSelected(
          { [lastId]: { type: lastType } },
          model.getClientId().toString(),
        );
      }
    };

    const updateLayerTree = () => {
      const freshTree = model.getLayerTree() || [];
      setRawLayerTree(freshTree);
      syncInitialSelection(freshTree);
      commands.notifyCommandChanged(CommandIDs.toggleStoryPresentationMode);
    };

    const handleSegmentAdded = (
      _sender: IJupyterGISModel,
      payload: { storySegmentId: string; storyId: string },
    ) => {
      model.syncSelected(
        { [payload.storySegmentId]: { type: 'layer' } },
        model.getClientId().toString(),
      );
      onSegmentAddedRef.current?.(payload);
    };

    model.sharedModel.layersChanged.connect(updateLayerTree);
    model.sharedModel.layerTreeChanged.connect(updateLayerTree);
    model.segmentAdded.connect(handleSegmentAdded);
    updateLayerTree();

    return () => {
      model.sharedModel.layersChanged.disconnect(updateLayerTree);
      model.sharedModel.layerTreeChanged.disconnect(updateLayerTree);
      model.segmentAdded.disconnect(handleSegmentAdded);
    };
  }, [model]);

  // Split the raw tree into regular layers and story segment layers
  const { layerTree, segmentTree } = React.useMemo(() => {
    const layers: IJGISLayerTree = [];
    const segments: IJGISLayerTree = [];

    const processLayer = (
      layer: IJGISLayerItem,
    ): {
      layer: IJGISLayerItem | null;
      segment: IJGISLayerItem | null;
    } => {
      if (typeof layer === 'string') {
        const layerData = model.getLayer(layer);
        const isStorySegment = layerData?.type === 'StorySegmentLayer';
        return {
          layer: isStorySegment ? null : layer,
          segment: isStorySegment ? layer : null,
        };
      }

      const groupLayers: IJGISLayerItem[] = [];
      const groupSegments: IJGISLayerItem[] = [];

      for (const groupLayer of layer.layers) {
        const result = processLayer(groupLayer);
        if (result.layer !== null) {
          groupLayers.push(result.layer);
        }
        if (result.segment !== null) {
          groupSegments.push(result.segment);
        }
      }

      return {
        layer: groupLayers.length > 0 ? { ...layer, layers: groupLayers } : null,
        segment:
          groupSegments.length > 0 ? { ...layer, layers: groupSegments } : null,
      };
    };

    for (const item of rawLayerTree) {
      const result = processLayer(item);
      if (result.layer !== null) {
        layers.push(result.layer);
      }
      if (result.segment !== null) {
        segments.push(result.segment);
      }
    }

    layers.reverse();
    return { layerTree: layers, segmentTree: segments };
  }, [rawLayerTree]);

  // Sync segment order back to the story map when it changes
  React.useEffect(() => {
    const { storyId, story } = model.getSelectedStory();
    if (!story) {
      return;
    }
    model.sharedModel.updateStoryMap(storyId, {
      ...story,
      storySegments: segmentTree as string[],
    });
  }, [segmentTree]);

  return { layerTree, segmentTree };
}
