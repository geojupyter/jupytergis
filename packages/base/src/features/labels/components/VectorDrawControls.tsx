import type { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import { DrawCustomAttributesDialog } from '@/src/features/labels/components/DrawCustomAttributesDialog';
import { DrawCustomAttributesPreview } from '@/src/features/labels/components/DrawCustomAttributesPreview';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/src/shared/components/ToggleGroup';
import { cn } from '@/src/shared/components/utils';

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
  model: IJupyterGISModel;
  drawLayerId?: string;
  /** Showing what a collaborator we follow is doing: look, do not touch. */
  readOnly?: boolean;
  /** The followed collaborator's colour, painted on the tool they have armed. */
  followColor?: string;
}

export function VectorDrawControls({
  drawGeometryLabel,
  onDrawGeometryTypeChange,
  model,
  drawLayerId,
  readOnly = false,
  followColor,
}: IVectorDrawControlsProps): JSX.Element {
  const toggleValue = drawGeometryLabel || SELECT_TOOL_VALUE;

  // Disabled toggles are drawn at half opacity, which all but hides the armed
  // tool's background. Paint it the way mirrored forms paint a focused field.
  const armed = (value: string): string | undefined =>
    readOnly && value === toggleValue ? 'jgis-follow-focus' : undefined;

  return (
    <div
      className={cn(
        'jgis-vector-draw-controls',
        readOnly && 'jgis-follow-mirror',
      )}
      style={
        followColor
          ? ({ '--jgis-follow-color': followColor } as React.CSSProperties)
          : undefined
      }
    >
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
            className={armed(SELECT_TOOL_VALUE)}
            disabled={readOnly}
            onClick={() => onDrawGeometryTypeChange(DRAW_SELECT_TOOL)}
          >
            Modify
          </ToggleGroupItem>
          {DRAW_GEOMETRIES.map(({ value, label }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className={armed(value)}
              disabled={readOnly}
              onClick={() => onDrawGeometryTypeChange(value)}
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {drawLayerId ? (
          <DrawCustomAttributesDialog
            model={model}
            drawLayerId={drawLayerId}
            disabled={readOnly}
          />
        ) : null}
      </div>
      {drawLayerId ? (
        <DrawCustomAttributesPreview model={model} drawLayerId={drawLayerId} />
      ) : null}
    </div>
  );
}
