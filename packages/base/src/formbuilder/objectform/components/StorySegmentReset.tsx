import { IJupyterGISModel } from '@jupytergis/schema';
import { LabIcon } from '@jupyterlab/ui-components';
import React from 'react';

import { targetWithCenterIcon } from '@/src/icons';
import { Button } from '@/src/shared/components/Button';

interface IStorySegmentResetProps {
  model?: IJupyterGISModel;
  layerId?: string;
}

function StorySegmentReset({ model, layerId }: IStorySegmentResetProps) {
  const handleSetStorySegmentToCurrentView = () => {
    if (!model || !layerId) {
      return;
    }
    const layer = model.getLayer(layerId);
    if (!layer) {
      return;
    }
    const { zoom, extent } = model.getOptions();
    const updatedLayer = {
      ...layer,
      parameters: {
        ...layer.parameters,
        zoom,
        extent,
      },
    };

    model.sharedModel.updateLayer(layerId, updatedLayer);
  };

  return (
    <div>
      <Button
        title="Set story segment to current viewport"
        onClick={handleSetStorySegmentToCurrentView}
      >
        <LabIcon.resolveReact
          icon={targetWithCenterIcon}
          className="jp-gis-layerIcon"
          tag="span"
        />
        Set Story Segment Extent
      </Button>
    </div>
  );
}

export default StorySegmentReset;
