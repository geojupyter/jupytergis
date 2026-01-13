import React from 'react';

import StoryNavBar from '../StoryNavBar';

interface IStoryTitleSectionProps {
  title: string;
  isSpecta: boolean;
  storyType: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function StoryTitleSection({
  title,
  isSpecta,
  storyType,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: IStoryTitleSectionProps) {
  return (
    <>
      <h1 className="jgis-story-viewer-title">{title}</h1>
      {!isSpecta && storyType === 'guided' && (
        <StoryNavBar
          onPrev={onPrev}
          onNext={onNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          isSpecta={isSpecta}
        />
      )}
    </>
  );
}

export default StoryTitleSection;
