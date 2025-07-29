import { Button } from '@jupyterlab/ui-components';
import React from 'react';

import { IStopRow } from '@/src/dialogs/symbology/symbologyDialog';
import StopRow from './StopRow';

interface IStopContainerProps {
  selectedMethod: string;
  stopRows: IStopRow[];
  setStopRows: (stops: IStopRow[]) => void;
}

const StopContainer: React.FC<IStopContainerProps> = props => {
  const addStopRow = () => {
    props.setStopRows([
      {
        stop: 0,
        output: [0, 0, 0, 1],
      },
      ...props.stopRows,
    ]);
  };

  const deleteStopRow = (index: number) => {
    const newFilters = [...props.stopRows];
    newFilters.splice(index, 1);

    props.setStopRows(newFilters);
  };

  return (
    <>
      <div className="jp-gis-stop-container">
        <div className="jp-gis-stop-labels" style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: '0 0 18%' }}>Value</span>
          <span>Output Value</span>
        </div>
        {props.stopRows.map((stop, index) => (
          <StopRow
            key={`${index}-${stop.output}`}
            index={index}
            value={stop.stop}
            outputValue={stop.output}
            stopRows={props.stopRows}
            setStopRows={props.setStopRows}
            deleteRow={() => deleteStopRow(index)}
            useNumber={props.selectedMethod === 'radius' ? true : false}
          />
        ))}
      </div>
      <div className="jp-gis-symbology-button-container">
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={addStopRow}
        >
          Add Stop
        </Button>
      </div>
    </>
  );
};

export default StopContainer;
