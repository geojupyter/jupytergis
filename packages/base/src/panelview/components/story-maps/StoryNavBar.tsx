import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';

interface IStoryNavBarProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function StoryNavBar({ onPrev, onNext, hasPrev, hasNext }: IStoryNavBarProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous slide"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next slide"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

export default StoryNavBar;
