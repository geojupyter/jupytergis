import React from 'react';

import StoryNavBar from '../StoryNavBar';

interface IStorySubtitleSectionProps {
  title: string;
  isSpecta: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function StorySubtitleSection({
  title,
  isSpecta,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: IStorySubtitleSectionProps) {
  return (
    <div className="jgis-story-viewer-subtitle-container">
      <h2 className="jgis-story-viewer-subtitle">{title || 'Slide Title'}</h2>
      {isSpecta && (
        <div className="jgis-story-viewer-nav-container-specta-mod">
          <StoryNavBar
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            isSpecta={isSpecta}
          />
        </div>
      )}
    </div>
  );
}

export default StorySubtitleSection;
