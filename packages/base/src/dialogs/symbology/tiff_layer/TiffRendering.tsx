import React, { useEffect, useState } from 'react';
import { ISymbologyDialogProps } from '../symbologyDialog';
import SingleBandPseudoColor from './types/SingleBandPseudoColor';
import MultibandColor from './types/MultibandColor';

const TiffRendering = ({
  context,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const renderTypes = ['Singleband Pseudocolor', 'Multiband Color'];
  const [selectedRenderType, setSelectedRenderType] = useState<string>();
  const [componentToRender, setComponentToRender] = useState<any>(null);

  let RenderComponent;

  if (!layerId) {
    return;
  }
  useEffect(() => {
    const layer = context.model.getLayer(layerId);
    const renderType = layer?.parameters?.symbologyState?.renderType;
    setSelectedRenderType(renderType ?? 'Singleband Pseudocolor');
  }, []);

  useEffect(() => {
    if (!selectedRenderType) {
      return;
    }

    switch (selectedRenderType) {
      case 'Singleband Pseudocolor':
        RenderComponent = (
          <SingleBandPseudoColor
            context={context}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      case 'Multiband Color':
        RenderComponent = (
          <MultibandColor
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

export default TiffRendering;
