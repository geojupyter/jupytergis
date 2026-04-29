import { IJGISStoryMap, IJupyterGISModel, IStorySegmentLayer } from '@jupytergis/schema';
import { useMemo } from 'react';

export interface IStorySegmentViewItem {
  id: string;
  index: number;
  isActive: boolean;
  layerName: string;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
}

interface IUseStorySegmentViewItemsParams {
  model: IJupyterGISModel;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
}

export function useStorySegmentViewItems({
  model,
  storyData,
  currentIndex,
}: IUseStorySegmentViewItemsParams): IStorySegmentViewItem[] {
  return useMemo(() => {
    const segments = storyData?.storySegments ?? [];

    return segments.map((segmentId, index) => {
      const layer = model.getLayer(segmentId);
      return {
        id: segmentId,
        index,
        isActive: index === currentIndex,
        layerName: layer?.name ?? `Segment ${index + 1}`,
        activeSlide: layer?.parameters as IStorySegmentLayer['parameters'] | undefined,
      };
    });
  }, [model, storyData, currentIndex]);
}
