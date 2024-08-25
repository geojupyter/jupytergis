import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';

interface ITerrainDialogProps {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
  okSignalPromise: PromiseDelegate<Signal<TerrainDialogWidget, null>>;
  cancel: () => void;
}

const TerrainDialog = ({
  context,
  okSignalPromise,
  cancel
}: ITerrainDialogProps) => {
  const rasterDemSources = context.model.getSourcesByType('RasterDemSource');

  const [selectedSource, setSelectedSource] = useState(
    Object.keys(rasterDemSources)[0]
  );
  const [exaggerationInput, setExaggerationInput] = useState(1);

  const selectedSourceRef = useRef(selectedSource);
  const exaggerationInputRef = useRef(exaggerationInput);

  useEffect(() => {
    selectedSourceRef.current = selectedSource;
    exaggerationInputRef.current = exaggerationInput;
  }, [selectedSource, exaggerationInput]);

  // Handler for changing the selected option
  const handleSourceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSource(event.target.value);
  };

  // Handler for changing the number input
  const handleExaggerationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setExaggerationInput(Number(event.target.value));
  };

  const handleOk = () => {
    context.model.setTerrain({
      source: selectedSourceRef.current,
      exaggeration: exaggerationInputRef.current
    });
    cancel();
  };

  okSignalPromise.promise.then(okSignal => {
    okSignal.connect(handleOk);
  });

  return (
    <div className="jp-gis-terrain-main">
      <label className="jp-gis-terrain-label" htmlFor="source">
        Source:
      </label>
      <select
        id="source"
        className="jp-mod-styled"
        value={selectedSource}
        onChange={handleSourceChange}
        aria-label="Select source"
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
        className="jp-mod-styled"
        type="number"
        min={0}
        step={0.1}
        value={exaggerationInput}
        onChange={handleExaggerationChange}
        placeholder="Enter an exaggeration value"
        aria-label="Enter exaggeration value"
      />
    </div>
  );
};

export interface ITerrainDialogOptions {
  context: DocumentRegistry.IContext<IJupyterGISModel>;
}

export class TerrainDialogWidget extends Dialog<boolean> {
  private okSignal: Signal<TerrainDialogWidget, null>;

  constructor(options: ITerrainDialogOptions) {
    const cancelCallback = () => {
      this.resolve(0);
    };

    const okSignalPromise = new PromiseDelegate<
      Signal<TerrainDialogWidget, null>
    >();

    const body = (
      <TerrainDialog
        context={options.context}
        okSignalPromise={okSignalPromise}
        cancel={cancelCallback}
      />
    );

    super({ title: 'Add New Terrain', body });

    this.id = 'jupytergis::terrain';

    this.okSignal = new Signal(this);
    okSignalPromise.resolve(this.okSignal);
  }

  resolve(index?: number): void {
    if (index === 0) {
      super.resolve(index);
    }

    if (index === 1) {
      this.okSignal.emit(null);
    }
  }
}

export default TerrainDialog;
