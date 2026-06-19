import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect } from 'react';

import { STORY_TYPE } from '@/src/types';

interface IUseStorySegmentSyncParams {
  model: IJupyterGISModel;
  storyData: IJGISStoryMap | null;
  setIndex: (index: number) => void;
}

function getSingleSelectedLayerId(
  selected: Record<string, unknown> | null | undefined,
): string | null {
  if (!selected) {
    return null;
  }

  const selectedLayerIds = Object.keys(selected);
  if (selectedLayerIds.length !== 1) {
    return null;
  }

  return selectedLayerIds[0];
}

function getStorySegmentIndexFromLayerId(
  storyData: IJGISStoryMap,
  selectedLayerId: string,
): number | null {
  const index = storyData.storySegments?.indexOf(selectedLayerId);
  if (index === undefined || index === -1) {
    return null;
  }
  return index;
}

// This hook just syncs the active segment with the currently selected segment
// Only for unguided mode
export function useStorySegmentSync({
  model,
  storyData,
  setIndex,
}: IUseStorySegmentSyncParams): void {
  useEffect(() => {
    const handleSelectedStorySegmentChanged = () => {
      if (!storyData || storyData.storyType !== STORY_TYPE.unguided) {
        return;
      }

      const selected = model.localState?.selected?.value;
      const selectedLayerId = getSingleSelectedLayerId(selected);
      if (!selectedLayerId) {
        return;
      }

      const selectedLayer = model.getLayer(selectedLayerId);
      if (!selectedLayer || selectedLayer.type !== 'StorySegmentLayer') {
        return;
      }

      const index = getStorySegmentIndexFromLayerId(storyData, selectedLayerId);

      if (index === null) {
        return;
      }

      setIndex(index);
    };

    model.selectedChanged.connect(handleSelectedStorySegmentChanged);
    handleSelectedStorySegmentChanged();

    return () => {
      model.selectedChanged.disconnect(handleSelectedStorySegmentChanged);
    };
  }, [model, storyData, setIndex]);
}
