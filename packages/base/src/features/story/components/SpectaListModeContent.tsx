import React from 'react';

import type { IListStoryLayout } from '@/src/features/story/utils/listStoryLayout';

interface ISpectaListModeContentProps {
  layout: IListStoryLayout | null;
}

export function SpectaListModeContent({
  layout,
}: ISpectaListModeContentProps): JSX.Element {
  if (!layout) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div className="jgis-story-virtual-track-root">
      <div
        className="jgis-story-virtual-track"
        style={{ height: layout.trackHeight }}
        aria-hidden
      />
    </div>
  );
}
