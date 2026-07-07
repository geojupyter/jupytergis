import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { DrawDefaultAttributesDialog } from '@/src/features/labels/components/DrawDefaultAttributesDialog';

const DRAW_GEOMETRIES = [
  { value: 'Point', label: 'Point' },
  { value: 'LineString', label: 'Line' },
  { value: 'Polygon', label: 'Polygon' },
] as const;

export interface IVectorDrawControlsProps {
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (geometryType: string) => void;
  model: IJupyterGISModel;
  drawLayerId?: string;
}

export function VectorDrawControls({
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  model,
  drawLayerId,
}: IVectorDrawControlsProps): JSX.Element {
  return (
    <div className="jgis-vector-draw-controls">
      <div
        className="jgis-geometry-segmented"
        role="group"
        aria-label="Geometry type"
      >
        {DRAW_GEOMETRIES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="jgis-geometry-segment"
            data-active={drawGeometryLabel === value}
            onClick={() => onDrawGeometryTypeChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <DrawDefaultAttributesDialog model={model} drawLayerId={drawLayerId} />
    </div>
  );
}
