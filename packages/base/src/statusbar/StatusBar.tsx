import { IJupyterGISModel, JgisCoordinates } from '@jupytergis/schema';
import { Progress } from '@jupyter/react-components';
import React, { useEffect, useState } from 'react';
import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  loading?: boolean;
  projection?: string;
}
const StatusBar = ({ jgisModel, loading, projection }: IStatusBarProps) => {
  const [coords, setCoords] = useState<JgisCoordinates>({ x: 0, y: 0 });

  useEffect(() => {
    console.log('loading in status bar', loading);
  }, [loading]);

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
      <div style={{ width: '20%' }}>{loading ? <Progress /> : null}</div>
      <div>
        x: {Math.trunc(coords.x)} y: {Math.trunc(coords.y)}
      </div>
      <div>
        <FontAwesomeIcon icon={faGlobe} /> {projection ?? null}
      </div>
    </div>
  );
};

export default StatusBar;
