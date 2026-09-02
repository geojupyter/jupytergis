import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { DrawCustomAttributesDialog } from '@/src/features/labels/components/DrawCustomAttributesDialog';
import { Button } from '@/src/shared/components/Button';
import { ButtonGroup } from '@/src/shared/components/ButtonGroup';

const DRAW_GEOMETRIES = [
  { value: 'Point', label: 'Point' },
  { value: 'LineString', label: 'Line' },
  { value: 'Polygon', label: 'Polygon' },
] as const;

/** Empty string = select/edit mode (no draw tool armed). */
export const DRAW_SELECT_TOOL = '';

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
  const isSelectMode = !drawGeometryLabel;

  return (
    <div className="jgis-vector-draw-controls">
      <ButtonGroup aria-label="Draw tools">
        <Button
          type="button"
          size="sm"
          variant={isSelectMode ? 'secondary' : 'outline'}
          aria-pressed={isSelectMode}
          onClick={() => onDrawGeometryTypeChange(DRAW_SELECT_TOOL)}
        >
          Select
        </Button>
        {DRAW_GEOMETRIES.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={drawGeometryLabel === value ? 'secondary' : 'outline'}
            aria-pressed={drawGeometryLabel === value}
            onClick={() => onDrawGeometryTypeChange(value)}
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>
      {drawLayerId ? (
        <DrawCustomAttributesDialog model={model} drawLayerId={drawLayerId} />
      ) : null}
    </div>
  );
}
