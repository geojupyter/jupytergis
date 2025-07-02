import {
  faGlobe,
  faLocationDot,
  faRuler,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel, JgisCoordinates } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { version } from '@/package.json';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  loading?: boolean;
  projection?: { code: string; units: string };
  scale: number;
}
const StatusBar: React.FC<IStatusBarProps> = props => {
  const [coords, setCoords] = useState<JgisCoordinates>({ x: 0, y: 0 });

  useEffect(() => {
    const handleClientStateChanged = () => {
      const pointer = props.jgisModel?.localState?.pointer?.value;

      if (!pointer) {
        return;
      }

      setCoords({ x: pointer?.coordinates.x, y: pointer?.coordinates.y });
    };

    props.jgisModel.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      props.jgisModel.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, [props.jgisModel]);

  return (
    <div className="jgis-status-bar">
      {props.loading && (
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
        <span>Scale: 1: {Math.trunc(props.scale)}</span>
      </div>
      <div className="jgis-status-bar-item">
        <FontAwesomeIcon icon={faGlobe} />{' '}
        <span>{props.projection?.code ?? null}</span>
      </div>
      <div className="jgis-status-bar-item">Units: {props.projection?.units}</div>
    </div>
  );
};

export default StatusBar;
