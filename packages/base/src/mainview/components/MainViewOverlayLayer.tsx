import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { VectorDrawControls } from '@/src/features/labels/components/VectorDrawControls';

export interface IMainViewOverlayLayerProps {
  annotationFloaters: React.ReactNode;
  featureFloaters: React.ReactNode;
  editingVectorLayer: boolean;
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void;
  portalContainerRef?: React.RefObject<HTMLElement | null>;
  model: IJupyterGISModel;
  drawLayerId?: string;
}

export function MainViewOverlayLayer({
  annotationFloaters,
  featureFloaters,
  editingVectorLayer,
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  portalContainerRef,
  model,
  drawLayerId,
}: IMainViewOverlayLayerProps): JSX.Element {
  return (
    <>
      {annotationFloaters}
      {featureFloaters}
      {editingVectorLayer ? (
        <VectorDrawControls
          drawGeometryLabel={drawGeometryLabel}
          onDrawGeometryTypeChange={onDrawGeometryTypeChange}
          portalContainerRef={portalContainerRef}
          model={model}
          drawLayerId={drawLayerId}
        />
      ) : null}
    </>
  );
}
