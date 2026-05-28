import { useCallback, useEffect, useRef, useState } from 'react';

import type { IListStoryMarkdownSegment } from '@/src/features/story/types/types';

const MEASURE_LOOKAHEAD = 2;

interface IBuildPendingMeasureIdsParams {
  markdownSegments: IListStoryMarkdownSegment[];
  currentSegmentIndex: number;
  heightsById: Readonly<Record<string, number>>;
  measuringSegmentId: string | undefined;
}

function buildPendingMeasureIds({
  markdownSegments,
  currentSegmentIndex,
  heightsById,
  measuringSegmentId,
}: IBuildPendingMeasureIdsParams): string[] {
  const pending = markdownSegments
    .filter(
      segment =>
        Math.abs(segment.index - currentSegmentIndex) <= MEASURE_LOOKAHEAD &&
        heightsById[segment.id] === undefined,
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

interface IUseLazyListStoryMarkdownMeasureParams {
  enabled: boolean;
  markdownSegments: IListStoryMarkdownSegment[];
  currentSegmentIndex: number;
  heightsById: Readonly<Record<string, number>>;
  onHeight: (segmentId: string, height: number) => void;
}

interface ILazyListStoryMarkdownMeasureState {
  measuringSegment: IListStoryMarkdownSegment | null;
  reportHeight: (segmentId: string, height: number) => void;
  completeMeasure: () => void;
}

/**
 * Queues markdown segments near the active index and measures them one at a time
 * in a shared off-screen pane (see ListStoryMarkdownMeasurePane).
 */
export function useLazyListStoryMarkdownMeasure({
  enabled,
  markdownSegments,
  currentSegmentIndex,
  heightsById,
  onHeight,
}: IUseLazyListStoryMarkdownMeasureParams): ILazyListStoryMarkdownMeasureState {
  const [measuringSegment, setMeasuringSegment] =
    useState<IListStoryMarkdownSegment | null>(null);
  const queueRef = useRef<string[]>([]);

  const refillQueue = useCallback((): void => {
    queueRef.current = buildPendingMeasureIds({
      markdownSegments,
      currentSegmentIndex,
      heightsById,
      measuringSegmentId: measuringSegment?.id,
    });
  }, [
    markdownSegments,
    currentSegmentIndex,
    heightsById,
    measuringSegment?.id,
  ]);

  const reportHeight = useCallback(
    (segmentId: string, height: number) => {
      onHeight(segmentId, height);
    },
    [onHeight],
  );

  const completeMeasure = useCallback(() => {
    setMeasuringSegment(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMeasuringSegment(null);
      queueRef.current = [];
      return;
    }
    refillQueue();

    if (measuringSegment) {
      return;
    }

    const nextId = queueRef.current.shift();
    if (!nextId) {
      return;
    }

    const segment = markdownSegments.find(item => item.id === nextId);
    if (segment) {
      setMeasuringSegment(segment);
    }
  }, [
    enabled,
    currentSegmentIndex,
    markdownSegments,
    heightsById,
    measuringSegment,
    refillQueue,
  ]);

  return { measuringSegment, reportHeight, completeMeasure };
}
