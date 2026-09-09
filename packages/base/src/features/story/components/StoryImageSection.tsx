import React, { useCallback, useState } from 'react';

import { StoryMarkdownImageLightbox } from './StoryMarkdownImageLightbox';

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

  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setLightboxOpen(true);
  }, []);

  return (
    <div className="jgis-story-viewer-image-section">
      <div className="jgis-story-viewer-image-container">
        <img
          src={imageUrl}
          alt="Story map image"
          className="jgis-story-viewer-image jgis-story-viewer-image-zoomable"
          onClick={handleOpen}
          role="button"
          tabIndex={0}
        />
        <StoryMarkdownImageLightbox
          src={lightboxOpen ? imageUrl : null}
          alt="Story map image"
          onClose={() => setLightboxOpen(false)}
        />
        {navSlot}
      </div>
    </div>
  );
}

export default StoryImageSection;
