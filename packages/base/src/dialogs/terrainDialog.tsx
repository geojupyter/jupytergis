import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import React, { useState } from 'react';

interface ITerrainDialogProps {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
  cancel: () => void;
}
const TerrainDialog = ({
  context,

  cancel
}: ITerrainDialogProps) => {
  const rasterDemSources = context.model.getSourcesByType('RasterDemSource');

  const [selectedOption, setSelectedOption] = useState(
    Object.keys(rasterDemSources)[0]
  );
  const [numberInput, setNumberInput] = useState('1');

  // Handler for changing the selected option
  const handleSelectChange = event => {
    setSelectedOption(event.target.value);
  };

  // Handler for changing the number input
  const handleInputChange = event => {
    setNumberInput(event.target.value);
  };

  const handleClick = () => {
    context.model.setTerrain({
      source: selectedOption,
      exaggeration: Number(numberInput)
    });
  };

  return (
    <div className="jp-gis-terrain-main">
      <label className="jp-gis-terrain-label" htmlFor="source">
        Source:
      </label>
      <select
        id="source"
        className="jp-mod-styled"
        value={selectedOption}
        onSelect={handleSelectChange}
      >
        {Object.entries(rasterDemSources).map(([key, value]) => (
          <option key={key} value={key}>
            {value}
          </option>
        ))}
      </select>

      <label className="jp-gis-terrain-label" htmlFor="exaggeration">
        Exaggeration:
      </label>
      <input
        id="exaggeration"
        type="number"
        value={numberInput}
        onChange={handleInputChange}
        placeholder="Enter a number"
      />
      <div className="jp-Dialog-footer" style={{ paddingBottom: 0 }}>
        <button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={handleClick}
        >
          Ok
        </button>
      </div>
    </div>
  );
};

export interface ITerrainDialogOptions {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

export class TerrainDialogWidget extends Dialog<boolean> {
  constructor(options: ITerrainDialogOptions) {
    let cancelCallback: (() => void) | undefined = undefined;
    cancelCallback = () => {
      this.resolve(0);
    };

    const body = (
      <TerrainDialog context={options.context} cancel={cancelCallback} />
    );

    super({ title: 'Add New Terrain', body, buttons: [], hasClose: true });

    this.id = 'jupytergis::terrain';
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }
  }
}

export default TerrainDialog;
