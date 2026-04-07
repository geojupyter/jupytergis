import {
  IJGISLayerItem,
  IJGISLayerTree,
  IJupyterGISModel,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';

import { CommandIDs } from '../../../constants';

export function useLayerTree(
  model: IJupyterGISModel,
  commands: CommandRegistry,
  opts?: {
    onSegmentAdded?: (payload: {
      storySegmentId: string;
      storyId: string;
    }) => void;
  },
): { filteredLayerTree: IJGISLayerTree; storySegmentLayerTree: IJGISLayerTree } {
  const [layerTree, setLayerTree] = React.useState<IJGISLayerTree>(
    model.getLayerTree(),
  );
  const hasSyncedInitialSelectionRef = React.useRef(false);
  // Keep a stable ref to the callback to avoid stale closures
  const onSegmentAddedRef = React.useRef(opts?.onSegmentAdded);
  React.useEffect(() => {
    onSegmentAddedRef.current = opts?.onSegmentAdded;
  });

  React.useEffect(() => {
    const updateLayerTree = () => {
      const freshTree = model.getLayerTree() || [];
      setLayerTree(freshTree);

      if (!hasSyncedInitialSelectionRef.current && freshTree.length > 0) {
        hasSyncedInitialSelectionRef.current = true;
        const lastItem = freshTree[freshTree.length - 1];
        const lastId =
          typeof lastItem === 'string' ? lastItem : lastItem?.name;
        const lastType = typeof lastItem === 'string' ? 'layer' : 'group';
        if (lastId) {
          model.syncSelected(
            { [lastId]: { type: lastType } },
            model.getClientId().toString(),
          );
        }
      }

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

  const { filteredLayerTree, storySegmentLayerTree } = React.useMemo(() => {
    const filtered: IJGISLayerTree = [];
    const storySegments: IJGISLayerTree = [];

    const processLayer = (
      layer: IJGISLayerItem,
    ): {
      filtered: IJGISLayerItem | null;
      storySegment: IJGISLayerItem | null;
    } => {
      if (typeof layer === 'string') {
        const layerData = model.getLayer(layer);
        const isStorySegment = layerData?.type === 'StorySegmentLayer';
        return {
          filtered: isStorySegment ? null : layer,
          storySegment: isStorySegment ? layer : null,
        };
      }

      const filteredGroupLayers: IJGISLayerItem[] = [];
      const storySegmentGroupLayers: IJGISLayerItem[] = [];

      for (const groupLayer of layer.layers) {
        const result = processLayer(groupLayer);
        if (result.filtered !== null) {
          filteredGroupLayers.push(result.filtered);
        }
        if (result.storySegment !== null) {
          storySegmentGroupLayers.push(result.storySegment);
        }
      }

      return {
        filtered:
          filteredGroupLayers.length > 0
            ? { ...layer, layers: filteredGroupLayers }
            : null,
        storySegment:
          storySegmentGroupLayers.length > 0
            ? { ...layer, layers: storySegmentGroupLayers }
            : null,
      };
    };

    for (const layer of layerTree) {
      const result = processLayer(layer);
      if (result.filtered !== null) {
        filtered.push(result.filtered);
      }
      if (result.storySegment !== null) {
        storySegments.push(result.storySegment);
      }
    }

    filtered.reverse();
    return { filteredLayerTree: filtered, storySegmentLayerTree: storySegments };
  }, [layerTree]);

  // Sync story segments order back to the story map
  React.useEffect(() => {
    const { storyId, story } = model.getSelectedStory();
    if (!story) {
      return;
    }
    model.sharedModel.updateStoryMap(storyId, {
      ...story,
      storySegments: storySegmentLayerTree as string[],
    });
  }, [storySegmentLayerTree]);

  return { filteredLayerTree, storySegmentLayerTree };
}
