import type { IJupyterGISModel } from '@jupytergis/schema';
import { Circle, MousePointer2, Pentagon, Spline, Trash2 } from 'lucide-react';
import React from 'react';

import { DrawCustomAttributesDialog } from '@/src/features/labels/components/DrawCustomAttributesDialog';
import { DrawCustomAttributesPreview } from '@/src/features/labels/components/DrawCustomAttributesPreview';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/src/shared/components/ToggleGroup';
import { cn } from '@/src/shared/components/utils';

const DRAW_GEOMETRIES = [
  { value: 'Point', label: 'Point', icon: Circle },
  { value: 'LineString', label: 'Line', icon: Spline },
  { value: 'Polygon', label: 'Polygon', icon: Pentagon },
] as const;

/** Empty string = select/edit mode (no draw tool armed). */
export const DRAW_SELECT_TOOL = '';
const SELECT_TOOL_VALUE = 'select';

const DRAW_STATUS: Record<string, string> = {
  Point: 'Click to add a point.',
  LineString: 'Click to add vertices.\nDouble-click to finish.',
  Polygon: 'Click to add vertices.\nDouble-click to finish.',
  delete: 'Click a feature to remove it.\nClick a marked one to keep it.',
};

export interface IVectorDrawControlsProps {
  drawGeometryLabel: string | undefined;
  onDrawGeometryTypeChange: (geometryType: string) => void;
  onToggleDeleteMode: () => void;
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
  onToggleDeleteMode,
  model,
  drawLayerId,
  readOnly = false,
  followColor,
}: IVectorDrawControlsProps): JSX.Element {
  const toggleValue = drawGeometryLabel || SELECT_TOOL_VALUE;
  const status = drawGeometryLabel ? DRAW_STATUS[drawGeometryLabel] : undefined;

  const armed = (value: string): string | undefined =>
    readOnly && value === toggleValue ? 'jgis-follow-armed' : undefined;

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
      data-tool={drawGeometryLabel || undefined}
    >
      <p className="jgis-vector-draw-controls-status" role="status">
        {status}
      </p>
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
            className={armed(SELECT_TOOL_VALUE)}
            disabled={readOnly}
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
              className={armed(value)}
              disabled={readOnly}
              onClick={() => onDrawGeometryTypeChange(value)}
            >
              <Icon />
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem
            value="delete"
            aria-label="Delete"
            title="Delete"
            variant={'destructive'}
            className={armed('delete')}
            disabled={readOnly}
            onClick={onToggleDeleteMode}
          >
            <Trash2 />
          </ToggleGroupItem>
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
