import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { useState } from 'react';

interface ITerrainDialogProps {
  context: DocumentRegistry.IContext<IJupyterGISModel>;

  okSignalPromise: PromiseDelegate<Signal<Dialog<any>, number>>;
  cancel: () => void;
}
const TerrainDialog = ({
  context,
  okSignalPromise,
  cancel
}: ITerrainDialogProps) => {
  const dems = context.model.getSourcesByType('RasterDemSource');

  const [selectedOption, setSelectedOption] = useState(Object.keys(dems)[0]);
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
    console.log('dems', dems);
    console.log('selectedOption', selectedOption);
    context.model.setTerrain({
      source: selectedOption,
      exaggeration: Number(numberInput)
    });
  };

  return (
    <div>
      <label htmlFor="source">Source:</label>
      <select id="source" value={selectedOption} onSelect={handleSelectChange}>
        {Object.entries(dems).map(([key, value]) => (
          <option key={key} value={key}>
            {value}
          </option>
        ))}
      </select>

      <label htmlFor="exaggeration">Exaggeration:</label>
      <input
        id="exaggeration"
        type="number"
        value={numberInput}
        onChange={handleInputChange}
        placeholder="Enter a number"
      />
      <button onClick={handleClick}>ok</button>
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

    const okSignalPromise = new PromiseDelegate<
      Signal<Dialog<IDict>, number>
    >();

    const body = (
      <TerrainDialog
        context={options.context}
        okSignalPromise={okSignalPromise}
        cancel={cancelCallback}
      />
    );

    super({ body, buttons: [Dialog.cancelButton(), Dialog.okButton()] });

    this.id = 'jupytergis::terrain';

    this.okSignal = new Signal(this);
    okSignalPromise.resolve(this.okSignal);

    // Override default dialog style
    // this.addClass('jGIS-layerbrowser-FormDialog');
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(1);
    }
  }

  private okSignal: Signal<Dialog<any>, number>;
}

export default TerrainDialog;
