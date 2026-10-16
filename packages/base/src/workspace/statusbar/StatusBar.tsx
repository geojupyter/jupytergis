import { faLocationDot, faRuler } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel, JgisCoordinates } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { version } from '@/package.json';
import { getCrsUnits } from '@/src/features/metadata/utils/crs';
import { ProjectionCombobox } from './ProjectionCombobox';
import { getProjectionOption } from './projectionOptions';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  loading?: boolean;
  projection?: { code: string; units: string };
  onProjectionChange?: (code: string) => void;
  scale: number;
}
const StatusBar: React.FC<IStatusBarProps> = ({
  jgisModel,
  loading,
  projection,
  onProjectionChange,
  scale,
}) => {
  const [coords, setCoords] = useState<JgisCoordinates>({ x: 0, y: 0 });
  const [projectionCode, setProjectionCode] = useState(projection?.code);

  useEffect(() => {
    if (projection?.code) {
      setProjectionCode(projection.code);
    }
  }, [projection?.code]);

  const handleProjectionChange = (nextCode: string): void => {
    setProjectionCode(nextCode);
    onProjectionChange?.(nextCode);
  };

  useEffect(() => {
    const handlePointerChanged = () => {
      const pointer = jgisModel?.localState?.pointer?.value;

      if (!pointer) {
        return;
      }

      setCoords({ x: pointer?.coordinates.x, y: pointer?.coordinates.y });
    };

    jgisModel.pointerChanged.connect(handlePointerChanged);
    handlePointerChanged();

    return () => {
      jgisModel.pointerChanged.disconnect(handlePointerChanged);
    };
  }, [jgisModel]);

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
        <span>
          {' '}
          x: {Math.trunc(coords.x)} y: {Math.trunc(coords.y)}
        </span>
      </div>
      <div className="jgis-status-bar-item">
        <FontAwesomeIcon icon={faRuler} />{' '}
        <span>Scale: 1: {Math.trunc(scale)}</span>
      </div>
      <div className="jgis-status-bar-item jgis-status-bar-projection">
        <ProjectionCombobox
          code={projectionCode}
          onProjectionChange={handleProjectionChange}
        />
      </div>
      <div className="jgis-status-bar-item">
        Units: {projectionUnits(projectionCode, projection?.units)}
      </div>
    </div>
  );
};

function projectionUnits(
  code: string | undefined,
  fallback: string | undefined,
): string | undefined {
  const option = getProjectionOption(code);
  if (!option) {
    return fallback;
  }

  return getCrsUnits(option.proj4string) ?? fallback;
}

export default StatusBar;
