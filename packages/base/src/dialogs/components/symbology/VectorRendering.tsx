import { ReadonlyJSONObject } from '@lumino/coreutils';
import React, { useEffect, useState } from 'react';
import { ISymbologyDialogProps } from '../../symbologyDialog';
import Graduated from './Graduated';
import SimpleSymbol from './SimpleSymbol';

const VectorRendering = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const renderTypes = ['Single Symbol', 'Graduated'];
  const [selectedRenderType, setSelectedRenderType] = useState('Single Symbol');
  const [componentToRender, setComponentToRender] = useState<any>(null);

  let RenderComponent;

  if (!layerId) {
    return;
  }

  useEffect(() => {
    const getSelectedRenderType = async () => {
      const layerState = await state.fetch(layerId);

      setSelectedRenderType(
        (layerState as ReadonlyJSONObject).renderType as string
      );
    };

    getSelectedRenderType();
  }, []);

  useEffect(() => {
    switch (selectedRenderType) {
      case 'Single Symbol':
        RenderComponent = (
          <SimpleSymbol
            context={context}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      case 'Graduated':
        RenderComponent = (
          <Graduated
            context={context}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      default:
        RenderComponent = <div>Render Type Not Implemented (yet)</div>;
    }
    setComponentToRender(RenderComponent);
  }, [selectedRenderType]);

  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor="render-type-select">Render Type:</label>
        <select
          name="render-type-select"
          id="render-type-select"
          value={selectedRenderType}
          onChange={event => {
            setSelectedRenderType(event.target.value);
          }}
        >
          {renderTypes.map((func, funcIndex) => (
            <option key={func} value={func}>
              {func}
            </option>
          ))}
        </select>
      </div>
      {componentToRender}
    </>
  );
};

export default VectorRendering;
