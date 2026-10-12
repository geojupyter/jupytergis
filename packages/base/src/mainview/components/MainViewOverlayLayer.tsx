import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { VectorDrawControls } from '@/src/features/labels/components/VectorDrawControls';

export interface IMainViewOverlayLayerProps {
  annotationFloaters: React.ReactNode;
  featureFloaters: React.ReactNode;
  isDrawing: boolean;
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (geometryType: string) => void;
  onToggleDeleteMode: () => void;
  model: IJupyterGISModel;
  drawLayerId?: string;
}

export function MainViewOverlayLayer({
  annotationFloaters,
  featureFloaters,
  isDrawing,
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  onToggleDeleteMode,
  model,
  drawLayerId,
}: IMainViewOverlayLayerProps): JSX.Element {
  return (
    <>
      {annotationFloaters}
      {featureFloaters}
      {isDrawing ? (
        <VectorDrawControls
          drawGeometryLabel={drawGeometryLabel}
          onDrawGeometryTypeChange={onDrawGeometryTypeChange}
          onToggleDeleteMode={onToggleDeleteMode}
          model={model}
          drawLayerId={drawLayerId}
        />
      ) : null}
    </>
  );
}
