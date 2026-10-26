import { faLocationDot, faMap } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel } from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import React, { useEffect, useState } from 'react';

import { version } from '@/package.json';
import { CommandIDs } from '@/src/constants';
import { useMapFeatures } from '@/src/mainview/hooks/useMapFeatures';
import { DEFAULT_MAP_ADAPTER, ICursorDisplay } from '@/src/mainview/mapAdapter';
import { MAP_ADAPTER_FEATURES } from '@/src/mainview/mapAdapterFeatures';
import { wrapToInterval } from '@/src/tools';
import { ProjectionCombobox } from './ProjectionCombobox';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  commands: CommandRegistry;
  loading?: boolean;
  projection?: { code: string; units: string };
  onProjectionChange?: (code: string) => void;
  cursor: ICursorDisplay | null;
}
const StatusBar: React.FC<IStatusBarProps> = ({
  jgisModel,
  commands,
  loading,
  projection,
  onProjectionChange,
  cursor,
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
      <div className="jgis-status-bar-item">
        <span>jgis: {version}</span>
      </div>
      <div className="jgis-status-bar-item jgis-status-bar-coords">
        <FontAwesomeIcon icon={faLocationDot} />
        <span> {formatCursor(cursor)}</span>
      </div>
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
        `x: ${formatDegrees(cursor.lon)}  ` + `y: ${formatDegrees(cursor.lat)}`
      );
    case 'meters':
      return `x: ${formatMeters(cursor.x)}  ` + `y: ${formatMeters(cursor.y)}`;
    case 'projection': {
      const isAngular = cursor.unit === 'degrees' || cursor.unit === 'deg';
      const x = isAngular ? wrapToInterval(cursor.x, -180, 180) : cursor.x;

      return (
        `x: ${formatCoordinate(x, cursor.unit)}  ` +
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
  const isAngular = unit === 'degrees' || unit === 'deg';
  if (isAngular) {
    return `${value.toFixed(5)}°`;
  }

  return `${Math.round(value).toLocaleString()} ${unit}`;
}

export default StatusBar;
