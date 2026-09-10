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
