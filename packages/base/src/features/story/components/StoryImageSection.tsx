import React, { useEffect, useRef, useState } from 'react';

import {
  StoryMarkdownImageLightbox,
  bindStoryZoomableImage,
} from './StoryMarkdownImageLightbox';

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
  const imageRef = useRef<HTMLImageElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !imageLoaded) {
      return;
    }

    return bindStoryZoomableImage(image, () => {
      setLightboxOpen(true);
    });
  }, [imageLoaded, imageUrl]);

  if (!imageLoaded) {
    return null;
  }

  return (
    <div className="jgis-story-viewer-image-section">
      <div className="jgis-story-viewer-image-container">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Story map image"
          className="jgis-story-viewer-image jgis-story-viewer-image-zoomable"
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
