import React, { useCallback, useRef, useState } from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/types/types';
import { Button } from '@/src/shared/components/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';
import { Menu } from 'lucide-react';

export interface IListStoryTitleBarMobileProps {
  segmentItems: IStorySegmentViewItem[];
  currentIndex: number;
  onSegmentClick: (index: number) => void;
}

export function ListStoryTitleBarMobile({
  segmentItems,
  currentIndex,
  onSegmentClick,
}: IListStoryTitleBarMobileProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  const activeSegment = segmentItems.find(item => item.index === currentIndex);
  const currentPosition = segmentItems.findIndex(
    item => item.index === currentIndex,
  );

  const prevSegmentIdRef = useRef<string | undefined>(undefined);
  const slideDirectionRef = useRef<'next' | 'prev' | undefined>(undefined);

  if (activeSegment?.id !== prevSegmentIdRef.current) {
    const prevId = prevSegmentIdRef.current;

    if (prevId) {
      const prevPosition = segmentItems.findIndex(item => item.id === prevId);

      if (prevPosition >= 0 && currentPosition >= 0) {
        slideDirectionRef.current =
          currentPosition > prevPosition ? 'next' : 'prev';
      } else {
        slideDirectionRef.current = undefined;
      }
    } else {
      slideDirectionRef.current = undefined;
    }
    prevSegmentIdRef.current = activeSegment?.id;
  }

  const handleMenuSegmentClick = useCallback(
    (index: number): void => {
      onSegmentClick(index);
      setMenuOpen(false);
    },
    [onSegmentClick],
  );

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
                className="jGIS-layer-browser-category jgis-story-title-bar-segment-menu-item"
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
        className="jGIS-layer-browser-category jgis-story-title-bar-active-segment"
        data-state="active"
        data-slide-direction={slideDirectionRef.current}
      >
        {activeSegment?.layerName ?? ''}
      </span>
    </nav>
  );
}
