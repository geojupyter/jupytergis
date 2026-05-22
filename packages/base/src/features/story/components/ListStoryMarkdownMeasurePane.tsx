import React, { useLayoutEffect, useRef } from 'react';

import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';

export interface IListStoryMarkdownMeasurePaneProps {
  segmentId: string;
  markdown: string;
  onHeight: (segmentId: string, height: number) => void;
}

/**
 * Single off-screen pane matching overlay markdown layout for height measurement.
 */
export function ListStoryMarkdownMeasurePane({
  segmentId,
  markdown,
  onHeight,
}: IListStoryMarkdownMeasurePaneProps): JSX.Element {
  const paneRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) {
      return;
    }

    const report = (): void => {
      onHeight(segmentId, pane.getBoundingClientRect().height);
    };

    report();
    const ro = new ResizeObserver(() => {
      report();
    });
    ro.observe(pane);

    return () => {
      ro.disconnect();
    };
  }, [segmentId, markdown, onHeight]);

  return (
    <div
      ref={paneRef}
      data-segment-id={segmentId}
      className="jgis-story-markdown-scroll-pane jgis-story-markdown-scroll-pane--measure"
    >
      <div className="jgis-story-markdown-overlay-content">
        {markdown ? (
          <div className="specta-article-host-widget specta-cell-content">
            <StoryScrollDriveMarkdown source={markdown} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
