import {
  IListStoryScrollTrackSegment,
  IStorySegmentViewItem,
} from '../../types/types';
import { buildListStoryScrollTrack } from '../../utils/listStoryScrollTrack';

export function storyItem(
  id: string,
  index: number,
  contentMode: 'map' | 'markdown',
  markdown = '',
): IStorySegmentViewItem {
  return {
    id,
    index,
    layerName: id,
    activeSlide: {
      zoom: 0,
      extent: [],
      transition: { type: 'linear', time: 0 },
      content: {
        contentMode,
        markdown,
      },
    },
  };
}

export interface IListStoryScrollTrackFixtureOptions {
  items: IStorySegmentViewItem[];
  viewportHeight: number;
  mapViewportHeight?: number;
  heightsById?: Readonly<Record<string, number>>;
}

export function layoutSegments(
  options: IListStoryScrollTrackFixtureOptions,
): IListStoryScrollTrackSegment[] {
  const layout = buildListStoryScrollTrack(options);
  if (!layout) {
    throw new Error('layoutSegments: buildListStoryScrollTrack returned null');
  }
  return layout.segments;
}
