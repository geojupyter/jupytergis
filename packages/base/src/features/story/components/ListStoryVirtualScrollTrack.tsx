import React from 'react';

import type { IListStoryScrollTrackLayout } from '@/src/features/story/types/types';

interface IListStoryVirtualScrollTrackProps {
  scrollTrackLayout: IListStoryScrollTrackLayout | null;
}

export function ListStoryVirtualScrollTrack({
  scrollTrackLayout,
}: IListStoryVirtualScrollTrackProps): JSX.Element {
  if (!scrollTrackLayout) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div
      className="jgis-story-virtual-track"
      style={{ height: scrollTrackLayout.scrollTrackHeight }}
      aria-hidden
    />
  );
}
