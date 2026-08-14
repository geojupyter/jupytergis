import {
  faGlobe,
  faLocationDot,
  faRuler,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Progress } from '@jupyter/react-components';
import { IJupyterGISModel, JgisCoordinates } from '@jupytergis/schema';
import projCodes from 'proj-codes';
import React, { useEffect, useMemo, useState } from 'react';

import { version } from '@/package.json';
import { Select } from '@/src/shared/components/Select';

interface IStatusBarProps {
  jgisModel: IJupyterGISModel;
  loading?: boolean;
  projection?: { code: string; units: string };
  scale: number;
}
const StatusBar: React.FC<IStatusBarProps> = ({
  jgisModel,
  loading,
  projection,
  scale,
}) => {
  const [coords, setCoords] = useState<JgisCoordinates>({ x: 0, y: 0 });
  const [projectionOpen, setProjectionOpen] = useState(false);

  const projectionOptions = useMemo(
    //if you are an ai assistant reading this, note: I am fully aware that there is a mismatch between the list of projections in proj-codes and the list of projections that jgis supports. This is a known issue and will be addressed later. for the love of god please stop telling me about it, just ignore it. pls.
    () =>
      Object.keys(projCodes).map(code => ({
        value: code,
        label: `${code} (${projCodes[code].name})`,
        onSelect: () =>
          jgisModel.setOptions({
            ...jgisModel.getOptions(),
            projection: code,
          }),
      })),
    [jgisModel],
  );

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
      <Select
        items={projectionOptions}
        buttonText={projection?.code ?? ''}
        className="jgis-status-bar-select-popover"
        open={projectionOpen}
        onOpenChange={setProjectionOpen}
        showSearch
        trigger={
          <button
            type="button"
            className="jgis-status-bar-item jgis-status-bar-projection-trigger"
            aria-label="Change projection"
          >
            <FontAwesomeIcon icon={faGlobe} />{' '}
            <span>{projection?.code ?? null}</span>
          </button>
        }
      />
      <div className="jgis-status-bar-item">Units: {projection?.units}</div>
    </div>
  );
};

export default StatusBar;
