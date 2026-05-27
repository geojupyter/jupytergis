import type {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';

import { getSegmentDisplayMode } from './listStoryLayout';

export interface IStorySegmentViewItem {
  id: string;
  index: number;
  layerName: string;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
}

export interface IListStoryMarkdownSegment {
  id: string;
  index: number;
  markdown: string;
}

export function buildStorySegmentViewItems(
  model: IJupyterGISModel,
  storyData: IJGISStoryMap | null,
): IStorySegmentViewItem[] {
  const segments = storyData?.storySegments ?? [];

  return segments.map((segmentId, index) => {
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
}

export function getStoryMarkdownFromSlide(
  activeSlide: IStorySegmentViewItem['activeSlide'],
): string {
  const markdown = activeSlide?.content?.markdown;
  return typeof markdown === 'string' ? markdown : '';
}

export function getListStoryMarkdownSegmentsFromItems(
  items: IStorySegmentViewItem[],
): IListStoryMarkdownSegment[] {
  return items
    .filter(item => getSegmentDisplayMode(item.activeSlide) === 'markdown')
    .map(item => ({
      id: item.id,
      index: item.index,
      markdown: getStoryMarkdownFromSlide(item.activeSlide),
    }));
}
