import { faGlobe, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel, JgisCoordinates } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  loading?: boolean;
  projection?: string;
}
const StatusBar = ({ jgisModel, loading, projection }: IStatusBarProps) => {
  const [coords, setCoords] = useState<JgisCoordinates>({ x: 0, y: 0 });

  useEffect(() => {
    const handleClientStateChanged = () => {
      const pointer = jgisModel?.localState?.pointer?.value;

      if (!pointer) {
        return;
      }

      setCoords({ x: pointer?.coordinates.x, y: pointer?.coordinates.y });
    };

    jgisModel.clientStateChanged.connect(handleClientStateChanged);

    return () => {
      jgisModel.clientStateChanged.disconnect(handleClientStateChanged);
    };
  }, [jgisModel]);

  return (
    <div className="jgis-status-bar">
      <div style={{ width: '20%' }}>
        {loading ? <Progress height={14} /> : null}
      </div>
      <div>
        <FontAwesomeIcon icon={faLocationDot} /> x: {Math.trunc(coords.x)} y:{' '}
        {Math.trunc(coords.y)}
      </div>
      <div>
        <FontAwesomeIcon icon={faGlobe} /> {projection ?? null}
      </div>
    </div>
  );
};

export default StatusBar;
