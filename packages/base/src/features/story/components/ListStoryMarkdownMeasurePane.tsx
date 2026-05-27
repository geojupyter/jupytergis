import React, { useCallback, useLayoutEffect, useRef } from 'react';

import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';

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

  const reportHeight = useCallback((): void => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    onHeight(segmentId, content.getBoundingClientRect().height);
  }, [segmentId, onHeight]);

  const handleRendered = useCallback((): void => {
    renderedRef.current = true;
    reportHeight();
    onMeasureComplete();
  }, [reportHeight, onMeasureComplete]);

  useLayoutEffect(() => {
    renderedRef.current = false;
    if (!markdown) {
      renderedRef.current = true;
      reportHeight();
      onMeasureComplete();
    }
  }, [segmentId, markdown, reportHeight, onMeasureComplete]);

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
      <div ref={contentRef} className="jgis-story-markdown-overlay-content">
        {markdown ? (
          <div className="specta-article-host-widget specta-cell-content">
            <StoryScrollDriveMarkdown
              source={markdown}
              onRendered={handleRendered}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
