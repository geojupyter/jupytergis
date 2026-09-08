import type { IJupyterGISModel } from '@jupytergis/schema';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useMemo, useState } from 'react';

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
}

export function SegmentOverrideSheet({
  model,
  segmentId,
  layerId,
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
      <SheetTrigger
        render={
          <Button size={'xs'} variant="outline">
            Edit
          </Button>
        }
      />
      <SheetContent showCloseButton={false}>
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
          <Button type="button" onClick={handleSave}>
            Save changes
          </Button>
          <SheetClose render={<Button variant="outline">Close</Button>} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
