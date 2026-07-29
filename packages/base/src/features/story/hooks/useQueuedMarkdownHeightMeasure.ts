import { useCallback, useEffect, useRef, useState } from 'react';

import type { IListStoryMarkdownSegment } from '@/src/features/story/types/types';
import { buildPendingMeasureIds } from '@/src/features/story/utils/listStoryMeasureQueue';

interface IUseQueuedMarkdownHeightMeasureParams {
  enabled: boolean;
  markdownSegments: IListStoryMarkdownSegment[];
  currentSegmentIndex: number;
  heightsById: Readonly<Record<string, number>>;
  onHeight: (segmentId: string, height: number) => void;
}

interface IQueuedMarkdownHeightMeasureState {
  segmentBeingMeasured: IListStoryMarkdownSegment | null;
  reportHeight: (segmentId: string, height: number) => void;
  completeMeasure: () => void;
}

/**
 * Queues markdown segments near the active index and measures them one at a time
 * in a shared off-screen pane (see ListStoryMarkdownMeasurePane).
 */
export function useQueuedMarkdownHeightMeasure({
  enabled,
  markdownSegments,
  currentSegmentIndex,
  heightsById,
  onHeight,
}: IUseQueuedMarkdownHeightMeasureParams): IQueuedMarkdownHeightMeasureState {
  const [segmentBeingMeasured, setSegmentBeingMeasured] =
    useState<IListStoryMarkdownSegment | null>(null);
  const queueRef = useRef<string[]>([]);

  const refillQueue = useCallback((): void => {
    queueRef.current = buildPendingMeasureIds({
      markdownSegments,
      currentSegmentIndex,
      heightsById,
      measuringSegmentId: segmentBeingMeasured?.id,
    });
  }, [
    markdownSegments,
    currentSegmentIndex,
    heightsById,
    segmentBeingMeasured?.id,
  ]);

  const reportHeight = useCallback(
    (segmentId: string, height: number) => {
      onHeight(segmentId, height);
    },
    [onHeight],
  );

  const completeMeasure = useCallback(() => {
    setSegmentBeingMeasured(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSegmentBeingMeasured(null);
      queueRef.current = [];
      return;
    }
    refillQueue();

    if (segmentBeingMeasured) {
      return;
    }

    const nextId = queueRef.current.shift();
    if (!nextId) {
      return;
    }

    const segment = markdownSegments.find(item => item.id === nextId);
    if (segment) {
      setSegmentBeingMeasured(segment);
    }
  }, [
    enabled,
    currentSegmentIndex,
    markdownSegments,
    heightsById,
    segmentBeingMeasured,
    refillQueue,
  ]);

  return { segmentBeingMeasured, reportHeight, completeMeasure };
}
