import type { IListStoryMarkdownSegment } from '@/src/features/story/types/types';

export const LIST_STORY_MEASURE_LOOKAHEAD = 2;

interface IBuildPendingMeasureIdsParams {
  markdownSegments: IListStoryMarkdownSegment[];
  currentSegmentIndex: number;
  heightsById: Readonly<Record<string, number>>;
  measuringSegmentId: string | undefined;
}

/** Markdown segment ids near the active index that still need measurement. */
export function buildPendingMeasureIds({
  markdownSegments,
  currentSegmentIndex,
  heightsById,
  measuringSegmentId,
}: IBuildPendingMeasureIdsParams): string[] {
  const pending = markdownSegments
    .filter(
      segment =>
        Math.abs(segment.index - currentSegmentIndex) <=
          LIST_STORY_MEASURE_LOOKAHEAD && heightsById[segment.id] === undefined,
    )
    .sort(
      (a, b) =>
        Math.abs(a.index - currentSegmentIndex) -
        Math.abs(b.index - currentSegmentIndex),
    )
    .map(segment => segment.id);

  if (!measuringSegmentId) {
    return pending;
  }

  return pending.filter(id => id !== measuringSegmentId);
}
