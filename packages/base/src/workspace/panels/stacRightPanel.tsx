import { IJupyterGISModel, IJupyterGISSettings } from '@jupytergis/schema';
import * as React from 'react';

import StacPanel from '../../features/stac-browser/components/StacPanel';
import { bookOpenIcon } from '../../shared/icons';
import { FloatingRightPanel } from './floatingRightPanel';
import { useUIState } from './hooks/useUIState';

interface IStacRightPanelProps {
  model: IJupyterGISModel;
  settings: IJupyterGISSettings;
}

const StacRightPanelComponent: React.FC<IStacRightPanelProps> = ({
  model,
  settings,
}) => {
  const [stacBrowserOpen] = useUIState('stacBrowserOpen', model);

  const visible =
    !settings.rightPanelDisabled &&
    !settings.stacBrowserDisabled &&
    stacBrowserOpen === true;

  if (!visible) {
    return null;
  }

  return (
    <FloatingRightPanel
      title="STAC Browser"
      icon={bookOpenIcon}
      defaultPosition={{ x: -40, y: 96 }}
    >
      <StacPanel model={model} />
    </FloatingRightPanel>
  );
};

StacRightPanelComponent.displayName = 'StacRightPanel';

export const StacRightPanel = React.memo(StacRightPanelComponent);
