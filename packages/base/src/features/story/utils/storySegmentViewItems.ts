import type {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';

import type { IStorySegmentViewItem } from '@/src/features/story/types/types';

export function buildStorySegmentViewItems(
  model: IJupyterGISModel,
  storyData: IJGISStoryMap | null,
): IStorySegmentViewItem[] {
  const segments = storyData?.storySegments ?? [];
  const items = segments.map((segmentId, index) => {
    const layer = model.getLayer(segmentId);
    return {
      id: segmentId,
      index,
      layerName: layer?.name ?? `Segment ${index + 1}`,
      activeSlide: layer?.parameters as
        | IStorySegmentLayer['parameters']
        | undefined,
    };
  });

  return items;
}

//todo this doesnt seem worth it
export function getStorySegmentDisplayTitle(
  item: IStorySegmentViewItem,
): string {
  return item.layerName;
}

export function getStoryMarkdownFromSlide(
  activeSlide: IStorySegmentViewItem['activeSlide'],
): string {
  const markdown = activeSlide?.content?.markdown;

  return typeof markdown === 'string' ? markdown : '';
}
