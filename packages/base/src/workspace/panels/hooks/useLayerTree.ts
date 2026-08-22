import {
  IJGISLayerItem,
  IJGISLayerTree,
  IJupyterGISModel,
} from '@jupytergis/schema';
import * as React from 'react';

/**
 * Subscribes to the model's layer tree and returns a display tree that excludes
 * story segment layers. Also pre-selects the last item on first load.
 */
export function useLayerTree(model: IJupyterGISModel): {
  layerTree: IJGISLayerTree;
} {
  const [rawLayerTree, setRawLayerTree] = React.useState<IJGISLayerTree>(
    model.getLayerTree(),
  );
  const hasSyncedInitialSelectionRef = React.useRef(false);

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
    };

    model.sharedModel.layersChanged.connect(updateLayerTree);
    model.sharedModel.layerTreeChanged.connect(updateLayerTree);
    updateLayerTree();

    return () => {
      model.sharedModel.layersChanged.disconnect(updateLayerTree);
      model.sharedModel.layerTreeChanged.disconnect(updateLayerTree);
    };
  }, [model]);

  const layerTree = React.useMemo(() => {
    const layers: IJGISLayerTree = [];

    const processLayer = (layer: IJGISLayerItem): IJGISLayerItem | null => {
      if (typeof layer === 'string') {
        const layerData = model.getLayer(layer);
        return layerData?.type === 'StorySegmentLayer' ? null : layer;
      }

      const groupLayers = layer.layers
        .map(processLayer)
        .filter((item): item is IJGISLayerItem => item !== null);

      return groupLayers.length > 0 ? { ...layer, layers: groupLayers } : null;
    };

    for (const item of rawLayerTree) {
      const layer = processLayer(item);
      if (layer !== null) {
        layers.push(layer);
      }
    }

    layers.reverse();
    return layers;
  }, [model, rawLayerTree]);

  return { layerTree };
}
