import type {
  StorySegmentDisplayMode,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';

const MARKDOWN_LINE_HEIGHT_PX = 28;
const MARKDOWN_CONTENT_PADDING_PX = 32;
const MIN_MARKDOWN_VIEWPORT_RATIO = 0.5;

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

export function getSegmentDisplayMode(
  activeSlide: IStorySegmentViewItem['activeSlide'],
): StorySegmentDisplayMode {
  if (activeSlide?.content?.contentMode === 'markdown') {
    return 'markdown';
  }

  return 'map';
}
