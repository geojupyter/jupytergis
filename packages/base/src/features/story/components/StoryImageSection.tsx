import React from 'react';

interface IStoryImageSectionProps {
  imageUrl: string;
  imageLoaded: boolean;
  layerName: string;
  slideNumber: number;
  navSlot?: React.ReactNode;
}

function StoryImageSection({
  imageUrl,
  imageLoaded,
  layerName,
  slideNumber,
  navSlot,
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
        {navSlot}
      </div>
    </div>
  );
}

export default StoryImageSection;
