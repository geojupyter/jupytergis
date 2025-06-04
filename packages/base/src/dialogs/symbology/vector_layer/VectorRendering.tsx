import { LayerType } from '@jupytergis/schema';
import React, { useState } from 'react';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  getColorCodeFeatureAttributes,
  getNumericFeatureAttributes,
  objectEntries,
} from '@/src/tools';
import Canonical from './types/Canonical';
import Categorized from './types/Categorized';
import Graduated from './types/Graduated';
import Heatmap from './types/Heatmap';
import SimpleSymbol from './types/SimpleSymbol';

type RenderType =
  | 'Single Symbol'
  | 'Canonical'
  | 'Graduated'
  | 'Categorized'
  | 'Heatmap';
interface IRenderTypeProps {
  component: any;
  attributeChecker?: (...args: any[]) => any;
  supportedLayerTypes: string[];
}
type RenderTypeOptions = {
  [key: string]: IRenderTypeProps;
};

interface ISelectableRenderTypeProps extends IRenderTypeProps {
  selectableAttributesAndValues?: Record<string, Set<any>>;
  layerTypeSupported: boolean;
}
type SelectableRenderTypes = {
  [key: string]: ISelectableRenderTypeProps;
};

const RENDER_TYPE_OPTIONS: RenderTypeOptions = {
  'Single Symbol': {
    component: SimpleSymbol,
    supportedLayerTypes: ['VectorLayer', 'VectorTileLayer', 'HeatmapLayer'],
  },
  Canonical: {
    component: Canonical,
    attributeChecker: getColorCodeFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer'],
  },
  Graduated: {
    component: Graduated,
    attributeChecker: getNumericFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer'],
  },
  Categorized: {
    component: Categorized,
    attributeChecker: getNumericFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer'],
  },
  Heatmap: {
    component: Heatmap,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer'],
  },
} as const;

const getSelectableRenderTypes = (
  featureProperties: Record<string, Set<any>>,
  layerType: LayerType,
): SelectableRenderTypes => {
  return Object.fromEntries(
    objectEntries(RENDER_TYPE_OPTIONS).map(([renderType, renderTypeProps]) => {
      const layerTypeSupported =
        renderTypeProps.supportedLayerTypes.includes(layerType);

      return [
        renderType,
        {
          ...renderTypeProps,
          ...(renderTypeProps.attributeChecker
            ? {
                selectableAttributesAndValues:
                  renderTypeProps.attributeChecker(featureProperties),
              }
            : {}),
          layerTypeSupported,
        },
      ];
    }),
  );
};

const VectorRendering = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
}: ISymbologyDialogProps) => {
  const [selectedRenderType, setSelectedRenderType] =
    useState<RenderType>('Single Symbol');

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

  const selectableRenderTypes = getSelectableRenderTypes(
    featureProperties,
    layer.type,
  );
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
          {objectEntries(selectableRenderTypes)
            .filter(
              ([renderType, renderTypeProps]) =>
                renderTypeProps.layerTypeSupported,
            )
            .map(([renderType, renderTypeProps]) => (
              <option key={renderType} value={renderType}>
                {renderType}
              </option>
            ))}
        </select>
      </div>
      <selectedRenderTypeEnriched.component
        model={model}
        state={state}
        okSignalPromise={okSignalPromise}
        cancel={cancel}
        layerId={layerId}
        {...(selectedRenderTypeEnriched.selectableAttributesAndValues
          ? {
              selectableAttributesAndValues:
                selectedRenderTypeEnriched.selectableAttributesAndValues,
            }
          : {})}
      />
    </>
  );
};

export default VectorRendering;
