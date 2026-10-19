import {
  faLocationDot,
  faMap,
  faRuler,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel, JgisCoordinates } from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import React, { useEffect, useState } from 'react';

import { version } from '@/package.json';
import { CommandIDs } from '@/src/constants';
import { getCrsUnits } from '@/src/features/metadata/utils/crs';
import { useMapFeatures } from '@/src/mainview/hooks/useMapFeatures';
import { DEFAULT_MAP_ADAPTER } from '@/src/mainview/mapAdapter';
import { MAP_ADAPTER_FEATURES } from '@/src/mainview/mapAdapterFeatures';
import { ProjectionCombobox } from './ProjectionCombobox';
import { getProjectionOption } from './projectionOptions';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  commands: CommandRegistry;
  loading?: boolean;
  projection?: { code: string; units: string };
  onProjectionChange?: (code: string) => void;
  scale: number;
}
const StatusBar: React.FC<IStatusBarProps> = ({
  jgisModel,
  commands,
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
      <div className="jgis-status-bar-item">
        Units: {projectionUnits(projectionCode, projection?.units)}
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
