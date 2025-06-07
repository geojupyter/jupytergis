import { LayerType, IJGISLayer } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  getColorCodeFeatureAttributes,
  getNumericFeatureAttributes,
  objectEntries,
} from '@/src/tools';
import { VectorRenderType } from '@/src/types';
import Canonical from './types/Canonical';
import Categorized from './types/Categorized';
import Graduated from './types/Graduated';
import Heatmap from './types/Heatmap';
import SimpleSymbol from './types/SimpleSymbol';

interface IRenderTypeProps {
  component: any;
  attributeChecker?: (...args: any[]) => any;
  supportedLayerTypes: string[];
}
type RenderTypeOptions = {
  [key in VectorRenderType]: IRenderTypeProps;
};

interface ISelectableRenderTypeProps extends IRenderTypeProps {
  selectableAttributesAndValues?: Record<string, Set<any>>;
  layerTypeSupported: boolean;
}
type SelectableRenderTypes = {
  [key in VectorRenderType]: ISelectableRenderTypeProps;
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
  const entries = objectEntries(RENDER_TYPE_OPTIONS).map(
    ([renderType, renderTypeProps]) => [
      renderType,
      {
        ...renderTypeProps,
        ...(renderTypeProps.attributeChecker
          ? {
              selectableAttributesAndValues:
                renderTypeProps.attributeChecker(featureProperties),
            }
          : {}),
        layerTypeSupported:
          renderTypeProps.supportedLayerTypes.includes(layerType),
      },
    ],
  );
  return Object.fromEntries(entries);
};

const useLayerRenderType = (
  layer: IJGISLayer,
  setSelectedRenderType: React.Dispatch<
    React.SetStateAction<VectorRenderType | undefined>
  >,
) =>
  useEffect(() => {
    let renderType = layer.parameters?.symbologyState?.renderType;
    if (!renderType) {
      renderType = layer.type === 'HeatmapLayer' ? 'Heatmap' : 'Single Symbol';
    }
    setSelectedRenderType(renderType);
  }, []);

const VectorRendering = ({
  model,
  state,
  okSignalPromise,
  cancel,
  layerId,
}: ISymbologyDialogProps) => {
  const [selectedRenderType, setSelectedRenderType] = useState<
    VectorRenderType | undefined
  >();

  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const { featureProperties, isLoading: featuresLoading } = useGetProperties({
    layerId,
    model: model,
  });

  useLayerRenderType(layer, setSelectedRenderType);

  if (featuresLoading) {
    return <p>Loading...</p>;
  }

  if (selectedRenderType === undefined) {
    // typeguard
    return;
  }
  const selectableRenderTypes = getSelectableRenderTypes(
    featureProperties,
    layer.type,
  );
  const selectedRenderTypeProps = selectableRenderTypes[selectedRenderType];

  return (
    <>
      <div className="jp-gis-symbology-row">
        <label htmlFor="render-type-select">Render Type:</label>
        <div className="jp-select-wrapper">
          <select
            name="render-type-select"
            id="render-type-select"
            className="jp-mod-styled"
            value={selectedRenderType}
            onChange={event => {
              setSelectedRenderType(event.target.value as VectorRenderType);
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
      </div>
      <selectedRenderTypeProps.component
        model={model}
        state={state}
        okSignalPromise={okSignalPromise}
        cancel={cancel}
        layerId={layerId}
        {...(selectedRenderTypeProps.selectableAttributesAndValues
          ? {
              selectableAttributesAndValues:
                selectedRenderTypeProps.selectableAttributesAndValues,
            }
          : {})}
      />
    </>
  );
};

export default VectorRendering;
