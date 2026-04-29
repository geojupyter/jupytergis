import {
  IJGISStoryMap,
  IJupyterGISModel,
  IStorySegmentLayer,
} from '@jupytergis/schema';
import React from 'react';

import StoryViewerPanel from '@/src/features/story/StoryViewerPanel';

interface ISpectaSegmentListPanelProps {
  model: IJupyterGISModel;
  isSpecta: boolean;
  storyData: IJGISStoryMap | null;
  currentIndex: number;
  handlePrev: () => void;
  handleNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  setIndex: (index: number) => void;
}

export function SpectaSegmentListPanel({
  model,
  isSpecta,
  storyData,
  currentIndex,
  handlePrev,
  handleNext,
  hasPrev,
  hasNext,
  setIndex,
}: ISpectaSegmentListPanelProps): JSX.Element {
  const segments = storyData?.storySegments ?? [];

  if (!segments.length) {
    return <div style={{ padding: '1rem' }}>No segments.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {segments.map((segmentId, index) => {
        const layer = model.getLayer(segmentId);
        const activeSlide = layer?.parameters as
          | IStorySegmentLayer['parameters']
          | undefined;
        const layerName = layer?.name || `Segment ${index + 1}`;

        return (
          <div
            key={segmentId}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--jp-border-color2)',
              background:
                index === currentIndex
                  ? 'var(--jp-layout-color2)'
                  : 'var(--jp-layout-color1)',
            }}
          >
            <StoryViewerPanel
              model={model}
              isSpecta={isSpecta}
              isMobile={true}
              storyData={storyData}
              currentIndex={index}
              activeSlide={activeSlide}
              layerName={layerName}
              handlePrev={handlePrev}
              handleNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              setIndex={setIndex}
            />
          </div>
        );
      })}
    </div>
  );
}
