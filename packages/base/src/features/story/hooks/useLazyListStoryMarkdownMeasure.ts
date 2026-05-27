import type { IJupyterGISModel } from '@jupytergis/schema';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useListStoryMarkdownSegments } from '@/src/features/story/hooks/useListStoryMarkdownSegments';
import type { IListStoryMarkdownSegment } from '@/src/features/story/utils/listStoryMarkdownSegments';

const MEASURE_LOOKAHEAD = 2;

export interface IUseLazyListStoryMarkdownMeasureParams {
  enabled: boolean;
  model: IJupyterGISModel;
  currentSegmentIndex: number;
  heightsById: Readonly<Record<string, number>>;
  onHeight: (segmentId: string, height: number) => void;
}

export interface ILazyListStoryMarkdownMeasureState {
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
  model,
  currentSegmentIndex,
  heightsById,
  onHeight,
}: IUseLazyListStoryMarkdownMeasureParams): ILazyListStoryMarkdownMeasureState {
  const markdownSegments = useListStoryMarkdownSegments(model);
  const [measuringSegment, setMeasuringSegment] =
    useState<IListStoryMarkdownSegment | null>(null);
  const queueRef = useRef<string[]>([]);
  const heightsRef = useRef(heightsById);
  heightsRef.current = heightsById;

  const refillQueue = useCallback((): void => {
    const pending = markdownSegments
      .filter(
        segment =>
          Math.abs(segment.index - currentSegmentIndex) <= MEASURE_LOOKAHEAD &&
          heightsRef.current[segment.id] === undefined,
      )
      .sort(
        (a, b) =>
          Math.abs(a.index - currentSegmentIndex) -
          Math.abs(b.index - currentSegmentIndex),
      )
      .map(segment => segment.id);

    const currentId = measuringSegment?.id;
    queueRef.current = pending.filter(id => id !== currentId);
  }, [markdownSegments, currentSegmentIndex, measuringSegment?.id]);

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
