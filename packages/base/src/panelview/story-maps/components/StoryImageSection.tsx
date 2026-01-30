import React from 'react';

import StoryNavBar from '../StoryNavBar';

interface IStoryImageSectionProps {
  imageUrl: string;
  imageLoaded: boolean;
  layerName: string;
  slideNumber: number;
  isSpecta: boolean;
  storyType: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function StoryImageSection({
  imageUrl,
  imageLoaded,
  layerName,
  slideNumber,
  isSpecta,
  storyType,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: IStoryImageSectionProps) {
  if (!imageLoaded) {
    return null;
  }

  return (
    <div className="jgis-story-viewer-image-section">
      <div className="jgis-story-viewer-image-container">
        <img
          src={imageUrl}
          alt="Story map image"
          className="jgis-story-viewer-image"
        />
        {!isSpecta && storyType === 'guided' && (
          <div className="jgis-story-viewer-nav-container">
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
    </div>
  );
}

export default StoryImageSection;
