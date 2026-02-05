import React, { useEffect, useState } from 'react';

import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import MultibandColor from './types/MultibandColor';
import SingleBandPseudoColor from './types/SingleBandPseudoColor';

const TiffRendering: React.FC<ISymbologyDialogProps> = ({
  model,
  state,
  okSignalPromise,
  resolveDialog,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  const renderTypes = ['Singleband Pseudocolor', 'Multiband Color'];
  const [selectedRenderType, setSelectedRenderType] = useState<string>();
  const [componentToRender, setComponentToRender] = useState<any>(null);

  let RenderComponent;

  if (!layerId) {
    return;
  }
  useEffect(() => {
    const layer = model.getLayer(layerId);
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
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            resolveDialog={resolveDialog}
            layerId={layerId}
            isStorySegmentOverride={isStorySegmentOverride}
            segmentId={segmentId}
          />
        );
        break;
      case 'Multiband Color':
        RenderComponent = (
          <MultibandColor
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            resolveDialog={resolveDialog}
            layerId={layerId}
            isStorySegmentOverride={isStorySegmentOverride}
            segmentId={segmentId}
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
