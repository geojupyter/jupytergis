import React from 'react';

interface IStoryImageCaptionSectionProps {
  caption: string;
  navSlot?: React.ReactNode;
}

function StoryImageCaptionSection({
  caption,
  navSlot,
}: IStoryImageCaptionSectionProps) {
  if (caption === '') {
    return null;
  }

  return (
    <div className="jgis-story-viewer-caption-container">
      <h2 className="jgis-story-viewer-caption">{caption}</h2>
      {navSlot}
    </div>
  );
}

export default StoryImageCaptionSection;
