import type { IStorySegmentLayer } from '@jupytergis/schema';

import type { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';
import type { StorySegmentDisplayMode } from '@/src/features/story/types/listStoryScrollDrive';

import { getSegmentDisplayMode } from './segmentDisplayMode';

const MARKDOWN_LINE_HEIGHT_PX = 28;
const MARKDOWN_CONTENT_PADDING_PX = 32;
const MIN_MARKDOWN_VIEWPORT_RATIO = 0.5;

export interface IListStorySegmentRange {
  id: string;
  index: number;
  contentMode: StorySegmentDisplayMode;
  height: number;
  measured: boolean;
  /** Inclusive start in scroller content coordinates. */
  start: number;
  /** Exclusive end in scroller content coordinates. */
  end: number;
}

export interface IListStoryLayout {
  segments: IListStorySegmentRange[];
  /** Sum of segment heights (virtual track height). */
  trackHeight: number;
}

export interface IBuildListStoryLayoutInput {
  items: IStorySegmentViewItem[];
  viewportHeight: number;
  heightsById?: Readonly<Record<string, number>>;
}

export function estimateMarkdownHeight(
  markdown: string,
  viewportHeight: number,
): number {
  const lineCount = Math.max(1, markdown.split('\n').length);
  const fromLines = lineCount * MARKDOWN_LINE_HEIGHT_PX + MARKDOWN_CONTENT_PADDING_PX;
  const minHeight = viewportHeight * MIN_MARKDOWN_VIEWPORT_RATIO;
  return Math.max(minHeight, fromLines);
}

export function estimateMapSegmentHeight(viewportHeight: number): number {
  return viewportHeight;
}

function segmentHeightForItem(
  item: IStorySegmentViewItem,
  viewportHeight: number,
  heightsById: Readonly<Record<string, number>>,
): { height: number; measured: boolean } {
  const measured = heightsById[item.id];
  if (measured !== undefined && measured > 0) {
    return { height: measured, measured: true };
  }

  const mode = getSegmentDisplayMode(item.activeSlide);
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

  return { height: estimateMapSegmentHeight(viewportHeight), measured: false };
}

/** Builds cumulative segment ranges for the virtual list story scroll track. */
export function buildListStoryLayout({
  items,
  viewportHeight,
  heightsById = {},
}: IBuildListStoryLayoutInput): IListStoryLayout | null {
  if (!items.length || viewportHeight <= 0) {
    return null;
  }

  const heights: { height: number; measured: boolean }[] = items.map(item =>
    segmentHeightForItem(item, viewportHeight, heightsById),
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

export function getStoryMarkdownFromSlide(
  activeSlide: IStorySegmentLayer['parameters'] | undefined,
): string {
  const markdown = activeSlide?.content?.markdown;
  return typeof markdown === 'string' ? markdown : '';
}
