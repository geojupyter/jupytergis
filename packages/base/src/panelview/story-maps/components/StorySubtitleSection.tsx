import React from 'react';

interface IStorySubtitleSectionProps {
  title: string;
  navSlot?: React.ReactNode;
}

function StorySubtitleSection({ title, navSlot }: IStorySubtitleSectionProps) {
  return (
    <div className="jgis-story-viewer-subtitle-container">
      <h2 className="jgis-story-viewer-subtitle">{title || 'Slide Title'}</h2>
      {navSlot}
    </div>
  );
}

export default StorySubtitleSection;
