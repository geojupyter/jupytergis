import type { IJupyterGISModel } from '@jupytergis/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { type RefObject, useMemo, useRef, useState } from 'react';

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
import {
  SymbologyDialog,
  SymbologyWidget,
} from '../../layers/symbology/symbologyDialog';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousSelectionRef = useRef(model.selected);
  const { okSignalPromise, okSignal } = useMemo(() => {
    const delegate = new PromiseDelegate<Signal<SymbologyWidget, null>>();
    const signal = new Signal<SymbologyWidget, null>({} as SymbologyWidget);
    delegate.resolve(signal);
    return { okSignalPromise: delegate, okSignal: signal };
  }, []);

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);

    if (nextOpen) {
      previousSelectionRef.current = model.selected;
      model.syncSelected({ [layerId]: { type: 'layer' } });
      return;
    }

    model.syncSelected(previousSelectionRef.current ?? {});
  };

  const handleSave = (): void => {
    okSignal.emit(null);
    handleOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
      <SheetTrigger asChild>
        <Button ref={triggerRef} variant="outline">
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent
        container={portalContainerRef.current}
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>Layer Symbology Override</SheetTitle>
          <SheetDescription>
            Edit symbology overrides for this layer on the current story
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
