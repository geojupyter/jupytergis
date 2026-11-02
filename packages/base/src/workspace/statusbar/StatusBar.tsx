import { faLocationDot, faMap } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import React, { useEffect, useState } from 'react';

import { CommandIDs } from '@/src/constants';
import { useMapFeatures } from '@/src/mainview/hooks/useMapFeatures';
import {
  CursorCoordMode,
  DEFAULT_MAP_ADAPTER,
  ICursorDisplay,
} from '@/src/mainview/mapAdapter';
import { MAP_ADAPTER_FEATURES } from '@/src/mainview/mapAdapterFeatures';
import { wrapToInterval } from '@/src/mainview/utils/wrapToInterval';
import { Button } from '@/src/shared/components/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/src/shared/components/Select';
import { ProjectionCombobox } from './ProjectionCombobox';

const CURSOR_COORD_MODES: { value: CursorCoordMode; label: string }[] = [
  { value: 'degrees', label: 'Degrees' },
  { value: 'meters', label: 'Meters' },
  { value: 'projection', label: 'Projection units' },
];

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  commands: CommandRegistry;
  loading?: boolean;
  projection?: { code: string; units: string };
  onProjectionChange?: (code: string) => void;
  cursor: ICursorDisplay | null;
  cursorCoordMode: CursorCoordMode;
  onCursorCoordModeChange?: (mode: CursorCoordMode) => void;
}
const StatusBar: React.FC<IStatusBarProps> = ({
  jgisModel,
  commands,
  loading,
  projection,
  onProjectionChange,
  cursor,
  cursorCoordMode,
  onCursorCoordModeChange,
}) => {
  const [projectionCode, setProjectionCode] = useState(projection?.code);

  useEffect(() => {
    if (projection?.code) {
      setProjectionCode(projection.code);
    }
  }, [projection?.code]);

  const handleProjectionChange = (nextCode: string): void => {
    if (!canChangeProjection) {
      return;
    }

    setProjectionCode(nextCode);
    onProjectionChange?.(nextCode);
  };

  const features = useMapFeatures(jgisModel);
  const activeFeatures =
    features ??
    MAP_ADAPTER_FEATURES[
      jgisModel.getOptions().mapAdapter ?? DEFAULT_MAP_ADAPTER
    ];
  const rendererName = activeFeatures.name;
  const canChangeProjection = activeFeatures.customProjections;

  return (
    <div className="jgis-status-bar">
      {loading && (
        <div style={{ width: '16%', padding: '0 6px' }}>
          <Progress height={14} />
        </div>
      )}
      <Select
        value={cursorCoordMode}
        onValueChange={value => {
          value && onCursorCoordModeChange?.(value);
        }}
      >
        <SelectTrigger
          className="jgis-status-bar-item jgis-status-bar-coords justify-start gap-1 border-0 bg-transparent px-1 text-inherit shadow-none focus-visible:border-0 focus-visible:ring-0"
          title="Coordinate units"
          aria-label={`Coordinates (${cursorCoordMode}). Click to change units.`}
          render={<Button variant="ghost" size="xs" />}
        >
          <FontAwesomeIcon icon={faLocationDot} />
          <span className="w-[32ch]">{formatCursor(cursor)}</span>
        </SelectTrigger>
        <SelectContent side="top" align="center" className="w-auto min-w-44">
          {CURSOR_COORD_MODES.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="jgis-status-bar-item jgis-status-bar-projection">
        {canChangeProjection ? (
          <ProjectionCombobox
            code={projectionCode}
            onProjectionChange={handleProjectionChange}
          />
        ) : (
          <span
            title={
              'Maplibre only supports EPSG:3857. Switch to OpenLayers to use other projections.'
            }
          >
            {projectionCode ?? 'EPSG:3857'}
          </span>
        )}
      </div>
      <button
        type="button"
        className="jgis-status-bar-item jgis-status-bar-button"
        title="Map renderer: click to change or compare renderers"
        aria-label={`Map renderer: ${rendererName}. Click to change.`}
        disabled={!commands || !jgisModel.sharedModel.editable}
        onClick={() => {
          void commands?.execute(CommandIDs.openMapRendererDialog, {
            filePath: jgisModel.filePath,
          });
        }}
      >
        <FontAwesomeIcon icon={faMap} /> <span>{rendererName}</span>
      </button>
    </div>
  );
};

function formatCursor(cursor: ICursorDisplay | null): string {
  if (!cursor) {
    return '—';
  }

  switch (cursor.mode) {
    case 'degrees':
      return (
        `lon: ${formatDegrees(cursor.lon)}  ` +
        `lat: ${formatDegrees(cursor.lat)}`
      );
    case 'meters':
      return `x: ${formatMeters(cursor.x)}  ` + `y: ${formatMeters(cursor.y)}`;
    case 'projection': {
      const isAngular = cursor.unit === 'degrees' || cursor.unit === 'deg';
      if (isAngular) {
        const lon = wrapToInterval(cursor.x, -180, 180);
        return (
          `lon: ${formatCoordinate(lon, cursor.unit)}  ` +
          `lat: ${formatCoordinate(cursor.y, cursor.unit)}`
        );
      }

      return (
        `x: ${formatCoordinate(cursor.x, cursor.unit)}  ` +
        `y: ${formatCoordinate(cursor.y, cursor.unit)}`
      );
    }
  }
}

function formatDegrees(value: number): string {
  return `${value.toFixed(5)}°`;
}

function formatMeters(value: number): string {
  return `${Math.round(value).toLocaleString()} m`;
}

function formatCoordinate(value: number, unit: string): string {
  if (unit === 'degrees' || unit === 'deg') {
    return `${value.toFixed(5)}°`;
  }

  return `${Math.round(value).toLocaleString()} ${unit}`;
}

export default StatusBar;
