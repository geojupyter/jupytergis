import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { DrawCustomAttributesFollowMirror } from '@/src/features/labels/components/DrawCustomAttributesFollowMirror';
import { FollowableDrawControls } from '@/src/features/labels/components/FollowableDrawControls';

export interface IMainViewOverlayLayerProps {
  annotationFloaters: React.ReactNode;
  featureFloaters: React.ReactNode;
  isDrawing: boolean;
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (geometryType: string) => void;
  model: IJupyterGISModel;
  drawLayerId?: string;
}

export function MainViewOverlayLayer({
  annotationFloaters,
  featureFloaters,
  isDrawing,
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  model,
  drawLayerId,
}: IMainViewOverlayLayerProps): JSX.Element {
  return (
    <>
      {annotationFloaters}
      {featureFloaters}
      <FollowableDrawControls
        model={model}
        isDrawing={isDrawing}
        drawGeometryLabel={drawGeometryLabel}
        drawLayerId={drawLayerId}
        onDrawGeometryTypeChange={onDrawGeometryTypeChange}
      />
      <DrawCustomAttributesFollowMirror model={model} />
    </>
  );
}
