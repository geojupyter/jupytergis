import React, { useEffect, useState } from 'react';
import { ISymbologyDialogProps } from '../symbologyDialog';
import Canonical from './types/Canonical';
import Categorized from './types/Categorized';
import Graduated from './types/Graduated';
import Heatmap from './types/Heatmap';
import SimpleSymbol from './types/SimpleSymbol';
import { useGetProperties } from '../hooks/useGetProperties';
import {
  getColorCodeFeatureAttributes,
  getNumericFeatureAttributes
} from '../../../tools';

const VectorRendering = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const [selectedRenderType, setSelectedRenderType] = useState('');
  const [componentToRender, setComponentToRender] = useState<any>(null);
  const [renderTypeOptions, setRenderTypeOptions] = useState<string[]>([
    'Single Symbol'
  ]);

  let RenderComponent;

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { featureProperties } = useGetProperties({
    layerId,
    model: model
  });

  useEffect(() => {
    let renderType = layer.parameters?.symbologyState?.renderType;
    if (!renderType) {
      renderType = layer.type === 'HeatmapLayer' ? 'Heatmap' : 'Single Symbol';
    }
    setSelectedRenderType(renderType);

    const vectorLayerOptions = ['Single Symbol', 'Heatmap'];

    if (
      Object.keys(getColorCodeFeatureAttributes(featureProperties)).length > 0
    ) {
      vectorLayerOptions.push('Canonical');
    }
    if (
      Object.keys(getNumericFeatureAttributes(featureProperties)).length > 0
    ) {
      vectorLayerOptions.push('Graduated', 'Categorized');
    }

    const options: Record<string, string[]> = {
      VectorLayer: vectorLayerOptions,
      VectorTileLayer: ['Single Symbol'],
      HeatmapLayer: ['Single Symbol', 'Graduated', 'Categorized', 'Heatmap']
    };
    setRenderTypeOptions(options[layer.type]);
  }, [featureProperties]);

  useEffect(() => {
    switch (selectedRenderType) {
      case 'Single Symbol':
        RenderComponent = (
          <SimpleSymbol
            model={model}
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
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      case 'Categorized':
        RenderComponent = (
          <Categorized
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      case 'Canonical':
        RenderComponent = (
          <Canonical
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      case 'Heatmap':
        RenderComponent = (
          <Heatmap
            model={model}
            state={state}
            okSignalPromise={okSignalPromise}
            cancel={cancel}
            layerId={layerId}
          />
        );
        break;
      default:
        RenderComponent = <div>Select a render type</div>;
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
