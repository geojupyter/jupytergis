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

type RenderType = 'Single Symbol' | 'Canonical' | 'Graduated' | 'Heatmap';
interface RenderTypeProps {
  component: React.Component;
  attributeChecker?: Function;
  supportedLayerTypes: string[];
}
interface SelectableRenderTypeProps extends RenderTypeProps {
  supportedAttributes?: string[];
}

const RENDER_TYPE_OPTIONS: {RenderType: RenderTypeProps} = {
  'Single Symbol': {
    component: SimpleSymbol,
    supportedLayerTypes: ['VectorLayer', 'VectorTileLayer', 'HeatmapLayer']
  },
  'Canonical': {
    component: Canonical,
    attributeChecker: getColorCodeFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer']
  },
  'Graduated': {
    component: Graduated,
    attributeChecker: getNumericFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer']
  },
  'Categorized': {
    component: Categorized,
    attributeChecker: getNumericFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer']
  },
  'Heatmap': {
    component: Heatmap,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer']
  }
} as const;

const getSelectableRenderTypes =
  (featureProperties: Never): {RenderType: SelectableRenderTypeProps} => {
    let out: {RenderType: SelectableRenderTypeProps} = {};

    for (var [renderType, renderTypeProps] of Object.entries(RENDER_TYPE_OPTIONS)) {
      if (!('attributeChecker' in renderTypeProps)) {
      }
    }

  };

const validRenderTypesAndAttributes = (featureProperties): [RenderType, undefined | string[]] => {
  // check type
  const foo: Never = featureProperties;

  let out = []
  for (var [renderType, renderTypeProps] of Object.entries(RENDER_TYPE_OPTIONS)) {
    if (!('attributeChecker' in renderTypeProps)) {
      out.push([renderType, undefined]);
    } else {
      let attrs = Object.keys(renderTypeProps.attributeChecker(featureProperties));
      if (attrs.length === 0) {
        continue;
      }
      out.push([renderType, attrs]);
    }
  }

  return out;
}

const VectorRendering = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const [selectedRenderType, setSelectedRenderType] = useState('');
  const [componentToRender, setComponentToRender] = useState<any>(null);
  const [renderTypeOptions, setRenderTypeOptions] =
    useState<RenderType[]>(['Single Symbol']);

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

  const selectableRenderTypes = getSelectableRenderTypes(featureProperties);

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
      <selectableRenderTypes.component
        model={model}
        state={state}
        okSignalPromise={okSignalPromise}
        cancel={cancel}
        layerId={layerId}
        ( selectableRenderTypes.selectableAttributes ? {selectableAttributes: selectableRenderTypes.selectableAttributes} : {} )
      />
    </>
  );
};

export default VectorRendering;
