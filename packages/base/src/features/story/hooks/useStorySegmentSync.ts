import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import { useEffect } from 'react';

interface IUseStorySegmentSyncParams {
  model: IJupyterGISModel;
  storyData: IJGISStoryMap | null;
  setIndex: (index: number) => void;
}

export function useStorySegmentSync({
  model,
  storyData,
  setIndex,
}: IUseStorySegmentSyncParams): void {
  useEffect(() => {
    const handleSelectedStorySegmentChanged = () => {
      if (!storyData || storyData.storyType !== 'unguided') {
        return;
      }

      const selected = model.localState?.selected?.value;
      if (!selected) {
        return;
      }

      const selectedLayers = Object.keys(selected);
      if (selectedLayers.length !== 1) {
        return;
      }

      const selectedLayerId = selectedLayers[0];
      const selectedLayer = model.getLayer(selectedLayerId);
      if (!selectedLayer || selectedLayer.type !== 'StorySegmentLayer') {
        return;
      }

      const index = storyData.storySegments?.indexOf(selectedLayerId);
      if (index === undefined || index === -1) {
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
