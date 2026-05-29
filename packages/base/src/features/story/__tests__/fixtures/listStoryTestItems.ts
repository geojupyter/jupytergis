import {
  IListStorySegmentRange,
  IStorySegmentViewItem,
} from '../../types/types';
import { buildListStoryLayout } from '../../utils/listStoryLayout';

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
      content: {
        contentMode,
        markdown,
      },
    },
  };
}

export interface IListStoryLayoutFixtureOptions {
  items: IStorySegmentViewItem[];
  viewportHeight: number;
  mapViewportHeight?: number;
  heightsById?: Readonly<Record<string, number>>;
}

export function layoutSegments(
  options: IListStoryLayoutFixtureOptions,
): IListStorySegmentRange[] {
  const layout = buildListStoryLayout(options);
  if (!layout) {
    throw new Error('layoutSegments: buildListStoryLayout returned null');
  }
  return layout.segments;
}
