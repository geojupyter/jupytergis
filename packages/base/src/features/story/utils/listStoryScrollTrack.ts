import type {
  IListStoryScrollTrackLayout,
  IListStoryScrollTrackSegment,
  IListStorySegmentTransition,
  StorySegmentDisplayMode,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { getHandoffGapHeight } from './getHandoffGapHeight';

const MARKDOWN_LINE_HEIGHT_PX = 28;
const MARKDOWN_CONTENT_PADDING_PX = 32;
const MIN_MARKDOWN_VIEWPORT_RATIO = 0.5;

interface IBuildListStoryScrollTrackInput {
  items: IStorySegmentViewItem[];
  /** Story column scroller height (markdown estimates, scroll padding). */
  viewportHeight: number;
  /** Map stage height (`.jGIS-Mainview-Container`); defaults to viewportHeight. */
  mapViewportHeight?: number;
  heightsById?: Readonly<Record<string, number>>;
  /** Gap between consecutive markdown segments; map-adjacent gaps are always kept. */
  markdownSegmentGap?: boolean;
}

export function estimateMarkdownHeight(
  markdown: string,
  viewportHeight: number,
): number {
  const lineCount = Math.max(1, markdown.split('\n').length);
  const estimatedFromLines =
    lineCount * MARKDOWN_LINE_HEIGHT_PX + MARKDOWN_CONTENT_PADDING_PX;
  const minHeight = viewportHeight * MIN_MARKDOWN_VIEWPORT_RATIO;
  return Math.max(minHeight, estimatedFromLines);
}

export function estimateMapSegmentHeight(viewportHeight: number): number {
  return viewportHeight;
}

export function getScrollTrackSegmentHeight(
  layout: IListStoryScrollTrackLayout | null,
  index: number,
): number | undefined {
  return layout?.segments.find(segment => segment.index === index)?.height;
}

/**
 * Pixel travel for progress 0→1 (`--jgis-transition-translate`).
 * Same geometry that drives scroll progress: segment height (intra) or
 * `to.start - from.start` (handoff = from height + gap).
 */
export function getTransitionTranslatePx(
  transition: IListStorySegmentTransition | null,
  layout: IListStoryScrollTrackLayout | null,
): number {
  if (!transition || !layout?.segments.length) {
    return 0;
  }

  const fromSegment = layout.segments.find(
    segment => segment.index === transition.fromIndex,
  );
  if (!fromSegment) {
    return 0;
  }

  if (transition.fromIndex === transition.toIndex) {
    return fromSegment.height;
  }

  const toSegment = layout.segments.find(
    segment => segment.index === transition.toIndex,
  );
  if (!toSegment) {
    return 0;
  }

  return Math.max(0, toSegment.start - fromSegment.start);
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

  const markdown = item.activeSlide?.content?.markdown ?? '';
  return {
    height: estimateMarkdownHeight(
      typeof markdown === 'string' ? markdown : '',
      viewportHeight,
    ),
    measured: false,
  };
}

/** Builds cumulative segment ranges for the virtual list story scroll track. */
export function buildListStoryScrollTrack({
  items,
  viewportHeight,
  mapViewportHeight,
  heightsById = {},
  markdownSegmentGap = false,
}: IBuildListStoryScrollTrackInput): IListStoryScrollTrackLayout | null {
  if (!items.length || viewportHeight <= 0) {
    return null;
  }

  const mapHeight = mapViewportHeight ?? viewportHeight;
  const heights: { height: number; measured: boolean }[] = items.map(item =>
    segmentHeightForItem(item, viewportHeight, mapHeight, heightsById),
  );

  const modes: StorySegmentDisplayMode[] = items.map(item =>
    getSegmentDisplayMode(item.activeSlide),
  );

  let offset = 0;
  const segments: IListStoryScrollTrackSegment[] = items.map((item, i) => {
    const start = offset;
    const height = heights[i].height;
    const gapAfter =
      i < items.length - 1
        ? getHandoffGapHeight(
            modes[i],
            modes[i + 1],
            mapHeight,
            markdownSegmentGap,
          )
        : 0;
    const end = start + height + gapAfter;
    offset = end;
    return {
      id: item.id,
      index: item.index,
      contentMode: modes[i],
      height,
      measured: heights[i].measured,
      start,
      end,
    };
  });

  return {
    segments,
    scrollTrackHeight: offset,
  };
}

export function getSegmentDisplayMode(
  activeSlide: IStorySegmentViewItem['activeSlide'],
): StorySegmentDisplayMode {
  if (activeSlide?.content?.contentMode === 'markdown') {
    return 'markdown';
  }
  return 'map';
}
