import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { DrawDefaultAttributesDialog } from '@/src/features/labels/components/DrawDefaultAttributesDialog';
import { Button } from '@/src/shared/components/Button';
import { ButtonGroup } from '@/src/shared/components/ButtonGroup';

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
      <ButtonGroup aria-label="Geometry type">
        {DRAW_GEOMETRIES.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={drawGeometryLabel === value ? 'secondary' : 'outline'}
            onClick={() => onDrawGeometryTypeChange(value)}
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>
      {drawLayerId ? (
        <DrawDefaultAttributesDialog model={model} drawLayerId={drawLayerId} />
      ) : null}
    </div>
  );
}
