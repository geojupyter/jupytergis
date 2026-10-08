import type { IJupyterGISModel } from '@jupytergis/schema';
import {
  Circle,
  MousePointer2,
  Pentagon,
  Spline,
  Trash2,
} from 'lucide-react';
import React from 'react';

import { DrawCustomAttributesDialog } from '@/src/features/labels/components/DrawCustomAttributesDialog';
import { DrawCustomAttributesPreview } from '@/src/features/labels/components/DrawCustomAttributesPreview';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/src/shared/components/ToggleGroup';

const DRAW_GEOMETRIES = [
  { value: 'Point', label: 'Point', icon: Circle },
  { value: 'LineString', label: 'Line', icon: Spline },
  { value: 'Polygon', label: 'Polygon', icon: Pentagon },
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
            aria-label="Modify"
            title="Modify"
            onClick={() => onDrawGeometryTypeChange(DRAW_SELECT_TOOL)}
          >
            <MousePointer2 />
          </ToggleGroupItem>
          {DRAW_GEOMETRIES.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              title={label}
              onClick={() => onDrawGeometryTypeChange(value)}
            >
              <Icon />
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem
            value="delete"
            aria-label="Delete"
            title="Delete"
            onClick={onToggleDeleteMode}
          >
            <Trash2 />
          </ToggleGroupItem>
        </ToggleGroup>
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
