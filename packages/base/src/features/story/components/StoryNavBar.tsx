import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { ButtonTw } from '@/src/shared/components/ButtonTw';
import type { StoryNavPlacement } from '../StoryViewerPanel';

interface IStoryNavBarProps {
  placement: StoryNavPlacement;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function StoryNavBar({
  placement,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: IStoryNavBarProps) {
  const containerClassName =
    placement === 'over-image'
      ? 'jgis-story-viewer-nav-container'
      : placement === 'caption-specta'
        ? 'jgis-story-viewer-nav-container-specta-mod'
        : undefined;

  const navbarClassName =
    placement === 'caption-specta'
      ? 'jgis-story-navbar jgis-story-navbar-specta-mod'
      : 'jgis-story-navbar';

  return (
    <div className={containerClassName}>
      <div className={navbarClassName}>
        <ButtonTw
          onClick={onPrev}
          disabled={!hasPrev}
          variant="outline"
          size="icon-xs"
          className="jgis-story-navbar-button"
          aria-label="Previous slide"
        >
          <ChevronLeft />
        </ButtonTw>
        <ButtonTw
          onClick={onNext}
          disabled={!hasNext}
          variant="outline"
          size="icon-xs"
          className="jgis-story-navbar-button"
          aria-label="Next slide"
        >
          <ChevronRight />
        </ButtonTw>
      </div>
    </div>
  );
}

export default StoryNavBar;
