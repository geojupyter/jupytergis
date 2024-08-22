import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@jupyterlab/ui-components';
import React from 'react';

const StopRow = ({
  zoom,
  outputValue
}: {
  zoom: number;
  outputValue: string;
  setStopRows: any;
}) => {
  return (
    <div className="jp-gis-filter-row">
      <input type="number" defaultValue={zoom} style={{ width: '13%' }} />
      <div style={{ height: '100%' }}>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: outputValue,
            height: 26,
            width: 14
          }}
        ></span>
        <input defaultValue={outputValue} />
      </div>
      <Button
        id={'jp-gis-remove-filter-'}
        className="jp-Button jp-gis-filter-icon"
      >
        <FontAwesomeIcon icon={faTrash} />
      </Button>
    </div>
  );
};

export default StopRow;
