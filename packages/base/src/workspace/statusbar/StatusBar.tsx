import {
  faGlobe,
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
import { useMapFeatures } from '@/src/mainview/hooks/useMapFeatures';
import { DEFAULT_MAP_ADAPTER } from '@/src/mainview/mapAdapter';
import { MAP_ADAPTER_FEATURES } from '@/src/mainview/mapAdapterFeatures';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  commands: CommandRegistry;
  loading?: boolean;
  projection?: { code: string; units: string };
  scale: number;
}
const StatusBar: React.FC<IStatusBarProps> = ({
  jgisModel,
  commands,
  loading,
  projection,
  scale,
}) => {
  const [coords, setCoords] = useState<JgisCoordinates>({ x: 0, y: 0 });

  const features = useMapFeatures(jgisModel);
  const rendererName =
    features?.name ??
    MAP_ADAPTER_FEATURES[
      jgisModel.getOptions().mapAdapter ?? DEFAULT_MAP_ADAPTER
    ].name;

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
      <div className="jgis-status-bar-item">
        <FontAwesomeIcon icon={faGlobe} />{' '}
        <span>{projection?.code ?? null}</span>
      </div>
      <div className="jgis-status-bar-item">Units: {projection?.units}</div>
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

export default StatusBar;
