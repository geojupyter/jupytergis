import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import type { StoryNavPlacement } from './StoryViewerPanel';

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
      : placement === 'subtitle-specta'
        ? 'jgis-story-viewer-nav-container-specta-mod'
        : placement === 'subtitle-specta-mobile'
          ? 'jgis-story-viewer-nav-container-specta-mobile'
          : undefined;

  const navbarClassName =
    placement === 'subtitle-specta'
      ? 'jgis-story-navbar jgis-story-navbar-specta-mod'
      : 'jgis-story-navbar';

  return (
    <div className={containerClassName}>
      <div className={navbarClassName}>
        <>
          <Button
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous slide"
          >
            <ChevronLeft />
          </Button>
          <Button onClick={onNext} disabled={!hasNext} aria-label="Next slide">
            <ChevronRight />
          </Button>
        </>
      </div>
    </div>
  );
}

export default StoryNavBar;
