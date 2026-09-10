import React, { useCallback, useEffect, useRef, useState } from 'react';

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

const FIT_SCALE = 1;
const ZOOMED_SCALE = 2;
/** Wait to distinguish single-click (dismiss) from double-click (zoom). */
const SINGLE_CLICK_CLOSE_MS = 280;

export function StoryMarkdownImageLightbox({
  src,
  alt = '',
  onClose,
}: IStoryMarkdownImageLightboxProps): JSX.Element {
  const open = Boolean(src);
  const [scale, setScale] = useState(FIT_SCALE);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      clearCloseTimer();
      return;
    }

    setScale(FIT_SCALE);
    clearCloseTimer();

    return () => {
      clearCloseTimer();
    };
  }, [open, src, clearCloseTimer]);

  const handleClick = useCallback(() => {
    if (scaleRef.current > FIT_SCALE) {
      clearCloseTimer();
      setScale(FIT_SCALE);
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, SINGLE_CLICK_CLOSE_MS);
  }, [clearCloseTimer, onClose]);

  const handleDoubleClick = useCallback(() => {
    clearCloseTimer();
    if (scaleRef.current > FIT_SCALE) {
      return;
    }

    setScale(ZOOMED_SCALE);
  }, [clearCloseTimer]);

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
          Double-click to zoom further. Click to zoom out or dismiss. Press
          Escape or use Close to dismiss.
        </DialogDescription>
        <div
          className={
            'flex size-full cursor-zoom-out touch-manipulation items-center justify-center overflow-hidden select-none'
          }
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          {src ? (
            <img
              className="jgis-story-image-lightbox-image"
              src={src}
              alt={alt}
              draggable={false}
              style={{ transform: `scale(${scale})` }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
