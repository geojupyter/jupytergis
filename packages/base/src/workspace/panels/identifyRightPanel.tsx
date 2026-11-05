import {
  IDict,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import * as React from 'react';

import { IdentifyPanelComponent } from '../../features/identify/IdentifyPanel';
import { infoIcon } from '../../shared/icons';
import { FloatingRightPanel } from './floatingRightPanel';

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
    <FloatingRightPanel
      value="identify"
      title="Identified Features"
      icon={infoIcon}
    >
      <IdentifyPanelComponent
        model={model}
        patchGeoJSONFeatureAttributes={patchGeoJSONFeatureAttributes}
      />
    </FloatingRightPanel>
  );
};

IdentifyRightPanelComponent.displayName = 'IdentifyRightPanel';

export const IdentifyRightPanel = React.memo(IdentifyRightPanelComponent);
