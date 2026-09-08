import { Menu } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { ListStoryTitleBarSegmentButton } from '@/src/features/story/components/ListStoryTitleBarSegmentButton';
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

  const navRef = useRef<HTMLElement>(null);
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
      ref={navRef}
      className="jgis-story-title-bar jgis-story-title-bar--mobile"
      aria-label="Story segments"
    >
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="jgis-story-title-bar-menu-btn"
              aria-label="Open story menu"
            >
              <Menu />
            </Button>
          }
        />
        <PopoverContent
          anchor={navRef}
          align="center"
          side="bottom"
          className="max-h-64 w-[calc(100vw-1rem)] max-w-sm items-center gap-1 overflow-y-auto"
        >
          {segmentItems.map(item => {
            const isActive = item.index === currentIndex;
            return (
              <ListStoryTitleBarSegmentButton
                key={item.id}
                label={item.layerName}
                isActive={isActive}
                // className="jgis-story-title-bar-segment-menu-item"
                onClick={() => handleMenuSegmentClick(item.index)}
              />
            );
          })}
        </PopoverContent>
      </Popover>
      <span
        key={activeSegment?.id}
        className="jgis-underline-indicator jgis-story-title-bar-active-segment"
        data-active
        data-slide-direction={slideDirectionRef.current}
      >
        {activeSegment?.layerName ?? ''}
      </span>
    </nav>
  );
}
