import { IJupyterGISModel } from '@jupytergis/schema';
import { LabIcon } from '@jupyterlab/ui-components';
import React from 'react';

import { targetWithCenterIcon } from '@/src/icons';
import { Button } from '@/src/shared/components/Button';

interface ILandmarkResetProps {
  model?: IJupyterGISModel;
  layerId?: string;
}

function LandmarkReset({ model, layerId }: ILandmarkResetProps) {
  const handleSetLandmarkToCurrentView = () => {
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
        title="Set landmark to current viewport"
        onClick={handleSetLandmarkToCurrentView}
      >
        <LabIcon.resolveReact
          icon={targetWithCenterIcon}
          className="jp-gis-layerIcon"
          tag="span"
        />
        Set Landmark Extent
      </Button>
    </div>
  );
}

export default LandmarkReset;
