import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
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
  const [selectedRenderType, setSelectedRenderType] = useState('Single Symbol');
  const [componentToRender, setComponentToRender] = useState<any>(null);
  const [renderTypeOptions, setRenderTypeOptions] = useState<string[]>([
    'Single Symbol'
  ]);

  let RenderComponent;

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  useEffect(() => {
    const getSelectedRenderType = async () => {
      const layerState = await state.fetch(`jupytergis:${layerId}`);

      if (!layerState) {
        return;
      }

      const renderType = (layerState as ReadonlyPartialJSONObject)
        .renderType as string;

      setSelectedRenderType(renderType ?? 'Single Symbol');
    };

    if (layer.type === 'VectorLayer') {
      const options = ['Single Symbol', 'Graduated'];
      setRenderTypeOptions(options);
    }

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
          {renderTypeOptions.map((func, funcIndex) => (
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
