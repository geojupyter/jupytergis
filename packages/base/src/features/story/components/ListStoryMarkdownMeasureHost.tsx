import React, { useLayoutEffect, useRef } from 'react';

import { StoryScrollDriveMarkdown } from '@/src/features/story/components/StoryScrollDriveMarkdown';
import type { IListStoryMarkdownSegment } from '@/src/features/story/utils/listStoryMarkdownSegments';

export interface IListStoryMarkdownMeasureHostProps {
  segments: IListStoryMarkdownSegment[];
  onHeight: (segmentId: string, height: number) => void;
}

interface IMarkdownMeasurePaneProps {
  segmentId: string;
  markdown: string;
  onHeight: (segmentId: string, height: number) => void;
}

function MarkdownMeasurePane({
  segmentId,
  markdown,
  onHeight,
}: IMarkdownMeasurePaneProps): JSX.Element {
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
        {markdown ? <StoryScrollDriveMarkdown source={markdown} /> : null}
      </div>
    </div>
  );
}

/**
 * Off-screen panes that mirror overlay markdown layout for height measurement.
 */
export function ListStoryMarkdownMeasureHost({
  segments,
  onHeight,
}: IListStoryMarkdownMeasureHostProps): JSX.Element | null {
  if (!segments.length) {
    return null;
  }

  return (
    <div className="jgis-story-markdown-measure-host" aria-hidden>
      {segments.map(segment => (
        <MarkdownMeasurePane
          key={segment.id}
          segmentId={segment.id}
          markdown={segment.markdown}
          onHeight={onHeight}
        />
      ))}
    </div>
  );
}
