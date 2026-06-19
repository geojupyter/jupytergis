import type { IJupyterGISModel } from '@jupytergis/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { type RefObject, useMemo, useState } from 'react';

import {
  SymbologyDialog,
  SymbologyWidget,
} from '@/src/features/layers/symbology/symbologyDialog';
import { Button } from '@/src/shared/components/Button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/src/shared/components/Sheet';

export interface ISegmentOverrideSheetProps {
  model: IJupyterGISModel;
  segmentId: string;
  layerId: string;
  portalContainerRef: RefObject<HTMLElement | null>;
}

export function SegmentOverrideSheet({
  model,
  segmentId,
  layerId,
  portalContainerRef,
}: ISegmentOverrideSheetProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const { okSignalPromise, okSignal } = useMemo(() => {
    const delegate = new PromiseDelegate<Signal<SymbologyWidget, null>>();
    const signal = new Signal<SymbologyWidget, null>({} as SymbologyWidget);
    delegate.resolve(signal);
    return { okSignalPromise: delegate, okSignal: signal };
  }, []);

  const handleSave = (): void => {
    okSignal.emit(null);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <Button variant="outline">Edit</Button>
      </SheetTrigger>
      <SheetContent
        container={portalContainerRef.current}
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>Layer Symbology Override</SheetTitle>
          <SheetDescription>
            Edit symbology overrides for this layer on the selected story
            segment.
          </SheetDescription>
        </SheetHeader>
        <div className="jgis-story-editor-sheet-container">
          <SymbologyDialog
            model={model}
            okSignalPromise={okSignalPromise}
            layerId={layerId}
            isStorySegmentOverride
            segmentId={segmentId}
          />
        </div>
        <SheetFooter className="jgis-story-editor-sheet-footer">
          <Button
            type="button"
            className="jp-mod-accept jp-mod-styled"
            onClick={handleSave}
          >
            Save changes
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
