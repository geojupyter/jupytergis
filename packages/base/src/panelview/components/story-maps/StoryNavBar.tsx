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
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous slide"
        style={{ border: '1px solid var(--jp-layout-color0)' }}
      >
        <ChevronLeft />
      </Button>
      <Button
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next slide"
        style={{ border: '1px solid var(--jp-layout-color0)' }}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

export default StoryNavBar;
