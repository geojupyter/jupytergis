import React from 'react';

import { ISymbologyDialogProps } from '@/src/features/layers/symbology/symbologyDialog';
import Grammar from './types/Grammar';
import Heatmap from './types/Heatmap';

const VectorRendering: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride = false,
  segmentId,
}) => {
  const layer = layerId !== undefined ? model.getLayer(layerId) : null;

  if (!layerId || !layer?.parameters) {
    return null;
  }

  if (layer.type === 'HeatmapLayer') {
    return (
      <Heatmap
        model={model}
        okSignalPromise={okSignalPromise}
        layerId={layerId}
        isStorySegmentOverride={isStorySegmentOverride}
        segmentId={segmentId}
      />
    );
  }

  return (
    <Grammar
      model={model}
      okSignalPromise={okSignalPromise}
      layerId={layerId}
      isStorySegmentOverride={isStorySegmentOverride}
      segmentId={segmentId}
    />
  );
};

export default VectorRendering;
