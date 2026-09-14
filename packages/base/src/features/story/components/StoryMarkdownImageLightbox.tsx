import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/src/shared/components/Dialog';
import { cn } from '@/src/shared/components/utils';

export interface IStoryMarkdownImageLightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

const MOVE_THRESHOLD_PX = 8;

function getMobileListScroller(): HTMLElement | null {
  return document.querySelector('.jgis-story-mobile-list-scroll');
}

/**
 * Tap opens the lightbox. On mobile list stories vertical swipes on
 * the image are forwarded instead of being swallowed.
 */
export function bindStoryZoomableImage(
  element: HTMLElement,
  onOpen: () => void,
): () => void {
  let startY = 0;
  let startScrollTop = 0;
  let tracking = false;
  let didScroll = false;

  const handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }

    const scroller = getMobileListScroller();
    if (!scroller) {
      tracking = false;
      return;
    }

    tracking = true;
    didScroll = false;
    startY = event.touches[0].clientY;
    startScrollTop = scroller.scrollTop;
  };

  const handleTouchMove = (event: TouchEvent): void => {
    if (!tracking || event.touches.length !== 1) {
      return;
    }

    const scroller = getMobileListScroller();
    if (!scroller) {
      return;
    }

    const dy = startY - event.touches[0].clientY;
    if (!didScroll && Math.abs(dy) < MOVE_THRESHOLD_PX) {
      return;
    }

    didScroll = true;
    scroller.scrollTop = startScrollTop + dy;
    event.preventDefault();
  };

  const handleTouchEnd = (): void => {
    tracking = false;
  };

  const handleClick = (event: MouseEvent): void => {
    if (didScroll) {
      event.preventDefault();
      event.stopPropagation();
      didScroll = false;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onOpen();
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd);
  element.addEventListener('touchcancel', handleTouchEnd);
  element.addEventListener('click', handleClick);

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
    element.removeEventListener('click', handleClick);
  };
}

export function StoryMarkdownImageLightbox({
  src,
  alt = '',
  onClose,
}: IStoryMarkdownImageLightboxProps): JSX.Element {
  const open = Boolean(src);

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn(
          'inset-0 top-0 left-0 z-10050 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none bg-background/95 p-0 text-foreground ring-0 max-sm:max-w-none data-open:zoom-in-100 data-closed:zoom-out-100',
        )}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">
          Click to dismiss. Press Escape or use Close to dismiss.
        </DialogDescription>
        <div
          className="flex size-full cursor-zoom-out touch-manipulation items-center justify-center overflow-hidden select-none"
          onClick={onClose}
        >
          {src ? (
            <img
              className="jgis-story-image-lightbox-image"
              src={src}
              alt={alt}
              draggable={false}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
