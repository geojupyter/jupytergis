import { Menu } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

import type {
  IListStoryTitleBarContentProps,
  IStorySegmentViewItem,
} from '@/src/features/story/types/types';
import { Button } from '@/src/shared/components/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';

type SlideDirection = 'next' | 'prev';

function getSlideDirection(
  prevSegmentId: string | undefined,
  currentPosition: number,
  segmentItems: IStorySegmentViewItem[],
): SlideDirection | undefined {
  if (!prevSegmentId || currentPosition < 0) {
    return undefined;
  }

  const prevPosition = segmentItems.findIndex(
    item => item.id === prevSegmentId,
  );

  if (prevPosition < 0) {
    return undefined;
  }

  return currentPosition > prevPosition ? 'next' : 'prev';
}

export function ListStoryTitleBarMobile({
  segmentItems,
  currentIndex,
  onSegmentClick,
}: IListStoryTitleBarContentProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPosition = segmentItems.findIndex(
    item => item.index === currentIndex,
  );
  const activeSegment =
    currentPosition >= 0 ? segmentItems[currentPosition] : undefined;

  const prevSegmentIdRef = useRef<string | undefined>(undefined);
  const slideDirectionRef = useRef<SlideDirection | undefined>(undefined);
  const activeSegmentId = activeSegment?.id;

  if (activeSegmentId !== prevSegmentIdRef.current) {
    slideDirectionRef.current = getSlideDirection(
      prevSegmentIdRef.current,
      currentPosition,
      segmentItems,
    );
    prevSegmentIdRef.current = activeSegmentId;
  }

  const handleMenuSegmentClick = (index: number): void => {
    onSegmentClick(index);
    setMenuOpen(false);
  };

  return (
    <nav
      className="jgis-story-title-bar jgis-story-title-bar--mobile"
      aria-label="Story segments"
    >
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="jgis-story-title-bar-menu-btn"
            aria-label="Open story menu"
          >
            <Menu />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="bottom"
          className="jgis-story-title-bar-segment-menu"
        >
          {segmentItems.map(item => {
            const isActive = item.index === currentIndex;
            return (
              <button
                key={item.id}
                type="button"
                className="jgis-story-title-bar-label jgis-story-title-bar-segment-menu-item"
                data-state={isActive ? 'active' : 'inactive'}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => handleMenuSegmentClick(item.index)}
              >
                {item.layerName}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      <span
        key={activeSegment?.id}
        className="jgis-story-title-bar-active-segment"
        data-state="active"
        data-slide-direction={slideDirectionRef.current}
      >
        {activeSegment?.layerName ?? ''}
      </span>
    </nav>
  );
}
