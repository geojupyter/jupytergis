import type { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';

import { DrawDefaultAttributesDialog } from '@/src/mainview/components/DrawDefaultAttributesDialog';
import { Button } from '@/src/shared/components/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/shared/components/Dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';

const DRAW_GEOMETRIES = ['Point', 'LineString', 'Polygon'] as const;

export interface IVectorDrawControlsProps {
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  portalContainerRef?: React.RefObject<HTMLElement | null>;
  model: IJupyterGISModel;
  drawLayerId?: string;
}

export function VectorDrawControls({
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  portalContainerRef,
  model,
  drawLayerId,
}: IVectorDrawControlsProps): JSX.Element {
  const [attributesDialogOpen, setAttributesDialogOpen] = useState(false);

  return (
    <div className="jgis-geometry-type-selector-overlay">
      <NativeSelect
        className="geometry-type-selector"
        id="geometry-type-selector"
        value={drawGeometryLabel ?? ''}
        onChange={onDrawGeometryTypeChange}
      >
        <NativeSelectOption value="" disabled hidden>
          Geometry type
        </NativeSelectOption>
        {DRAW_GEOMETRIES.map(geometryType => (
          <NativeSelectOption key={geometryType} value={geometryType}>
            {geometryType}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Dialog
        modal={false}
        open={attributesDialogOpen}
        onOpenChange={setAttributesDialogOpen}
      >
        <DialogTrigger asChild>
          <Button disabled={!drawLayerId}>Edit</Button>
        </DialogTrigger>
        <DialogContent
          container={portalContainerRef?.current}
          preventOutsideDismiss
        >
          <DialogHeader>
            <DialogTitle>Set up custom attributes</DialogTitle>
          </DialogHeader>
          {attributesDialogOpen && drawLayerId ? (
            <DrawDefaultAttributesDialog model={model} layerId={drawLayerId} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
