import type { IStorySegmentLayer } from '@jupytergis/schema';

import type {
  IListStoryLayout,
  IListStorySegmentRange,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import type { StorySegmentDisplayMode } from '@/src/features/story/types/types';

const MARKDOWN_LINE_HEIGHT_PX = 28;
const MARKDOWN_CONTENT_PADDING_PX = 32;
const MIN_MARKDOWN_VIEWPORT_RATIO = 0.5;

interface IBuildListStoryLayoutInput {
  items: IStorySegmentViewItem[];
  /** Story column scroller height (markdown estimates, scroll padding). */
  viewportHeight: number;
  /** Map stage height (`.jGIS-Mainview-Container`); defaults to viewportHeight. */
  mapViewportHeight?: number;
  heightsById?: Readonly<Record<string, number>>;
}

export function estimateMarkdownHeight(
  markdown: string,
  viewportHeight: number,
): number {
  const lineCount = Math.max(1, markdown.split('\n').length);
  const fromLines =
    lineCount * MARKDOWN_LINE_HEIGHT_PX + MARKDOWN_CONTENT_PADDING_PX;
  const minHeight = viewportHeight * MIN_MARKDOWN_VIEWPORT_RATIO;
  return Math.max(minHeight, fromLines);
}

export function estimateMapSegmentHeight(viewportHeight: number): number {
  return viewportHeight;
}

export function getLayoutSegmentHeight(
  layout: IListStoryLayout | null,
  index: number,
): number | undefined {
  return layout?.segments.find(segment => segment.index === index)?.height;
}

function segmentHeightForItem(
  item: IStorySegmentViewItem,
  viewportHeight: number,
  mapViewportHeight: number,
  heightsById: Readonly<Record<string, number>>,
): { height: number; measured: boolean } {
  const mode = getSegmentDisplayMode(item.activeSlide);
  if (mode === 'map') {
    return {
      height: estimateMapSegmentHeight(mapViewportHeight),
      measured: mapViewportHeight > 0,
    };
  }

  const measured = heightsById[item.id];
  if (measured !== undefined && measured > 0) {
    return { height: measured, measured: true };
  }

  if (mode === 'markdown') {
    const markdown = item.activeSlide?.content?.markdown ?? '';
    return {
      height: estimateMarkdownHeight(
        typeof markdown === 'string' ? markdown : '',
        viewportHeight,
      ),
      measured: false,
    };
  }

  return {
    height: estimateMapSegmentHeight(mapViewportHeight),
    measured: false,
  };
}

/** Builds cumulative segment ranges for the virtual list story scroll track. */
export function buildListStoryLayout({
  items,
  viewportHeight,
  mapViewportHeight,
  heightsById = {},
}: IBuildListStoryLayoutInput): IListStoryLayout | null {
  if (!items.length || viewportHeight <= 0) {
    return null;
  }

  const mapHeight = mapViewportHeight ?? viewportHeight;
  const heights: { height: number; measured: boolean }[] = items.map(item =>
    segmentHeightForItem(item, viewportHeight, mapHeight, heightsById),
  );

  let offset = 0;
  const segments: IListStorySegmentRange[] = items.map((item, i) => {
    const start = offset;
    const height = heights[i].height;
    const end = start + height;
    offset = end;
    return {
      id: item.id,
      index: item.index,
      contentMode: getSegmentDisplayMode(item.activeSlide),
      height,
      measured: heights[i].measured,
      start,
      end,
    };
  });

  return {
    segments,
    trackHeight: offset,
  };
}

export function getSegmentDisplayMode(
  activeSlide: IStorySegmentLayer['parameters'] | undefined,
): StorySegmentDisplayMode {
  if (activeSlide?.content?.contentMode === 'markdown') {
    return 'markdown';
  }
  return 'map';
}
