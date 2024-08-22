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
    <div>
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
