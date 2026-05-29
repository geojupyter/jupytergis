import React, { useCallback, useLayoutEffect, useRef } from 'react';

import { ListStoryOverlayMarkdown } from '@/src/features/story/components/ListStoryOverlayMarkdown';

interface IListStoryMarkdownMeasurePaneProps {
  segmentId: string;
  markdown: string;
  onHeight: (segmentId: string, height: number) => void;
  onMeasureComplete: () => void;
}

/**
 * Single off-screen pane matching overlay markdown layout for height measurement.
 */
export function ListStoryMarkdownMeasurePane({
  segmentId,
  markdown,
  onHeight,
  onMeasureComplete,
}: IListStoryMarkdownMeasurePaneProps): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const completedRef = useRef(false);

  const completeMeasure = useCallback((): void => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    onMeasureComplete();
  }, [onMeasureComplete]);

  const reportHeight = useCallback((): void => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    onHeight(segmentId, Math.ceil(content.scrollHeight));
  }, [segmentId, onHeight]);

  const handleRendered = useCallback((): void => {
    renderedRef.current = true;
    reportHeight();
    completeMeasure();
  }, [reportHeight, completeMeasure]);

  useLayoutEffect(() => {
    renderedRef.current = false;
    completedRef.current = false;
    if (!markdown) {
      renderedRef.current = true;
      reportHeight();
      completeMeasure();
    }
  }, [segmentId, markdown, reportHeight, completeMeasure]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const ro = new ResizeObserver(() => {
      if (renderedRef.current) {
        reportHeight();
      }
    });
    ro.observe(content);

    return () => {
      ro.disconnect();
    };
  }, [segmentId, markdown, reportHeight]);

  return (
    <div
      data-segment-id={segmentId}
      className="jgis-story-markdown-scroll-pane jgis-story-markdown-scroll-pane--measure"
    >
      <div ref={contentRef}>
        {markdown ? (
          <ListStoryOverlayMarkdown
            source={markdown}
            onRendered={handleRendered}
          />
        ) : null}
      </div>
    </div>
  );
}
