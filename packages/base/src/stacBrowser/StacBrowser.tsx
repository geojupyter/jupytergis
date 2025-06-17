import {
  IJupyterGISModel,
  IJupyterGISTracker,
  IJupyterGISWidget,
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { IControlPanelModel } from '../types';
import StacPanelView from './components/StacPanelView';
import {
  groupDatasetsByCollection,
  datasets,
  groupPlatformsByCollection,
  platforms,
  productsByCollection,
} from './constants';

interface IStacBrowserDialogProps {
  controlPanelModel: IControlPanelModel;
  tracker: IJupyterGISTracker;
}

const StacBrowser = ({ controlPanelModel }: IStacBrowserDialogProps) => {
  const [jgisModel, setJgisModel] = useState<IJupyterGISModel | undefined>(
    controlPanelModel?.jGISModel,
  );

  useEffect(() => {
    const handleCurrentChanged = (
      _: IJupyterGISTracker,
      widget: IJupyterGISWidget | null,
    ) => {
      setJgisModel(widget?.model);
    };

    controlPanelModel.documentChanged.connect(handleCurrentChanged);

    return () => {
      controlPanelModel.documentChanged.disconnect(handleCurrentChanged);
    };
  }, [controlPanelModel]);

  return (
    <StacPanelView
      datasets={groupDatasetsByCollection(datasets)}
      platforms={groupPlatformsByCollection(platforms)}
      products={productsByCollection}
      model={jgisModel}
    />
  );
};
export default StacBrowser;
