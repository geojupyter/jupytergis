import { LayerType } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  getColorCodeFeatureAttributes,
  getFeatureAttributes,
  getNumericFeatureAttributes,
  objectEntries,
} from '@/src/tools';
import { SymbologyTab, VectorRenderType } from '@/src/types';
import Canonical from './types/Canonical';
import Categorized from './types/Categorized';
import Graduated from './types/Graduated';
import Heatmap from './types/Heatmap';
import SimpleSymbol from './types/SimpleSymbol';

interface IRenderTypeProps {
  component: any;
  attributeChecker?: (...args: any[]) => any;
  supportedLayerTypes: string[];
  isTabbed: boolean;
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
    isTabbed: true,
  },
  Canonical: {
    component: Canonical,
    attributeChecker: getColorCodeFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'VectorTileLayer', 'HeatmapLayer'],
    isTabbed: false,
  },
  Graduated: {
    component: Graduated,
    attributeChecker: getNumericFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'VectorTileLayer', 'HeatmapLayer'],
    isTabbed: true,
  },
  Categorized: {
    component: Categorized,
    attributeChecker: getFeatureAttributes,
    supportedLayerTypes: ['VectorLayer', 'VectorTileLayer', 'HeatmapLayer'],
    isTabbed: true,
  },
  Heatmap: {
    component: Heatmap,
    supportedLayerTypes: ['VectorLayer', 'HeatmapLayer'],
    isTabbed: false,
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

const VectorRendering: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride = false,
  segmentId,
}) => {
  const [symbologyTab, setSymbologyTab] = useState<SymbologyTab>('color');
  const [selectedRenderType, setSelectedRenderType] = useState<
    VectorRenderType | undefined
  >();

  const layer = layerId !== undefined ? model.getLayer(layerId) : null;

  useEffect(() => {
    if (!layer) {
      return;
    }

    let renderType: VectorRenderType | undefined;

    if (isStorySegmentOverride) {
      const segment = segmentId ? model.getLayer(segmentId) : undefined;
      if (!segment) {
        return;
      }
      const override = segment.parameters?.symbologyOverride?.find(
        (override: { targetLayer?: string }) =>
          override.targetLayer === layerId,
      );
      if (!override) {
        return;
      }

      renderType = override.symbologyState?.renderType;
    } else {
      renderType = layer.parameters?.symbologyState?.renderType;
    }

    if (!renderType) {
      renderType = layer.type === 'HeatmapLayer' ? 'Heatmap' : 'Single Symbol';
    }

    setSelectedRenderType(renderType);
  }, []);

  const { featureProperties, isLoading: featuresLoading } = useGetProperties({
    layerId,
    model: model,
  });

  if (!layerId || !layer?.parameters) {
    return null;
  }

  if (featuresLoading) {
    return <p>Loading...</p>;
  }

  if (selectedRenderType === undefined) {
    return null;
  }

  const selectableRenderTypes = getSelectableRenderTypes(
    featureProperties,
    layer.type,
  );
  const selectedRenderTypeProps = selectableRenderTypes[selectedRenderType];

  return (
    <>
      {selectedRenderTypeProps.isTabbed && (
        <div className="jp-gis-symbology-tabs">
          {(['color', 'radius'] as const).map(tab => (
            <button
              key={tab}
              className={`jp-gis-tab ${symbologyTab === tab ? 'active' : ''}`}
              onClick={() => setSymbologyTab(tab as SymbologyTab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}
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
                  renderTypeProps.layerTypeSupported &&
                  !(renderType === 'Heatmap' && symbologyTab === 'radius'),
              )
              .map(([renderType, _]) => (
                <option key={renderType} value={renderType}>
                  {renderType}
                </option>
              ))}
          </select>
        </div>
      </div>

      <selectedRenderTypeProps.component
        model={model}
        okSignalPromise={okSignalPromise}
        layerId={layerId}
        isStorySegmentOverride={isStorySegmentOverride}
        segmentId={segmentId}
        {...(selectedRenderTypeProps.isTabbed ? { symbologyTab } : {})}
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
