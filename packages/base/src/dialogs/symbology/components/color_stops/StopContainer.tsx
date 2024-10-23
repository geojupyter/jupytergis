import React from 'react';
import { Button } from '@jupyterlab/ui-components';
import { IStopRow } from '../../symbologyDialog';
import StopRow from './StopRow';

interface IStopContainerProps {
  selectedMethod: string;
  stopRows: IStopRow[];
  setStopRows: (stops: IStopRow[]) => void;
}

const StopContainer = ({
  selectedMethod,
  stopRows,
  setStopRows
}: IStopContainerProps) => {
  const addStopRow = () => {
    setStopRows([
      {
        stop: 0,
        output: [0, 0, 0, 1]
      },
      ...stopRows
    ]);
  };

  const deleteStopRow = (index: number) => {
    const newFilters = [...stopRows];
    newFilters.splice(index, 1);

    setStopRows(newFilters);
  };

  return (
    <>
      <div className="jp-gis-stop-container">
        <div className="jp-gis-stop-labels" style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: '0 0 18%' }}>Value</span>
          <span>Output Value</span>
        </div>
        {stopRows.map((stop, index) => (
          <StopRow
            key={`${index}-${stop.output}`}
            index={index}
            value={stop.stop}
            outputValue={stop.output}
            stopRows={stopRows}
            setStopRows={setStopRows}
            deleteRow={() => deleteStopRow(index)}
            useNumber={selectedMethod === 'radius' ? true : false}
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
