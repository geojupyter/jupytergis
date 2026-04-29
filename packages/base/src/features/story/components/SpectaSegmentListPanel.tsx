import { IJGISStoryMap } from '@jupytergis/schema';
import React from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';
import { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

interface ISpectaSegmentListPanelProps {
  isSpecta: boolean;
  storyData: IJGISStoryMap | null;
  items: IStorySegmentViewItem[];
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function SpectaSegmentListPanel({
  isSpecta,
  storyData,
  items,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
}: ISpectaSegmentListPanelProps): JSX.Element {
  if (!storyData || !items.length) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {items.map(item => {
        return (
          <div
            key={item.id}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--jp-border-color2)',
              background: item.isActive
                ? 'var(--jp-layout-color2)'
                : 'var(--jp-layout-color1)',
            }}
          >
            <StoryViewerPanel
              isSpecta={isSpecta}
              isMobile={true}
              storyData={storyData}
              currentIndex={item.index}
              activeSlide={item.activeSlide}
              layerName={item.layerName}
              handlePrev={handlePrev}
              handleNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          </div>
        );
      })}
    </div>
  );
}
