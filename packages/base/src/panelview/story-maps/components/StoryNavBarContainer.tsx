import React from 'react';
import { StoryNavPlacement } from '../StoryViewerPanel';

interface IStoryNavBarContainerProps {
  placement: StoryNavPlacement;
  children: React.ReactNode;
}

/**
 * Wraps the story nav bar with the correct container class for its placement.
 * Parent passes a single nav element and this applies the right wrapper for
 * below-title, over-image, or subtitle-specta.
 */
// ! use inverse nav button color when no image
function StoryNavBarContainer({
  placement,
  children,
}: IStoryNavBarContainerProps) {
  if (placement === 'over-image') {
    return <div className="jgis-story-viewer-nav-container">{children}</div>;
  }
  if (placement === 'subtitle-specta') {
    return (
      <div className="jgis-story-viewer-nav-container-specta-mod">
        {children}
      </div>
    );
  }
  // below-title: no extra wrapper (nav sits in flow below title)
  return <>{children}</>;
}

export default StoryNavBarContainer;
