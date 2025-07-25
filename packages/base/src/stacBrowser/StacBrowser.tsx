import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

import StacPanelView from '@/src/stacBrowser/components/StacPanelView';

interface IStacBrowserDialogProps {
  model: IJupyterGISModel;
}

const StacBrowser: React.FC<IStacBrowserDialogProps> = ({ model }) => {
  return <StacPanelView model={model} />;
};
export default StacBrowser;
