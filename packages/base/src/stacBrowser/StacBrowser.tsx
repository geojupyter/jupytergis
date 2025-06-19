import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

import StacPanelView from '@/src/stacBrowser/components/StacPanelView';

interface IStacBrowserDialogProps {
  controlPanelModel: IJupyterGISModel;
}

const StacBrowser = ({ controlPanelModel: model }: IStacBrowserDialogProps) => {
  const jgisModel = model;

  return <StacPanelView model={jgisModel} />;
};
export default StacBrowser;
