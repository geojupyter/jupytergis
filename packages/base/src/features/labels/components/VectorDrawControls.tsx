import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { DrawCustomAttributesDialog } from '@/src/features/labels/components/DrawCustomAttributesDialog';
import { DrawCustomAttributesPreview } from '@/src/features/labels/components/DrawCustomAttributesPreview';
import { Switch } from '@/src/shared/components/Switch';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/src/shared/components/ToggleGroup';

const DRAW_GEOMETRIES = [
  { value: 'Point', label: 'Point' },
  { value: 'LineString', label: 'Line' },
  { value: 'Polygon', label: 'Polygon' },
] as const;

/** Empty string = select/edit mode (no draw tool armed). */
export const DRAW_SELECT_TOOL = '';
const SELECT_TOOL_VALUE = 'select';

export interface IVectorDrawControlsProps {
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (geometryType: string) => void;
  onToggleDeleteMode: () => void;
  model: IJupyterGISModel;
  drawLayerId?: string;
}

export function VectorDrawControls({
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  onToggleDeleteMode,
  model,
  drawLayerId,
}: IVectorDrawControlsProps): JSX.Element {
  const toggleValue = drawGeometryLabel || SELECT_TOOL_VALUE;
  const isDeleting = drawGeometryLabel === 'delete';

  return (
    <div className="jgis-vector-draw-controls">
      <div className="jgis-vector-draw-controls-row">
        <ToggleGroup
          variant="outline"
          spacing={0}
          aria-label="Draw tools"
          value={[toggleValue]}
          className="rounded-[0.5rem] bg-background [&_[data-slot=toggle-group-item]:first-child]:rounded-l-[0.5rem] [&_[data-slot=toggle-group-item]:last-child]:rounded-r-[0.5rem]"
        >
          <ToggleGroupItem
            value={SELECT_TOOL_VALUE}
            onClick={() => onDrawGeometryTypeChange(DRAW_SELECT_TOOL)}
          >
            Modify
          </ToggleGroupItem>
          {DRAW_GEOMETRIES.map(({ value, label }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              onClick={() => onDrawGeometryTypeChange(value)}
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label className="flex items-center gap-2 text-sm">
          Delete
          <Switch
            size="sm"
            checked={isDeleting}
            onCheckedChange={onToggleDeleteMode}
          />
        </label>
        {drawLayerId ? (
          <DrawCustomAttributesDialog model={model} drawLayerId={drawLayerId} />
        ) : null}
      </div>
      {drawLayerId ? (
        <DrawCustomAttributesPreview model={model} drawLayerId={drawLayerId} />
      ) : null}
    </div>
  );
}
