import { IJupyterGISModel, IJupyterGISSettings } from '@jupytergis/schema';
import * as React from 'react';

import { FloatingPanelId } from './floatingPanelDock';
import { FloatingRightPanel } from './floatingRightPanel';
import { useUIState } from './hooks/useUIState';
import StacPanel from '../../features/stac-browser/components/StacPanel';
import { bookOpenIcon } from '../../shared/icons';

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
      value={FloatingPanelId.STAC}
      title="STAC Browser"
      icon={bookOpenIcon}
    >
      <StacPanel model={model} />
    </FloatingRightPanel>
  );
};

StacRightPanelComponent.displayName = 'StacRightPanel';

export const StacRightPanel = React.memo(StacRightPanelComponent);
