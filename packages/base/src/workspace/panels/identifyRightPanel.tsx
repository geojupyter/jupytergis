import {
  IDict,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import * as React from 'react';
import Draggable from 'react-draggable';

import { IdentifyPanelComponent } from '../../features/identify/IdentifyPanel';

interface IIdentifyRightPanelProps {
  model: IJupyterGISModel;
  settings: IJupyterGISSettings;
  patchGeoJSONFeatureAttributes?: (
    sourceId: string,
    target: { featureId: string },
    attributeUpdates: IDict<any>,
  ) => Promise<boolean>;
}

const IdentifyRightPanelComponent: React.FC<IIdentifyRightPanelProps> = ({
  model,
  settings,
  patchGeoJSONFeatureAttributes,
}) => {
  const [isIdentifying, setIsIdentifying] = React.useState(
    () => model.currentMode === 'identifying',
  );

  React.useEffect(() => {
    const handleModeChanged = () => {
      setIsIdentifying(model.currentMode === 'identifying');
    };

    model.modeChanged.connect(handleModeChanged);
    handleModeChanged();

    return () => {
      model.modeChanged.disconnect(handleModeChanged);
    };
  }, [model]);

  const visible =
    !settings.rightPanelDisabled &&
    !settings.identifyDisabled &&
    isIdentifying;

  if (!visible) {
    return null;
  }

  return (
    <Draggable
      handle="[data-drag-handle]"
      bounds=".jGIS-Mainview-Container"
    >
      <div className="jgis-right-panel-container jgis-identify-right-panel">
        <div
          className="jgis-identify-right-panel-header"
          data-drag-handle
        >
          Identified Features
        </div>
        <div className="jgis-identify-right-panel-body">
          <IdentifyPanelComponent
            model={model}
            patchGeoJSONFeatureAttributes={patchGeoJSONFeatureAttributes}
          />
        </div>
      </div>
    </Draggable>
  );
};

IdentifyRightPanelComponent.displayName = 'IdentifyRightPanel';

export const IdentifyRightPanel = React.memo(IdentifyRightPanelComponent);
