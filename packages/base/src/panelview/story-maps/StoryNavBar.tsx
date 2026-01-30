import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';

interface IStoryNavBarProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  isSpecta: boolean;
}

function StoryNavBar({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  isSpecta,
}: IStoryNavBarProps) {
  return (
    <div
      className={`jgis-story-navbar ${isSpecta ? 'jgis-story-navbar-specta-mod' : ''}`}
    >
      <Button onClick={onPrev} disabled={!hasPrev} aria-label="Previous slide">
        <ChevronLeft />
      </Button>
      <Button onClick={onNext} disabled={!hasNext} aria-label="Next slide">
        <ChevronRight />
      </Button>
    </div>
  );
}

export default StoryNavBar;
