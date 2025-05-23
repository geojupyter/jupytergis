import React, { useState } from 'react';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import Canonical from './types/Canonical';
import Categorized from './types/Categorized';
import Graduated from './types/Graduated';
import Heatmap from './types/Heatmap';
import SimpleSymbol from './types/SimpleSymbol';
import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import {
  getColorCodeFeatureAttributes,
  getNumericFeatureAttributes,
} from '@/src/tools';
import { LayerType } from '@jupytergis/schema';

// type RenderType = 'Single Symbol' | 'Canonical' | 'Graduated' | 'Categorized' | 'Heatmap';
interface RenderTypeProps {
  component: any;
  attributeChecker?: Function;
  supportedLayerTypes: string[];
}
// TODO: Why this doesn't work???? >:(
// interface RenderTypes {
//   [key in RenderType]: RenderTypeProps;
// }
interface RenderTypes {
  ['Single Symbol']: RenderTypeProps;
  ['Canonical']: RenderTypeProps;
  ['Graduated']: RenderTypeProps;
  ['Categorized']: RenderTypeProps;
  ['Heatmap']: RenderTypeProps;
}
type RenderType = keyof RenderTypes;

interface SelectableRenderTypeProps extends RenderTypeProps {
  selectableAttributes?: string[];
  layerTypeSupported: boolean;
}
// interface SelectableRenderTypes {
//   [key in RenderTypes]: SelectableRenderTypeProps;
// }
interface SelectableRenderTypes {
  ['Single Symbol']: SelectableRenderTypeProps;
  ['Canonical']: SelectableRenderTypeProps;
  ['Graduated']: SelectableRenderTypeProps;
  ['Categorized']: SelectableRenderTypeProps;
  ['Heatmap']: SelectableRenderTypeProps;
}

const RENDER_TYPE_OPTIONS: RenderTypes = {
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
  (featureProperties: Record<string, Set<any>>, layerType: LayerType): SelectableRenderTypes => {
    return Object.fromEntries((Object.keys(RENDER_TYPE_OPTIONS) as RenderType[]).map(
      (renderType) => {
        const renderTypeProps = RENDER_TYPE_OPTIONS[renderType];
        const layerTypeSupported = renderTypeProps.supportedLayerTypes.includes(layerType);

        return [renderType, {
          ...renderTypeProps,
          ...(renderTypeProps.attributeChecker
            ? renderTypeProps.attributeChecker(featureProperties)
            : {}
          ),
          layerTypeSupported
        }];
      }
    )) as SelectableRenderTypes;
  };
>>>>>>> 8068bfa (WIP refactor vector symbology menu)

const VectorRendering = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
}: ISymbologyDialogProps) => {
  const [selectedRenderType, setSelectedRenderType] = useState<RenderType>('Single Symbol');

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { featureProperties } = useGetProperties({
    layerId,
    model: model,
  });

  const selectableRenderTypes = getSelectableRenderTypes(featureProperties, layer.type);
  const selectedRenderTypeEnriched = selectableRenderTypes[selectedRenderType];

  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor="render-type-select">Render Type:</label>
        <select
          name="render-type-select"
          id="render-type-select"
          value={selectedRenderType}
          onChange={event => {
            setSelectedRenderType(event.target.value as RenderType);
          }}
        >
          {
            Object.entries(selectableRenderTypes)
              .filter(
                ([renderType, renderTypeProps]) => renderTypeProps.layerTypeSupported
              ).map(
                ([renderType, renderTypeProps]) => (
                  <option key={renderType} value={renderType}>
                    {renderType}
                  </option>
                )
              )
          }
        </select>
      </div>
      <selectedRenderTypeEnriched.component
        model={model}
        state={state}
        okSignalPromise={okSignalPromise}
        cancel={cancel}
        layerId={layerId}
        {...(selectedRenderTypeEnriched.selectableAttributes
        ? {selectableAttributes: selectedRenderTypeEnriched.selectableAttributes}
        : {} )}
      />
    </>
  );
};

export default VectorRendering;
