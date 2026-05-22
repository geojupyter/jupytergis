import React, { RefObject, useRef } from 'react';

import { useListStorySegmentScrollPadding } from '@/src/features/story/hooks/useListStorySegmentScrollPadding';
import type { IListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

interface ISpectaListModeContentProps {
  layout: IListStoryLayout | null;
  /** The Specta story column scroller (`#jgis-story-segment-panel` root). */
  listIntersectionRootRef: RefObject<HTMLDivElement | null>;
}

export function SpectaListModeContent({
  layout,
  listIntersectionRootRef,
}: ISpectaListModeContentProps): JSX.Element {
  const trackRootRef = useRef<HTMLDivElement>(null);

  useListStorySegmentScrollPadding(
    listIntersectionRootRef,
    trackRootRef,
    layout,
  );

  if (!layout) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div ref={trackRootRef} className="jgis-story-virtual-track-root">
      <div
        className="jgis-story-virtual-track"
        style={{ height: layout.trackHeight }}
        aria-hidden
      />
    </div>
  );
}
